import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { runInNewContext } from 'node:vm'
import { afterEach, describe, expect, it } from 'vitest'

const roots: string[] = []
const children: ChildProcess[] = []
const repositoryRoot = resolve(import.meta.dirname, '../../..')
const tsdownCli = fileURLToPath(import.meta.resolve('tsdown/run'))

async function fixture(source: string): Promise<{
  root: string
  entry: string
  output: string
  config: string
}> {
  const root = await mkdtemp(join(tmpdir(), 'dsh-client-bundle-'))
  roots.push(root)
  const entry = join(root, 'src', 'client.ts')
  const output = join(root, 'lib', 'client.js')
  const config = join(root, 'tsdown.config.ts')
  await mkdir(dirname(entry), { recursive: true })
  await writeFile(entry, source)
  await writeFile(config, [
    `import { dshClientBundle } from ${JSON.stringify(pathToFileURL(resolve(repositoryRoot, 'tools/dsh-client-bundle/src/index.ts')).href)}`,
    `export default dshClientBundle({`,
    `  id: 'dsh-client-fixture',`,
    `  entry: ${JSON.stringify(entry)},`,
    `  outDir: ${JSON.stringify(join(root, 'lib'))},`,
    `  external: ['fixture-external'],`,
    `})`,
    '',
  ].join('\n'))
  return { root, entry, output, config }
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
    const map = JSON.parse(await readFile(`${built.output}.map`, 'utf8')) as {
      sources: string[]
      sourcesContent: Array<string | null>
    }
    expect(map.sources.some(item => item.endsWith('/src/client.ts'))).toBe(true)
    expect(map.sourcesContent.some(item => item?.includes(`export function apply()`))).toBe(true)
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

    await waitUntil(async () => {
      if (child.exitCode !== null) throw new Error(`watch exited early:\n${diagnostics}`)
      try {
        const executed = executeBundle(await readFile(built.output, 'utf8'))
        return (executed.exports.apply as () => unknown)() === 'one'
      } catch {
        return false
      }
    })

    await writeFile(built.entry, `export const inject = []; export function apply() { return 'two' }\n`)

    try {
      await waitUntil(async () => {
        if (child.exitCode !== null) throw new Error(`watch exited early:\n${diagnostics}`)
        try {
          const executed = executeBundle(await readFile(built.output, 'utf8'))
          return (executed.exports.apply as () => unknown)() === 'two'
        } catch {
          return false
        }
      })
    } catch (error) {
      throw new Error(`watch did not rebuild:\n${diagnostics}`, { cause: error })
    }
  }, 20_000)
})
