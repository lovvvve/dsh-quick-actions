# 选择插件架构与软件包契约

Type: grilling
Mode: HITL
Status: resolved
Blocked by: 02, 03, 04, 05, 06

## Question（问题）

根据已经研究的 DSH 扩展点和已批准的产品交互，应采用哪种架构和可安装软件包契约来实现快捷动作？请确定 Host/Client 划分、预置快捷动作的注册边界、插件自有的数据模型、私有 RPC 或 Service 接口、Slot 组件、可撤销的生命周期 effect、持久化适配器、迁移策略、错误边界、源码模块边界，以及任何范围严格受限的 DSH 核心前置条件。

## Answer（答案）

### 软件包与安装

仓库采用 pnpm workspace，发布两个独立包：

- `dsh-composer-quick-actions` 是 Host+Client 双面的功能包，公开根入口、`./client`、`./types`、`./remote` 和 `./package.json`。
- `dsh-composer-quick-actions-bundle` 只负责 `dsh.bundle.patch`，依赖并向全局 web profile 插入功能包 Host row。

规范安装入口为 `dsh plugin --profile web add dsh-composer-quick-actions-bundle`，随后重启 profile。开发和离线安装同时支持 `pnpm pack` 生成本地 tarball。该能力属于全局 Host composition，不进入 Agent preset。未来增加 npm scope 只改变发布名，不改变双角色架构。

### Host、Client 与共享领域模块

Host 负责合并并验证软件包内置预置与 Host `Config.presets`，注册唯一的 `composer-quick-actions` Settings namespace，执行旧数据的兼容读取与规范重写，并提供权威的只读预置目录。Host 配置中的预置变更按 DSH 重启生效。

Client 通过 `settingsScope` 使用 Host 权威用户状态，读取预置目录，解析当前可见动作，注册 A/B/C 布局、管理面板和会话动作执行。它不复制 Host 业务规则，也不直接写文件或使用浏览器持久化。

共享 `src/model/` 是深模块：以纯 JSON 输入输出集中负责类型、配置与设置验证、版本迁移、确定性规范化、预置与用户状态合并，以及 Settings mutation 计划。Host 负责权威验证和迁移；Client 只防御性解码共享模型产生的快照并提交 mutation，绝不拥有迁移权威。

### 最小 Remote

Host 仅公开一个生成式只读 Remote，不复制 Settings CRUD，也不提供第三方运行时预置注册：

```ts
interface CatalogSnapshot {
  schemaVersion: 1
  revision: string
  presets: PresetQuickAction[]
}

describeCatalog(): Promise<CatalogSnapshot>
```

`revision` 由规范化后的目录确定。Client 在首次连接和连接重建时读取目录。用户状态继续直接通过 `settingsScope` 的 revision-fenced `set`、`unset` 和 `mutate` 写入，不引入只有一个实现的通用 Repository，也不使用 `storageDomain`。

### Client 控制器与会话局部状态

一个 Client `QuickActionsController` 深模块拥有目录、Settings 已确认快照、写入队列和全局管理面板状态，为所有 Slot 提供同一事实来源。每个会话 Slot 自行拥有发送确认、单飞锁和当前 `InputActions`，并随组件卸载销毁。任何 Session、InputState、Slot props 或 `InputActions` 活对象都不得进入全局长期状态。

`conversation.input.dock` 与 `conversation.composer.dock` 始终注册，但根据全局 `layout` 只有对应入口渲染；管理 overlay 单独注册。局部视图使用 DSH UI primitives、主题 token、CSS module 和 `locale` 中英文词典，不覆盖全局主题。emoji 只作装饰，文本或 `aria-label` 承担无障碍名称。

每个 Slot 入口由局部错误边界保护，失败仅替换快捷动作区域并允许重试，不能破坏消息编辑器。首次目录读取失败时不渲染动作并在管理入口显示错误；成功加载后的断线保留最后确认目录和用户状态。管理、确认和会话执行错误彼此隔离，DSH 官方提交错误不被捕获或替换。

