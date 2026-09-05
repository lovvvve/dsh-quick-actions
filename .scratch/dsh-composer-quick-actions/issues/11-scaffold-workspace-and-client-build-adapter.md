# 搭建可发布工作区与 Client 构建适配器

Type: task
Mode: AFK
Status: resolved
Blocked by: 07

## Question（问题）

按照[选择插件架构与软件包契约](./07-select-plugin-architecture-and-package-contract.md)搭建 pnpm workspace、`dsh-composer-quick-actions` 双面功能包与 `dsh-composer-quick-actions-bundle` 安装包骨架。实现 `tools/dsh-client-bundle`：使用 tsdown 产出 Client CJS，再包装成 DSH lazy-CJS ModuleLoader 产物；添加假的 ModuleLoader 契约测试，验证模块 ID、factory、`apply`/`inject`、externals、sourcemap 和 watch 输出。此任务只建立可构建、可测试、可打包的骨架，不实现快捷动作业务行为。

## Answer（答案）

已建立根 pnpm workspace、共享 TypeScript/Vitest/Oxlint 配置及三个工作区成员：Host/Client 双面功能包 `packages/composer-quick-actions`、安装 bundle `packages/composer-quick-actions-bundle`，以及私有构建工具 `tools/dsh-client-bundle`。功能包公开 Host、Client、types、remote 四个可打包入口；bundle 通过 `cordis.patch.yml` 在全局 `web` profile 插入功能包。当前 Host 与 Client `apply` 均保持无业务行为的骨架，后续任务可在既定入口内实现领域逻辑。

`dshClientBundle()` 产出唯一 `client.js` 与可追溯到 TypeScript 行列的 sourcemap，并包装为 `window.__ModuleLoader__.load({ id, factory })`。构建在 Rolldown input 层强制 browser platform，同时覆盖现代 conditional exports 与 legacy `browser` 字段；内部动态 import 被内联，只有调用方声明的静态 external 才能成为 factory 的直接 `require`。未声明 package/builtin、外部动态 import、计算型或间接 `require` 都在构建期失败。Client 先写入 final outDir 的 sibling staging，完整成功后按 map→JavaScript 顺序通过临时文件替换；失败 watch 保留 byte-identical last-good，修复源文件后可继续发布。watch 子进程测试会等待关闭，不遗留后台进程。

TDD 首先让 2 个真实 tsdown/ModuleLoader 测试因 `dshClientBundle is not implemented` 而失败，再实现最小 GREEN；四轮独立审查发现的 browser platform、未解析导入、code splitting、动态模块边界、watch 发布和 `require` 引用逃逸均各自先以失败回归测试复现后修复。最终独立审查为 Standards 0、Spec 0。新鲜验证结果为：12/12 测试通过，生产代码、测试和 `tsdown.config.ts` 类型检查通过，Oxlint 0 warning / 0 error，clean build 生成 Host ESM 与单一 lazy-CJS Client 且清除 staging；两个 tarball 解包后全部 exports 可解析，Host 与假的 ModuleLoader Client 可执行，workspace 依赖被重写为 `0.0.0`，bundle patch 存在并指向正确功能包。

实施提交为 `9f3dcf7`、`34c5072`、`23c0334`、`621195d` 与 `5a62944`。发布名称、正式版本与许可证没有在本任务中擅自决定；包保留 `0.0.0` 骨架值，交由后续发布身份决策收敛。
