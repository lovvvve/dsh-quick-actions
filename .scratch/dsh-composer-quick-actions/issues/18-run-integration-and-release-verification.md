# 执行集成与发布验证

Type: task
Mode: AFK
Blocked by: 08, 13, 14, 15, 16, 17

## Question（问题）

依据[定义验证与发布验收标准](./08-define-verification-and-release-acceptance.md)和[统一规格](../spec.md)（首版范围以 spec 第 16 节为准）执行完整自动化与 GUI 验收：构建产物、Host/Client 集成、三种布局、输入框等宽、宽窄响应式、发送确认与单飞、模型运行时 queue、失败草稿恢复、Settings 重启持久化、预置升级/降级、Host Config 变化、断线恢复、生命周期 stop/update 清理、占位符拒绝、Unicode code point/`trim()` 口径、结构化 Settings mutation outcome（成功/拒绝/conflict）、单飞窗口的公开状态判据与快速连续激活不重复发送、Resident Composer 公开判定、安装包和文档步骤。

**GUI 验证只有一个通道**：现有 `http://127.0.0.1:3080` 官方 DSH GUI，覆盖三种布局、紧凑管理入口、动作管理与持久化、发送动作经公共 `setDraft` + `submit` 完成，以及写入后失败草稿保留。首版不依赖 `insertText`，因此**不再创建隔离源码检出、不再应用核心补丁、不再启动第二个受管 GUI 服务器**；插入相关用例（选区、焦点、连续插入、撤销、能力 false→true→false 投影）随插入动作一并推迟。不得修改已安装 `node_modules`。

Command Send Action（命令发送动作）必须覆盖：`/` 开头判定、`confirm` 默认开启且可关闭、表单给出警示但不锁定、确认开启时面板包含无候选菜单说明、确认关闭时一键提交不弹面板、两种设置下执行路径与普通发送动作完全一致，以及关闭确认后重复规范化/重启/预置升级都不把 `confirm` 改回 `true`。

使用 0、1、6、25、50 个动作覆盖正常规模，并验证升级或 Host Config 变化形成的 53 个既有动作的无损超限降级；隐藏与停用动作计入这些规模。必须覆盖公开附件字段的已占用草稿判定。截图基线覆盖三种布局与桌面/窄布局。修复发现的缺陷并保存可复现证据。本票据到「自动化证据完整」为止，可全程 AFK 执行；最终人工验收由 [HITL 票据 21](./21-run-final-human-acceptance.md) 承担，地图目标由该票据而非本票据收尾。


## Comments（评论）

### 2026-09-08 — Catalog 通道改为 Settings base 层

spec 第 17 节取代第 6.2 节：目录不再经自有 Remote 发布，改由 Host 注册只读命名空间 `composer-quick-actions-catalog` 并以 composition `base` 层承载快照。本票据相应调整：

- 去掉「自有 Catalog Remote 契约、生成产物和卸载清理」验证项，改为「目录命名空间注册、`base` 快照契约与卸载清理」。
- 去掉按连接 generation 计目录 RPC 的用例，改为断言目录不产生专用 RPC。

### 2026-09-08 — 收口前需确认票据 22

票据 17 在核实 spec 第 15 节的两条前置项时发现「watch 关闭不得遗留临时 staging」（第 11.2 节）并不成立，已拆为[票据 22](./22-clean-client-staging-on-watch-close.md)。它属于第 11.2 节的发布要求，本票据的发布验证**收口之前**必须确认票据 22 已完成；`Blocked by` 未改动，因为本票据的其余验证不依赖它，可以并行推进。

同时，票据 17 已按 spec 第 13.1 节建立 `verification/release-evidence.md`，其中记录了本票据需要接续的内容：两个 tarball 的可复现解析方式、隔离 `DSH_HOME` 下的安装/卸载证据，以及尚未做的真实 GUI 实测清单。本票据应向该文件追加证据，而不是另起一份。
