# 实现 Client 快捷动作控制器

Type: task
Mode: AFK
Blocked by: 13

## Question（问题）

实现 Client `QuickActionsController` 深模块：首次连接及重连读取权威预置目录，绑定 `settingsScope`，维护目录、最后确认的 Settings 快照、写入队列和全局管理面板状态；通过共享领域模型生成解析视图和 revision-fenced mutation。按规格第 15 节决定，实现并消费扩展后的 `SettingsScope` 结构化 mutation outcome（成功/拒绝/conflict），失败时触发恢复读取，实现失败回填表单、冲突重确认。权限边界遵循 spec 第 6.3 节：不得拥有迁移权威、不绕过 Settings。首次读取失败、短暂断线、只读 Settings、写入拒绝与 revision 冲突必须符合已决定语义。控制器不得持有 Session、InputState、Slot props 或 `InputActions` 活对象，并须以 disposer 清理 binding、连接监听和订阅。


## Comments（评论）

### 2026-09-08 — Catalog 通道改为 Settings base 层

spec 第 17 节取代第 6.2 节：目录不再经自有 Remote 发布，改由 Host 注册只读命名空间 `composer-quick-actions-catalog` 并以 composition `base` 层承载快照。本票据相应调整：

- Client 通过 `ctx.settingsScope.bind()` 绑定目录命名空间并读取 **`base`**（不是 `value`），不再调用 `remote.composerQuickActions.describeCatalog()`。
- 「每个连接 generation 至多一次目录 RPC」改为**不得为目录发起任何专用 RPC**：绑定从共享 settings mirror 派生，不产生额外 wire 读取；目录随 mirror 在 `connection/reset` 后自动刷新。
- 仍须用共享领域模型防御性解码该快照。
- 待办：Client 侧读取 `base` 的端到端行为需在有活动 GUI 页面的前台会话实测后才能宣称可用。
