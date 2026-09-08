# 实现 Client 快捷动作控制器

Type: task
Mode: AFK
Status: resolved
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

## Answer（答案）

Client `QuickActionsController` 已交付（`src/client/controller.ts`），并由 `src/client/index.ts` 以 `ctx.effect` 归 Client fiber 所有。Slot 注册、布局与会话执行仍属票据 15/16。

**目录通道**：按 spec 第 17 节，`ctx.settingsScope.bind()` 绑定 `composer-quick-actions-catalog` 并读 **`base`**、不读 `value`——用户手工写出同名 section 也无法遮蔽作者定义（有测试固定）。目录 RPC 次数为 **0**：两个绑定都从共享 settings mirror 派生，`describeReads` 在初始化后仍为 0（有测试固定）；目录随 mirror 在 `connection/reset` 后自动刷新，Host 重启发布的新目录被直接读到。快照用共享模型新增的 `decodeCatalogSnapshot` 防御性解码：全或无，任何读不全的快照报告目录错误而非静默截断的目录（对齐第 5.1 节）。

**结构化写入结果（成功/拒绝/conflict）**：第 15 节决定 4 原文要求「扩展 `SettingsScope`」，但 spec 第 16.4 节「**首版不新增任何 DSH 核心接口**……首版**没有剩余的核心契约依赖**」按第 1 节优先于第 15 节，且已发布的 `SettingsScope.mutate` 返回 `void`。因此改为**在插件内部**基于 scope 写后发布的权威快照判定，不动 DSH 核心：

- 存储状态回读等于本次计划 → 成功；
- 命名空间 revision 变到别处 → `conflict`（刷新后要求重新确认）；
- 其余 → `refused`。

判据对已发布实现成立：`SettingsScopeController.mutate` 只在 `mirror.acceptView(response.value)`（成功）或 `recover()` → `mirror.load()`（拒绝）之后才 resolve。**已知边界**（已写进代码注释）：若拒绝之后的恢复读取本身也失败，丢栅栏与拒绝无法区分，按 `refused` 报告；该窗口内连接已断、界面本就只读，且用陈旧栅栏重试只会再次被拒，不会覆盖赢得竞态的写入。

**第 10 节状态**：首次目录读取失败 → `catalog: { status: 'error', reason: 'unreadable' }` + `refresh()` 重试（失败只在 mirror 快照上可见，scope 快照看不到，因此控制器同时订阅 mirror）；目录可读但 Settings 命名空间缺失 → 显示权威预置目录、管理只读；provider 不可写或页面被保持进程内 → 只读；断线 → 继续服务最后一次 Host 确认的快照并只读；重连 → 解除 stale，但**不**替用户清掉尚未处理的失败。写入失败一律先回权威快照再报告，抛错分支自己补一次恢复读取。

**其他**：串行写入队列（第二个计划读得到第一个的结果）；无变化的计划不发 RPC；UUID 冲突重铸（最多 4 个 id）；被动超限只关新增/克隆，编辑、停用、删除、隐藏、排序仍可用；快照在无实质变化时保持同一引用（`useSyncExternalStore` 安全）。控制器不持有 Session、InputState、Slot props 或 `InputActions`；`dispose()` 释放 mirror/两个 scope 订阅与连接监听，scope binding 由 binder 注册在同一 fiber 上一并撤销。

**规格修订**：第 7.3 节 Client 依赖清单改为 `slots`、`settingsScope`、`connection`、`locale`（`remote.composerQuickActions` 已由第 17 节作废，`remote.settings` 由 `settingsScope` 内部持有）。`connection` 是第 10 节连接 generation 与断线只读语义的来源，`inject` 硬依赖它。

**新鲜验证**：`pnpm typecheck` 两遍通过、`pnpm lint` 0/0、`pnpm test` 234/234、清理 `lib/` 后 `pnpm build` 通过；Client bundle 在假 ModuleLoader 下加载成功、`require` 调用 0 次、导出 `apply`/`inject`/`name`。经 Standards + Spec 双轴审查并逐条处置。

**未交付/待办**：Client 端读取 `base` 的真实 GUI 行为仍未实测——`packages/composer-quick-actions` 尚未安装进运行中的 DSH，也没有界面可触发。该实测归票据 18（集成验证），在有活动 GUI 页面的前台会话执行；在此之前不得宣称目录通道在真实 DSH 中已可用。
