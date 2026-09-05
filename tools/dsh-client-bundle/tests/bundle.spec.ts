import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { runInNewContext } from 'node:vm'
import { SourceMapConsumer, type RawSourceMap } from 'source-map-js'
import { afterEach, describe, expect, it } from 'vitest'

const roots: string[] = []
const children: ChildProcess[] = []
const repositoryRoot = resolve(import.meta.dirname, '../../..')
const tsdownCli = fileURLToPath(import.meta.resolve('tsdown/run'))

async function fixture(source: string, trailingOutDir = false): Promise<{
  root: string
  entry: string
  output: string
  config: string
}> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-client-bundle-'))
  roots.push(root)
  const entry = join(root, 'src', 'client.ts')
  const finalOutDir = join(root, 'lib')
  const configuredOutDir = trailingOutDir ? `${finalOutDir}/` : finalOutDir
  const output = join(finalOutDir, 'client.js')
  const config = join(root, 'tsdown.config.ts')
  await mkdir(dirname(entry), { recursive: true })
  await writeFile(entry, source)
  await writeFile(config, [
    `import { dshClientBundle } from ${JSON.stringify(pathToFileURL(resolve(repositoryRoot, 'tools/dsh-client-bundle/src/index.ts')).href)}`,
    `export default dshClientBundle({`,
    `  id: 'dsh-client-fixture',`,
    `  entry: ${JSON.stringify(entry)},`,
    `  outDir: ${JSON.stringify(configuredOutDir)},`,
    `  external: ['fixture-external'],`,
    `})`,
    '',
  ].join('\n'))
  return { root, entry, output, config }
}

async function targetDependency(
  root: string,
  name: string,
  fields: Readonly<Record<string, unknown>>,
): Promise<void> {
  const dependency = join(root, 'node_modules', name)
  await mkdir(dependency, { recursive: true })
  await writeFile(join(dependency, 'package.json'), JSON.stringify({ name, type: 'module', ...fields }))
  await writeFile(join(dependency, 'browser.js'), `export const target = 'browser'\n`)
  await writeFile(join(dependency, 'node.js'), `export const target = 'node'\n`)
  await writeFile(join(dependency, 'default.js'), `export const target = 'default'\n`)
}

function runTsdown(config: string): Promise<void> {
  return new Promise((resolveRun, reject) => {
    execFile(process.execPath, [tsdownCli, '--config', config], { cwd: repositoryRoot }, (error, _stdout, stderr) => {
      if (error === null) resolveRun()
      else reject(new Error(`tsdown failed: ${stderr}`, { cause: error }))
    })
  })
}

function executeBundle(source: string): { exports: Record<string, unknown>; requests: string[] } {
  const registrations: Array<{ id: string; factory(require: (id: string) => unknown): Record<string, unknown> }> = []
  runInNewContext(source, {
    window: {
      __ModuleLoader__: {
        load(registration: { id: string; factory(require: (id: string) => unknown): Record<string, unknown> }) {
          registrations.push(registration)
        },
      },
    },
  })
  expect(registrations).toHaveLength(1)
  expect(registrations[0]?.id).toBe('dsh-client-fixture')
  const requests: string[] = []
  const exports = registrations[0]!.factory((id) => {
    requests.push(id)
    if (id === 'fixture-external') return { marker: 'external-value' }
    throw new Error(`unexpected external ${id}`)
  })
  return { exports, requests }
}

async function waitUntil(check: () => Promise<boolean>, timeoutMs = 10_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await check()) return
    await new Promise(resolveWait => setTimeout(resolveWait, 25))
  }
  throw new Error('timed out waiting for client bundle output')
}

