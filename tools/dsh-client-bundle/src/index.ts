import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { UserConfig } from 'tsdown'

const CLIENT_FILE = 'client.js'
const CLIENT_MAP_FILE = `${CLIENT_FILE}.map`

interface GeneratedClient {
  readonly code: string
  readonly map: string
}

export interface DshClientBundleOptions {
  readonly id: string
  readonly entry: string
  readonly outDir: string
  readonly external?: readonly string[]
}

interface SyntaxNode {
  readonly type: string
  readonly [key: string]: unknown
}

function syntaxNode(value: unknown): value is SyntaxNode {
  return typeof value === 'object' && value !== null && typeof (value as { type?: unknown }).type === 'string'
}

function visitSyntax(
  node: SyntaxNode,
  visit: (node: SyntaxNode, parent: SyntaxNode | undefined) => void,
  parent?: SyntaxNode,
): void {
  visit(node, parent)
  for (const value of Object.values(node)) {
    if (syntaxNode(value)) visitSyntax(value, visit, node)
    else if (Array.isArray(value)) {
      for (const child of value) if (syntaxNode(child)) visitSyntax(child, visit, node)
    }
  }
}

function literalString(value: unknown): string | undefined {
  if (!syntaxNode(value)) return undefined
  return typeof value.value === 'string' ? value.value : undefined
}

function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
    ? error.code
    : undefined
}

async function replaceFile(destination: string, content: string): Promise<void> {
  const next = `${destination}.${process.pid}.next`
  await writeFile(next, content)
  try {
    await rename(next, destination)
  } catch (error) {
    if (errorCode(error) !== 'EEXIST' && errorCode(error) !== 'EPERM') throw error
    await rm(destination, { force: true })
    await rename(next, destination)
  } finally {
    await rm(next, { force: true })
  }
}

function sourceMapText(source: unknown): string {
  if (typeof source === 'string') return source
  if (source instanceof Uint8Array) return new TextDecoder().decode(source)
  throw new Error(`dshClientBundle: ${CLIENT_MAP_FILE} is not text`)
}

async function publishClientBundle(destination: string, generated: GeneratedClient): Promise<void> {
  await mkdir(destination, { recursive: true })
  await replaceFile(join(destination, CLIENT_MAP_FILE), generated.map)
  await replaceFile(join(destination, CLIENT_FILE), generated.code)
}

/**
 * Build one browser Client package for DSH's lazy CommonJS module table.
 * The caller owns the exact list of module-table requests under `external`.
 */
export function dshClientBundle(options: DshClientBundleOptions): UserConfig {
  const external = new Set(options.external ?? [])
  const destination = resolve(options.outDir)
  // The bundler writes here instead of into `outDir`; it sits beside `outDir` rather than
  // inside it, keeping the source map paths of a published artifact resolvable. The `-stage`
  // suffix is the historical name of this directory and is what `.gitignore` matches.
  const scratch = `${destination}.dsh-client-stage`
  let generated: GeneratedClient | undefined
  return {
    name: `${options.id}/client`,
    entry: { client: options.entry },
    outDir: scratch,
    format: 'cjs',
    platform: 'browser',
    target: 'es2024',
    dts: false,
    sourcemap: true,
    clean: false,
    failOnWarn: true,
    onSuccess: async () => {
      // tsdown calls `onSuccess` without awaiting or catching it, so a rejection would
      // surface as an unhandled rejection and take the watcher down. Report and mark the
      // run failed instead: what is already published stays, and the next build republishes.
      try {
        if (generated === undefined) throw new Error('the build generated no client bundle')
        await publishClientBundle(destination, generated)
      } catch (error) {
        console.error(`dshClientBundle: publishing ${CLIENT_FILE} failed`, error)
        process.exitCode = 1
      }
    },
    deps: {
      neverBundle: specifier => external.has(specifier),
      alwaysBundle: specifier => !external.has(specifier),
    },
    inputOptions: {
      platform: 'browser',
      resolve: {
        conditionNames: ['browser', 'import', 'module', 'default'],
      },
    },
    plugins: [{
      /**
       * DSH loads `client.js` straight off disk, so only a build tsdown reports as
       * successful may reach `destination`. The generated pair is therefore published
       * from memory, never from what the bundler wrote: a failed build writes its scratch
       * output too — tsdown escalates `failOnWarn` after the write — and tsdown offers no
       * close hook on process exit (`Symbol.asyncDispose` runs on config reload only,
       * while `q`, SIGINT and SIGTERM end the watcher outright). Publishing from memory is
       * what lets the scratch directory be discarded as each build closes, so closing a
       * watcher after a failed build leaves nothing behind.
       */
      name: 'dsh-client-atomic-publish',
      async buildStart() {
        generated = undefined
        // Nothing in-process can clean up after a killed build, so each build starts clean.
        await rm(scratch, { recursive: true, force: true })
      },
      async closeBundle() { await rm(scratch, { recursive: true, force: true }) },
      generateBundle(_outputOptions, bundle) {
        const chunk = bundle[CLIENT_FILE]
        const map = bundle[CLIENT_MAP_FILE]
        if (chunk?.type !== 'chunk') throw new Error(`dshClientBundle: the build generated no ${CLIENT_FILE} chunk`)
        if (map?.type !== 'asset') throw new Error(`dshClientBundle: the build generated no ${CLIENT_MAP_FILE} asset`)
        generated = { code: chunk.code, map: sourceMapText(map.source) }
      },
    }, {
      name: 'dsh-client-module-table-boundary',
      renderChunk(code) {
        visitSyntax(this.parse(code) as unknown as SyntaxNode, (node, parent) => {
          if (node.type === 'Identifier' && node.name === 'require') {
            const directCall = parent?.type === 'CallExpression' && parent.callee === node
            const parameterDeclaration = parent?.type === 'ArrowFunctionExpression'
              && Array.isArray(parent.params)
              && parent.params.includes(node)
            const memberName = parent?.type === 'MemberExpression'
              && parent.property === node
              && parent.computed !== true
            const propertyName = (parent?.type === 'Property'
              || parent?.type === 'MethodDefinition'
              || parent?.type === 'PropertyDefinition')
              && parent.key === node
              && parent.computed !== true
              && parent.shorthand !== true
            if (!directCall && !parameterDeclaration && !memberName && !propertyName) {
              throw new Error(`dshClientBundle: indirect require reference under ${parent?.type ?? 'root'} cannot use the DSH module table`)
            }
          }
          if (node.type === 'ImportExpression') {
            const specifier = literalString(node.source) ?? '<computed>'
            throw new Error(`dshClientBundle: dynamic import of ${specifier} cannot use the DSH module table`)
          }
          if (node.type !== 'CallExpression') return
          const callee = syntaxNode(node.callee) ? node.callee : undefined
          if (callee?.type !== 'Identifier' || callee.name !== 'require') return
          const args = Array.isArray(node.arguments) ? node.arguments : []
          const specifier = literalString(args[0])
          if (specifier === undefined) {
            throw new Error('dshClientBundle: computed require cannot use the explicit external list')
          }
          if (!external.has(specifier)) {
            throw new Error(`dshClientBundle: require of undeclared external ${specifier}`)
          }
        })
        return null
      },
    }],
    outputOptions: {
      codeSplitting: false,
      entryFileNames: CLIENT_FILE,
      sourcemapExcludeSources: false,
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(options.id)}, factory: (require) => {`,
      intro: 'var module = { exports: {} }; var exports = module.exports;',
      footer: 'return module.exports; } });',
    },
  }
}
