# 完成安装 Bundle 与发布文档

Type: task
Mode: AFK
Blocked by: 15, 16, 20

## Question（问题）

完成安装 bundle 的 `dsh.bundle.patch`、功能包 exports、`dsh.client` 声明、包依赖与 peer range；最终名称、scope 和安装命令一律采用[票据 20](./20-choose-publishing-identity-and-license.md)确定的发布身份，不得把脚手架无 scope 名称当作发布决策。验证正式安装、本地 tarball 安装和重启激活；本地/离线安装必须明确两个 tarball 的可复现解析方式并在证据中说明，不得假设 bundle tarball 内嵌功能包。补齐中文/英文 README：配置预置、三种布局、Settings 路径、开发 build/watch、现有 GUI HMR 前置和卸载/升级流程，以及按运行时能力表达的兼容矩阵——当前 DSH 缺少公共插入能力时省略兼容性抑制插入动作但保留管理、持久化和经公共 `setDraft` + `submit` 的发送，能力存在时启用完整插入并以公共 `insertText` + `submit` 发送。正式首发版本未知时不得虚构最低 DSH 版本；已验证补丁只能列为能力路径测试基线。不得要求修改 Agent preset。
