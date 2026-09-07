# 执行集成与发布验证

Type: task
Mode: AFK
Blocked by: 08, 10, 13, 14, 15, 16, 17

## Question（问题）

依据[定义验证与发布验收标准](./08-define-verification-and-release-acceptance.md)和[统一规格](../spec.md)执行完整自动化与双 GUI 通道验收：构建产物、Host/Client 集成、三种布局、输入框等宽、宽窄响应式、插入选区与焦点、发送确认与单飞、模型运行时 queue、失败草稿恢复、Settings 重启持久化、预置升级/降级、Host Config 变化、断线恢复、生命周期 stop/update 清理、占位符拒绝、Unicode code point/`trim()` 口径、结构化 Settings mutation outcome（成功/拒绝/conflict）、最小公开提交凭据、Resident Composer 公开判定、安装包和文档步骤。验证分为两个必过通道：现有 `http://127.0.0.1:3080` 官方 DSH GUI 覆盖兼容性抑制插入动作、紧凑管理入口、集中兼容提示、插入动作管理/持久化，以及发送动作经公共 `setDraft` + `submit` 完成且绝不调用缺失 `insertText` 的路径；完整能力通道从官方基线创建隔离源码检出、应用已验证补丁，并用受管后台任务启动和记录独立测试 URL，在该 URL 覆盖真实插件的插入选区、焦点、连续插入与撤销、发送经公共 `insertText` + `submit` 的路径，以及写入后失败草稿保留。不得修改已安装 `node_modules`，也不得把独立服务器冒充当前 GUI。使用 0、1、6、25、50 个动作覆盖正常规模，并验证升级或 Host Config 变化形成的 53 个既有动作的无损超限降级；兼容性抑制动作始终计入这些规模。两条基线都必须覆盖各自公开附件字段的已占用草稿判定。另以完全相同的 Settings 快照、动作 ID 与顺序执行 `insertText` 能力 false→true→false 投影，验证插入动作无需持久化写入或迁移即可从 Composer 省略、按原顺序自动恢复、再次省略，期间管理数据、计数和顺序均不变。截图基线覆盖三种布局与桌面/窄布局。修复发现的缺陷并保存可复现证据；自动化证据完整后进入 HITL 阶段，由用户明确回复“生产验收通过”才能完成地图目标。
