# 将 insertText 补丁集成到 DSH 官方发布

Type: task
Mode: HITL
Status: resolved
Blocked by: 10

## Question（问题）

将[公开 DSH 消息编辑器 insertText 接口](./10-publish-dsh-composer-insert-text-api.md)产出的已审查补丁应用或重放到 DSH 官方仓库当前目标分支，创建上游 PR，完成所需 CI 与维护者审查并合并。记录首个正式包含 `inputActions.insertText(text: string): void` 的 DSH 发布版本；随后更新快捷动作功能包的 README、兼容矩阵和最终安装验证。不得把本地补丁提交哈希冒充正式发布版本，也不得以修改已安装 `node_modules` 代替上游集成。

## Comments（评论）

### 2026-09-05 — 已完成当前主线重放，等待上游协作入口

补丁已重放到官方 `master` 的 `d347e703908d0406b7a7ef80e3a0e594d86b2215`（`dsh-v0.1.3-alpha.1`），适配当前通用附件 API，并产出[当前基线补丁](../core/0001-expose-public-text-insertion-dsh-v0.1.3-alpha.1.patch)。行为测试、GUI 测试、Host/Client 构建与类型检查、变更 lint、完整文档同步、发布卫生、bundle/pack 和 tarball 契约均已通过；完整证据与人工步骤见[上游集成状态](../core/upstream-integration-status.md)。

当前不能创建票据要求的上游 PR：官方贡献说明明确暂不接受外部 PR，仓库已关闭 Pull Requests；当前 GitHub 身份 `lovvvve` 对官方仓库无推送权限，也没有可用 Fork 或 GitHub API 凭据。

## Answer（答案）

本票已随首版目标重划而关闭为范围外工作，不作为路线中的已完成决策。首版以运行时能力而非尚未确定的正式 DSH 版本作为兼容边界：当前 DSH 提供公共 `inputActions.insertText(text)` 时启用插入动作；缺失时，这些动作成为 Compatibility-Suppressed Insert Action（兼容性抑制插入动作），不进入常驻消息编辑器的动作列表，但完整保留在管理界面，允许创建、克隆和编辑，计入 50 个动作总上限，并在能力出现后自动恢复。过滤后没有可执行动作时，三种布局仍保留紧凑管理入口。发送动作在最终重验草稿未占用后装载文本：公共 `insertText(text)` 存在时使用它，缺失时仅为发送使用公共 `setDraft(text)`，随后调用公共 `submit()`；`setDraft` 不得成为插入动作回退，写入后的异常必须保留草稿且不自动重试。确认、管理和持久化不受影响。

发布验收采用双通道：现有官方 DSH GUI 证明兼容性抑制、集中兼容提示、管理、持久化和发送路径；[当前主线补丁](../core/0001-expose-public-text-insertion-dsh-v0.1.3-alpha.1.patch)应用到隔离源码检出后，由受管后台任务在明确的独立 URL 提供真实 GUI，以证明插件的选区插入、焦点和撤销等完整能力路径。补丁的重放与验证证据见[上游集成状态](../core/upstream-integration-status.md)，但本地提交与 `dsh-v0.1.3-alpha.1` 均不得冒充首个正式包含该接口的版本。

没有创建上游 PR、运行上游 CI、取得维护者审查、合并或记录正式首发版本。待官方开放外部贡献入口或维护者确认内部接手后，这些工作应建立新的独立 Wayfinder effort，而不是重新打开本地图。
