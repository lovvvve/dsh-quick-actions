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

适配器固定输出唯一的 `lib/client.js` 与 sourcemap，通过 `window.__ModuleLoader__.load({ id, factory })` 注册模块，并只将调用方明确列出的静态 import 保留为外部 `require`。构建在 Rolldown input 层强制 browser platform，将内部动态 import 内联到同一产物；外部动态 import、计算型 require、未声明 builtin 和未解析 import 均使构建失败。产物先写入相邻 staging 目录，仅在完整成功后发布 map 与 JavaScript，因此失败的 watch 重建不会覆盖 last-good Client。`pnpm test` 会执行真实 tsdown 产物并验证这些边界及 watch 恢复。
