# 完成安装 Bundle 与发布文档

Type: task
Mode: AFK
Blocked by: 15, 16, 20

## Question（问题）

完成安装 bundle 的 `dsh.bundle.patch`、功能包 exports、`dsh.client` 声明、包依赖与 peer range；最终名称、scope 和安装命令一律采用[票据 20](./20-choose-publishing-identity-and-license.md)确定的发布身份，不得把脚手架无 scope 名称当作发布决策。验证正式安装、本地 tarball 安装和重启激活；本地/离线安装必须明确两个 tarball 的可复现解析方式并在证据中说明，不得假设 bundle tarball 内嵌功能包。补齐中文/英文 README：配置预置、三种布局、Settings 路径、开发 build/watch、现有 GUI HMR 前置和卸载/升级流程。首版功能说明按 spec 第 12、16 节撰写——只提供发送动作，静态文本经公共 `setDraft` + `submit` 走官方提交路径；**不提供插入动作**，该能力待公共 `insertText` 可用后另建 effort，README 不得再出现能力矩阵或兼容性抑制说明。peer range 覆盖公开 `setDraft` 与 `submit` 的受支持 DSH。

README 必须单列 Command Send Action（命令发送动作）：`/` 开头文本合法，确认默认开启且可关闭；启用确认时面板展示最终提交内容但**不会**出现 DSH 原生 `/` 候选菜单，关闭确认后命令一键提交、无预览。命令一律由官方路径裁决——这是已知并接受的取舍（spec 第 16.2 节）。正式首发版本未知时不得虚构最低 DSH 版本。不得要求修改 Agent preset。
