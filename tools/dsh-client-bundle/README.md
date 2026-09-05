# dsh-client-bundle

将普通浏览器 CJS 产物包装为 DSH Client ModuleLoader 所需的 lazy-CJS 格式。

```ts
import { dshClientBundle } from '@dsh-plugins/dsh-client-bundle'

export default dshClientBundle({
  id: 'example-dsh-plugin',
  entry: 'src/client/index.ts',
  outDir: 'lib',
  external: ['an-exact-module-table-request'],
})
```

适配器固定输出 `lib/client.js` 与 sourcemap，通过 `window.__ModuleLoader__.load({ id, factory })` 注册模块，并只将调用方明确列出的模块保留为外部 `require`。`pnpm test` 会执行真实 tsdown 产物并验证 watch 重建。
