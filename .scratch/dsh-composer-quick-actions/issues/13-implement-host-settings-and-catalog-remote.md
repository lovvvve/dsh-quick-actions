# 实现 Host Settings 与预置目录 Remote

Type: task
Mode: AFK
Status: claimed
Label: needs-info
Blocked by: 12

## Question（问题）

实现 Host 插件入口：验证并合并内置预置与 `Config.presets`，注册 `composer-quick-actions` Settings namespace，执行兼容读取后的幂等 revision-fenced 规范重写，并发布仅含 `describeCatalog(): Promise<CatalogSnapshot>` 的生成式 `remote.composerQuickActions`。按规格第 6.1 节使用 `@deepseek-ai/dsh-settings-file` 后端；Host 独占验证与迁移权威，绝不绕过 Settings 访问原始文件或 storage backend。所有注册、观察器和 Remote 必须归 Host fiber；`settings` 缺失时进入等待，不创建替代存储。预置校验复用票据 12 的共享模型：预置不声明 `kind`，规范化统一写出 `'send'`；`Config.presets` 中出现非 `'send'` 的 `kind`（含 `'insert'`）时按 spec 第 5.1 节使插件配置加载失败，不得静默忽略；声明 `/` 开头文本的预置为 Command Send Action（命令发送动作），其 `confirm` 按作者声明值保留——包括显式的 `false`，规范化不得依据文本改写它（spec 第 4.3、16.1 节）。覆盖重复 ID、超过 50 个预置、无效配置、迁移冲突、重启后预置变化和 Remote JSON 契约测试；基于目标 DSH 实际生成式/运行时契约证明 Remote 装配可用，在关键装配契约核实前不声称 Remote 已可用。

## Comments（评论）

### 2026-09-07 — Host 半部已交付；Catalog Remote 因装配契约受阻，等待范围决策

**票据保持 `claimed` 未 resolve**，因为 spec 第 6.2 节的 Remote 尚未发布。标记 `needs-info`：需要用户在下列方案中选择后才能继续。

#### 已交付（Host）

- `src/host/presets.ts` — 内置预置清单（当前为空，见下方待决项 2）。
- `src/host/config.ts` — 内置清单与 `Config.presets` 合并，复用票据 12 的共享模型；非法预置、重复 Preset Action ID、非 `'send'` 的 `kind`、目录超过 50 项一律使配置加载失败，并一次性列出全部问题及其 `source`/`index`/`id`/`field`/`reason`。`/` 开头预置按作者声明保留 `confirm`（含显式 `false`）。
- `src/host/settings.ts` — `composer-quick-actions` namespace、宽松注册 schema、revision-fenced 幂等规范重写。
- `src/host/index.ts` — 目录装配与 `describeCatalog()` 载荷构造（无损 JSON、只读、每次返回脱离副本）。
- `src/index.ts` — `apply(ctx, config)`，`inject: ['settings']`，重写结果的上报归 Host fiber 所有。

规范重写的三条边界经审查后修正并以测试固定：**未存储任何内容时不写**（否则会把默认值固化进 user 层，遮蔽 composition `base` 并摧毁 `replace({})` 的重置语义）；**`schemaVersion > 1` 时不写**（否则降级会把自己的版本号盖在不属于它的数据上，违反 spec 第 5.3、16.1 节）；**比较用结构相等而非序列化文本**（否则存储 YAML 的键序差异会让每次启动都误判为有变化，破坏幂等）。

#### 受阻（Catalog Remote）

核实证据见 [`research/catalog-remote-assembly.md`](../research/catalog-remote-assembly.md)。结论：**已发布的 `@deepseek-ai/dsh-typert-generator@0.1.2-rc.1` 无法为 DSH 单仓之外的软件包生成 strict Remote 产物**——它要求 `@Remote` / `TypertRemoteService` 符号的声明文件属于 `<root>/packages/` 下已注册的 workspace 包，而第三方包只能从 `node_modules` 消费协议包。而 Client `ctx.remote.$mount()` 强制要求 strict generated codec。

按本票据自身的守卫条款「在关键装配契约核实前不声称 Remote 已可用」，不予实施、不予宣称。

#### 待用户决策

1. **Remote 路径**（阻塞票据 14）：
   - (a) 改用运行时注册：手写 descriptor 经公共 `ctx.typert.register` / `ctx.remote.$mount` 发布。已核实两侧校验都能通过（strict codec 只检查存在 `parse` 方法）。代价是 wire 契约不再由 TypeScript 类型派生、漂移无编译期防护，且与本票据「生成式」措辞不符；Client `$mount` 端到端仍需前台 GUI 会话实测。
   - (b) 等待 DSH 让生成器可在单仓外使用（不可控，且与 spec 第 16 节「不新增核心接口依赖」的精神相悖）。
   - (c) 修订 spec 第 6.2 节，改用其他已支持的 Host→Client 通道。
2. **内置预置清单是否留空**：预置的标签与文本是特定语言的产品文案，属产品决策。当前留空，部署方通过 `Config.presets` 声明。若留空，票据 21 的人工验收需先配置至少一个预置才能验证隐藏与克隆。
