import type { UserConfig } from 'tsdown'
import { dshClientBundle } from '@dsh-plugins/dsh-client-bundle'

const id = 'dsh-composer-quick-actions'

const host: UserConfig = {
  name: id,
  entry: {
    index: 'src/index.ts',
    types: 'src/types.ts',
    remote: 'src/remote.ts',
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
    entry: 'src/client/index.ts',
    outDir: 'lib',
  }),
]
