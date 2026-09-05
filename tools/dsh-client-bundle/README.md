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

适配器固定输出唯一的 `lib/client.js` 与 sourcemap，通过 `window.__ModuleLoader__.load({ id, factory })` 注册模块，并只将调用方明确列出的模块保留为外部 `require`。构建使用 browser conditional exports，将动态 import 内联到同一产物，并把未解析 import 等 warning 视为失败。`pnpm test` 会执行真实 tsdown 产物并验证 watch 重建。