async function waitForApply(
  child: ChildProcess,
  output: string,
  expected: unknown,
  diagnostics: () => string,
): Promise<void> {
  try {
    await waitUntil(async () => {
      if (child.exitCode !== null) throw new Error(`watch exited early:\n${diagnostics()}`)
      try {
        const executed = executeBundle(await readFile(output, 'utf8'))
        return (executed.exports.apply as () => unknown)() === expected
      } catch {
        return false
      }
    })
  } catch (error) {
    throw new Error(`watch did not rebuild:\n${diagnostics()}`, { cause: error })
  }
}

afterEach(async () => {
  for (const child of children.splice(0)) {
    if (child.exitCode !== null || child.signalCode !== null) continue
    const closed = once(child, 'close')
    child.kill('SIGTERM')
    await closed
  }
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true })
})

describe('dshClientBundle', () => {
  it('resolves conditional exports through the browser branch', async () => {
    const built = await fixture([
      `import { target } from 'conditional-dependency'`,
      `export const inject = []`,
      `export function apply() { return target }`,
      '',
    ].join('\n'))
    await targetDependency(built.root, 'conditional-dependency', {
      exports: {
        '.': {
          browser: './browser.js',
          node: './node.js',
          default: './default.js',
        },
      },
    })

    await runTsdown(built.config)

    const executed = executeBundle(await readFile(built.output, 'utf8'))
    expect((executed.exports.apply as () => unknown)()).toBe('browser')
  })

  it('resolves legacy package browser fields instead of Node main entries', async () => {
    const built = await fixture([
      `import { target } from 'legacy-conditional-dependency'`,
      `export const inject = []`,
      `export function apply() { return target }`,
      '',
    ].join('\n'))
    await targetDependency(built.root, 'legacy-conditional-dependency', {
      main: './node.js',
      browser: './browser.js',
    })

    await runTsdown(built.config)

    const executed = executeBundle(await readFile(built.output, 'utf8'))
    expect((executed.exports.apply as () => unknown)()).toBe('browser')
  })

  it('rejects undeclared Node builtins from browser bundles', async () => {
    const built = await fixture([
      `import { basename } from 'node:path'`,
      `export const inject = []`,
      `export function apply() { return basename('/tmp/example') }`,
      '',
    ].join('\n'))

    await expect(runTsdown(built.config)).rejects.toThrow(/UNRESOLVED_IMPORT|node:path/)
  })

  it('rejects dynamic imports of module-table externals', async () => {
    const built = await fixture([
      `export const inject = []`,
      `export async function apply() { return (await import('fixture-external')).marker }`,
      '',
    ].join('\n'))

    await expect(runTsdown(built.config)).rejects.toThrow(/dynamic import.*fixture-external/i)
  })

  it('rejects computed require calls that bypass the external list', async () => {
    const built = await fixture([
      `export const inject = []`,
      `export function apply(id: string) { return require(id) }`,
      '',
    ].join('\n'))

    await expect(runTsdown(built.config)).rejects.toThrow(/computed require/i)
  })

  it('rejects indirect references to the ModuleLoader require parameter', async () => {
    const built = await fixture([
      `const load = require`,
      `export const inject = []`,
      `export function apply() { return load('undeclared-runtime') }`,
      '',
    ].join('\n'))

    await expect(runTsdown(built.config)).rejects.toThrow(/indirect require/i)
  })

  it('fails the build when a non-external import cannot be resolved', async () => {
    const built = await fixture([
      `import { missing } from 'missing-dependency'`,
      `export const inject = []`,
      `export function apply() { return missing }`,
      '',
    ].join('\n'))

    await expect(runTsdown(built.config)).rejects.toThrow(/UNRESOLVED_IMPORT|missing-dependency/)
  })

  it('inlines dynamic imports into the single loadable client artifact', async () => {
    const built = await fixture([
      `export const inject = []`,
      `export async function apply() { return (await import('./lazy.ts')).value }`,
      '',
    ].join('\n'))
    await writeFile(join(dirname(built.entry), 'lazy.ts'), `export const value = 'lazy-value'\n`)

    await runTsdown(built.config)

    expect((await readdir(join(built.root, 'lib'))).sort()).toEqual(['client.js', 'client.js.map'])
    const executed = executeBundle(await readFile(built.output, 'utf8'))
    await expect((executed.exports.apply as () => Promise<unknown>)()).resolves.toBe('lazy-value')
  })

  it('emits an executable DSH ModuleLoader factory with externals and a source map', async () => {
    const built = await fixture([
      `import { marker } from 'fixture-external'`,
      `export const inject = ['slots']`,
      `export function apply() { return marker }`,
      '',
    ].join('\n'))

    await runTsdown(built.config)

    const source = await readFile(built.output, 'utf8')
    const executed = executeBundle(source)
    expect(executed.requests).toEqual(['fixture-external'])
    expect(executed.exports.inject).toEqual(['slots'])
    expect((executed.exports.apply as () => unknown)()).toBe('external-value')
    const map = JSON.parse(await readFile(`${built.output}.map`, 'utf8')) as RawSourceMap
    expect(map.sources.some(item => item.endsWith('/src/client.ts'))).toBe(true)
    expect(map.sourcesContent?.some(item => item.includes(`export function apply()`))).toBe(true)
    const generatedLines = source.split('\n')
    const generatedIndex = generatedLines.findIndex(line => line.includes('function apply()'))
    expect(generatedIndex).toBeGreaterThanOrEqual(0)
    const generatedColumn = generatedLines[generatedIndex]!.indexOf('function apply()')
    const original = new SourceMapConsumer(map).originalPositionFor({
      line: generatedIndex + 1,
      column: generatedColumn,
    })
    expect(original.source.endsWith('/src/client.ts')).toBe(true)
    expect(original.line).toBe(3)
  })

  it('keeps failed staging outside a trailing-separator final outDir', async () => {
    const built = await fixture([
      `export const inject = []`,
      `export function apply() { return eval("'broken'") }`,
      '',
    ].join('\n'), true)

    await expect(runTsdown(built.config)).rejects.toThrow(/eval/i)

    const finalEntries = await readdir(dirname(built.output)).catch((error: unknown) => {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') return []
      throw error
    })
    expect(finalEntries).toEqual([])
  })

  it('keeps sourcemap paths valid when outDir has a trailing separator', async () => {
    const built = await fixture(`export const inject = []; export function apply() { return 'value' }\n`, true)

    await runTsdown(built.config)

    const mapPath = `${built.output}.map`
    const map = JSON.parse(await readFile(mapPath, 'utf8')) as RawSourceMap
    const source = map.sources.find(item => item.endsWith('/src/client.ts'))
    expect(source).toBeDefined()
    expect(await realpath(resolve(dirname(mapPath), map.sourceRoot ?? '', source!))).toBe(await realpath(built.entry))
  })

  it('rebuilds the same client artifact when the watched entry changes', async () => {
    const built = await fixture(`export const inject = []; export function apply() { return 'one' }\n`)
    const child = spawn(process.execPath, [tsdownCli, '--config', built.config, '--watch'], {
      cwd: repositoryRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    children.push(child)
    let diagnostics = ''
    child.stdout?.on('data', chunk => { diagnostics += String(chunk) })
    child.stderr?.on('data', chunk => { diagnostics += String(chunk) })

    await waitForApply(child, built.output, 'one', () => diagnostics)
    const lastGood = await readFile(built.output, 'utf8')
    const diagnosticsStart = diagnostics.length

    await writeFile(built.entry, `export const inject = []; export function apply() { return eval("'broken'") }\n`)
    await waitUntil(async () => {
      const failedBuild = diagnostics.slice(diagnosticsStart)
      return /eval/i.test(failedBuild) && /build failed|error/i.test(failedBuild)
    })
    expect(await readFile(built.output, 'utf8')).toBe(lastGood)

    await writeFile(built.entry, `export const inject = []; export function apply() { return 'two' }\n`)

    await waitForApply(child, built.output, 'two', () => diagnostics)
  }, 35_000)
})