### 生命周期与依赖

Host 对 `settings` 使用硬依赖；缺失时等待，不创建替代存储。Settings namespace、目录 Remote 和观察器全部归 Host fiber。Client 依赖 `slots`、`settingsScope`、`remote.composerQuickActions` 和 `locale`；Settings binding、连接监听、Slot 注入、样式和所有订阅均返回 disposer 并归 Client fiber。组件局部 effect 同样在卸载时清理。

完整插入功能依赖[公开 DSH 消息编辑器 insertText 接口](./10-publish-dsh-composer-insert-text-api.md)。功能包保持较宽的兼容 peer range，并运行时检测 `inputActions.insertText`；旧版仅禁用插入动作，而不让整个插件安装失败。核心接口发布后，README 记录完整功能最低 DSH 版本。

### 源码与构建接口

源码按承担独立复杂度的深模块组织：

- `src/model/`：共享领域模型。
- `src/host/`：配置、Settings 与目录 Remote。
- `src/client/controller.ts`：Client 全局快照与管理状态。
- `src/client/surfaces/`：A/B/C 与共享动作控件。
- `src/client/manager/`：动作面板、管理面板和编辑表单。
- `src/client/session/`：每会话确认、单飞和执行。
- `src/client/index.tsx`：生命周期装配与 Slot 注册。
- `src/locales/`、`src/styles/`：词典和局部样式。

Host 构建输出标准 ESM。由于 DSH 的 `clientBundle` preset 未发布，仓库在 `tools/dsh-client-bundle` 提供一个最小构建适配器：先通过 tsdown 生成 Client CJS，再包装为 `window.__ModuleLoader__.load(...)`。产物契约测试在假的 ModuleLoader 中执行 bundle，并验证模块 ID、factory、`apply`/`inject`、externals 和 sourcemap。开发命令提供 Client watch；现有 GUI 的 HMR 仍以 watcher 持续重建 `lib/client.js` 为前提。内部 controller、构建细节和第三方预置注册接口均不进入公共导出。

### Settings 迁移

Host 用向后兼容 schema 注册所有已发布旧状态，随后执行幂等、带 namespace revision fence 的规范重写。Client 只解码已确认状态。若未来旧数据已无法通过当前注册 schema 读取，则需要单独推进 DSH 验证前迁移钩子；首版不通过原始文件或 storage backend 绕过 Settings。

## Comments（评论）

### 2026-09-05 — 包兼容契约改为能力自适应

[将 insertText 补丁集成到 DSH 官方发布](./19-upstream-insert-text-and-record-release.md)替代“旧版仅禁用插入动作并等待正式最低版本”的呈现与发布前提。较宽 peer range 和运行时能力检测不变；缺少公共插入能力时，Client 从 Composer 投影省略兼容性抑制插入动作，在管理界面保留其配置与计数，并继续提供发送动作。发送动作在最终空草稿重验后，能力存在时使用公共 `insertText` 装载文本，缺失时仅为发送使用公共 `setDraft`，两者随后都调用公共 `submit`；插入动作绝不使用 `setDraft` 回退。README 按能力矩阵描述这两条路径，在正式版本未知时不声明最低版本。

---

**已被 spec 第 16 节部分取代（首版范围收缩）。**

- 「运行时检测 `inputActions.insertText`」「旧版仅禁用插入动作」「README 按能力矩阵描述两条路径」「核心接口发布后记录完整功能最低 DSH 版本」：**首版不再适用**。首版不提供插入动作、不做任何能力检测，peer range 只覆盖公开 `setDraft` 与 `submit`，README 不再出现能力矩阵。
- 双面功能包 + 安装 bundle 的架构、Host Settings 与只读目录 Remote、共享领域深模块、局部会话执行、仓库自有可测试 Client 构建适配器：**全部仍然有效**，本次收缩不改变架构结论。
