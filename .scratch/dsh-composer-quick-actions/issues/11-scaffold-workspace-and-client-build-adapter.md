# 搭建可发布工作区与 Client 构建适配器

Type: task
Mode: AFK
Status: claimed
Blocked by: 07

## Question（问题）

按照[选择插件架构与软件包契约](./07-select-plugin-architecture-and-package-contract.md)搭建 pnpm workspace、`dsh-composer-quick-actions` 双面功能包与 `dsh-composer-quick-actions-bundle` 安装包骨架。实现 `tools/dsh-client-bundle`：使用 tsdown 产出 Client CJS，再包装成 DSH lazy-CJS ModuleLoader 产物；添加假的 ModuleLoader 契约测试，验证模块 ID、factory、`apply`/`inject`、externals、sourcemap 和 watch 输出。此任务只建立可构建、可测试、可打包的骨架，不实现快捷动作业务行为。
