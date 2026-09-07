# 公开 DSH 消息编辑器 insertText 接口

Type: task
Mode: AFK
Status: resolved
Blocked by: 09

## Question（问题）

在 `@deepseek-ai/dsh-client-ui-conversation` 的公共 `InputActions` 契约中实现并验证同步的 `insertText(text: string): void`。该接口必须直接复用现有私有 `paste(text)` 的占位符清理、选区替换、无选区末尾回退、富内容保留和独立撤销边界语义；更新相关类型、生成式 Inspect/Slot 契约、测试及版本记录。不得新增 options、返回值、DOM/Lexical 绕过或覆盖所有消息编辑器的外层 Slot。记录首次包含该接口的 DSH 版本，以供快捷动作插件声明完整功能的兼容边界。

## Answer（答案）

已从官方标签 `dsh-v0.1.2-rc.1`（提交 `a66e4702047846cdaa10c66c9d3df3951f5ea70d`）创建源码分支 `dsh/insert-text-api`，并在提交 `5ee80be58d592d56ad9e163b5e11bc23d5b9f2a9` 实现、测试和审查该公共接口。可应用的完整上游补丁保存在 [`../core/0001-expose-public-text-insertion.patch`](../core/0001-expose-public-text-insertion.patch)，复现命令与结果保存在 [`../core/insert-text-verification.md`](../core/insert-text-verification.md)。没有修改会被升级覆盖的已安装 `node_modules`。

`InputActions` 新增同步 `insertText(text: string): void`，稳定 action 直接委托现有 `SessionInputShell.paste(text)`。因此占位符清理、范围选区替换、无选区末尾回退、未触及富节点保留和 `PASTE_TAG` 独立撤销边界仍只有一个实现。编辑器、Lexical 节点、选区对象和内部 `ComposerKeyboard` 均未进入新接口；没有增加 options、结果、提交行为或外层 Slot。

TDD 先观察到 6/6 新测试因接口不存在而失败，再以两行最小生产改动获得 6/6 通过。把委托变异成 `setDraft` 后，4 个关键行为测试按预期失败。最终验证包括：ui-conversation 31 个文件、359 个测试全部通过；`test:gui` 282 个文件通过、1 个既有文件跳过，3906 个测试通过、4 个既有测试跳过；完整 Client 类型检查、Host/Client 构建、包 bundle/pack、生成目录检查、公开 JSDoc、双语文档、Agent Note、doc-quick、lint 与 hygiene 均通过。独立代码审查无 Critical 或 Important 问题，唯一文档 Minor 已修正。

该源码提交尚未进入 DSH 官方发布，不能虚构最低正式版本。上游 PR、合并和首发版本记录已拆分为[将 insertText 补丁集成到 DSH 官方发布](./19-upstream-insert-text-and-record-release.md)；快捷动作插件在此之前继续以运行时能力检测降级。

## Comments（评论）

### 2026-09-05 — 补丁已重放，正式上游发布移出首版范围

补丁已重放到官方 `master` 的 `d347e703908d0406b7a7ef80e3a0e594d86b2215`（`dsh-v0.1.3-alpha.1`），当前基线补丁和新鲜验证见[上游集成状态](../core/upstream-integration-status.md)。[将 insertText 补丁集成到 DSH 官方发布](./19-upstream-insert-text-and-record-release.md)现已关闭为本地图范围外工作；插件首版使用能力自适应兼容，而不是等待正式上游版本。
