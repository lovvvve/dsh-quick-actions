import type { UserConfig } from 'tsdown'

export interface DshClientBundleOptions {
  readonly id: string
  readonly entry: string
  readonly outDir: string
  readonly external?: readonly string[]
}

/**
 * Build one browser Client package for DSH's lazy CommonJS module table.
 * The caller owns the exact list of module-table requests under `external`.
 */
export function dshClientBundle(options: DshClientBundleOptions): UserConfig {
  const external = new Set(options.external ?? [])
  return {
    name: `${options.id}/client`,
    entry: { client: options.entry },
    outDir: options.outDir,
    format: 'cjs',
    platform: 'browser',
    target: 'es2024',
    dts: false,
    sourcemap: true,
    clean: false,
    failOnWarn: true,
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
