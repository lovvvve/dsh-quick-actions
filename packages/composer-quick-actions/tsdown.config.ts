import type { UserConfig } from 'tsdown'
import { dshClientBundle } from '@dsh-plugins/dsh-client-bundle'

const id = 'dsh-composer-quick-actions'

const host: UserConfig = {
  name: id,
  entry: {
    index: 'src/index.ts',
    types: 'src/types.ts',
  },
  outDir: 'lib',
  format: 'esm',
  platform: 'node',
  target: 'es2024',
  fixedExtension: false,
  dts: false,
  clean: false,
}

export default [
  host,
  dshClientBundle({
    id,
    entry: 'src/client/index.tsx',
    outDir: 'lib',
    // Exactly the module-table entries this Client requires. Everything else is
    // bundled, so the surfaces cannot silently pick up a second React copy —
    // and `dsh-client-ui-primitives` must be listed rather than inlined: it
    // ships CSS Modules the DSH web shell compiles at build time, so bundling it
    // fails the adapter's CSS guard instead of quietly duplicating the shell's
    // styles. Keep this list in step with `dsh.client.external` in package.json;
    // `tests/release/packaging.spec.ts` asserts the two are the same set.
    external: ['react', 'react/jsx-runtime', '@deepseek-ai/dsh-client-ui-primitives'],
  }),
]
