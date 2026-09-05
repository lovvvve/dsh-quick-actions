import { copyFile, mkdir, rename, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { UserConfig } from 'tsdown'

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

async function replaceFile(source: string, destination: string): Promise<void> {
  const next = `${destination}.${process.pid}.next`
  await copyFile(source, next)
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

async function publishClientBundle(staging: string, destination: string): Promise<void> {
  await mkdir(destination, { recursive: true })
  await replaceFile(join(staging, 'client.js.map'), join(destination, 'client.js.map'))
  await replaceFile(join(staging, 'client.js'), join(destination, 'client.js'))
  await rm(staging, { recursive: true, force: true })
}

/**
 * Build one browser Client package for DSH's lazy CommonJS module table.
 * The caller owns the exact list of module-table requests under `external`.
 */
export function dshClientBundle(options: DshClientBundleOptions): UserConfig {
  const external = new Set(options.external ?? [])
  const destination = resolve(options.outDir)
  const staging = `${destination}.dsh-client-stage`
  return {
    name: `${options.id}/client`,
    entry: { client: options.entry },
    outDir: staging,
    format: 'cjs',
    platform: 'browser',
    target: 'es2024',
    dts: false,
    sourcemap: true,
    clean: false,
    failOnWarn: true,
    onSuccess: async () => { await publishClientBundle(staging, destination) },
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
      entryFileNames: 'client.js',
      sourcemapExcludeSources: false,
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(options.id)}, factory: (require) => {`,
      intro: 'var module = { exports: {} }; var exports = module.exports;',
      footer: 'return module.exports; } });',
    },
  }
}
