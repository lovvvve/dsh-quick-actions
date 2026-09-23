# 适配 DSH 0.1.7 的 Settings 模型重写

Type: task
Mode: AFK
Status: resolved
Blocked by: none

## Question（问题）

DSH `0.1.7-alpha.1` 把 Settings 从「插件自注册 namespace + `settings.yaml`」重写为「插件 Config 即表单」（`SettingsForms`），插件在新版上 Host 直接激活失败。调研新模型，定出本插件的持久化与目录承载方式，然后适配。

### 症状

用户在 dsh-tauri 上报告：

```text
dsh: warning: 1 entry did not activate
composer-quick-actions (dsh-quick-actions): TypeError: settings.register is not a function
    at startQuickActionsHost (.../dsh-quick-actions/lib/index.js:694:11)
    at new apply (.../dsh-quick-actions/lib/index.js:718:15)
```

### 初步取证（2026-09-23，逐版 `npm pack` 对比已发布声明）

| 包 | `0.1.5-rc.1`～`rc.3`、`0.1.6-alpha.*` | `0.1.7-alpha.1` / `alpha.2`（2026-09-22） |
|---|---|---|
| `@deepseek-ai/dsh-settings` | `SettingsProvider.register(ns, schema, {base, applies})` | `SettingsForms`，**无 `register`**；ns = profile entry id，值 = 插件 Config 的 volatile 字段；`applies` 只剩 `'live'`；旧 `settings.yaml` 在 Loader 就绪后被导入 active profile 并改名 |
| `@deepseek-ai/dsh-client-ui-settings` | Client `settingsScope` | **`settingsScope` 删除**，只剩 `ConfigForms` 与 describe mirror |

`>=0.1.5-rc.1` 的 peer 下界按 node-semver 匹配不到 `0.1.7-alpha.*`（spec 第 21.4 节），安装只报 peer 警告、拦不住。

受影响的已闭合决策：spec 第 17 节（目录走只读 Settings namespace 的 `base` 层）、第 10 节（Client 经 `settingsScope` 读写、带预期 revision）、第 16.4 节 / 票据 14（写后权威快照判定结果）。

### 待调研

1. 新模型下插件如何声明可编辑状态（Config schema 的 volatile 标记）、写入路径、revision 与冲突语义、Host 侧如何观察变化。
2. Client 侧读写面：`ConfigForms` / describe mirror / `remote.settings` 的形状，是否仍可按 revision 围栏写入。
3. 目录（Preset Catalog）改由什么承载：Config 本身（非 volatile 字段）经 describe 的 `base` 可见与否。
4. 旧 `settings.yaml` 里 `composer-quick-actions` / `composer-quick-actions-catalog` 两节在导入时的命运（用户数据迁移）。
5. 0.1.7 其余被本插件消费的契约（Input、Slots、Remote）是否另有破坏。
6. peer 范围与开发树版本线：跟 `0.1.7-alpha` 还是等 rc。

## Comments

## Answer（结论）

**只支持 DSH 0.1.7 的 Settings 表单模型；用户状态就是插件 Config，目录由 Client 自行重建。** 规格见 [spec 第 22 节](../spec.md)，取证见 [`research/dsh-0.1.7-settings-host.md`](../research/dsh-0.1.7-settings-host.md) 与 [`research/dsh-0.1.7-client-contracts.md`](../research/dsh-0.1.7-client-contracts.md)。按用户指示「开票据 31 调研，然后适配」，调研后直接实施；「只支持新线、不做双栈」沿用票据 29 的判例，由 Agent 拍板并记录于此。

### 落地

- **Host**：导出全 volatile 的 `Config`，旧 section 五个顶层键原样保留（DSH 一次性导入按顶层键匹配），`presets` 也设为 volatile 以便 Client 读取。`settings` 改为可选注入：`configure({ auto: false }, ctx.fiber)` 关掉自动设置页；规范化重写挪到 `loader.await()` 之后，改用 `mutate` 只写五个状态字段、从不写 `presets`。
- **Client**：`inject` 由 `settingsScope` 改为 `configForms`；只 `get` 一个表单，用共享模型从 `BUILT_IN_PRESETS`（移入 `src/model/`）加 `value.presets` 重建目录。`composer-quick-actions-catalog` 与 `decodeCatalogSnapshot` 删除。写入结果仍按写后快照判定（`mutate` 的 `false` 分不开拒绝与冲突）；mirror 只用契约内的 `ensure()`。
- **同批契约**：搜索图标 `IconSearchOutline16` 被删、seed 表不再提供，改为内联官方 artwork；`InputState.queue` 行声明为 `unknown`。
- **闸门**：`contract.spec.ts` 新增 `ConfigForm` 与 mirror face 的 `expectTypeOf` 断言，首次运行即抓出两处手写漂移（`revision` 的可选性、wire 值须为 `JsonValue`）。
- **依赖与文档**：peer 下界 `>=0.1.7-alpha.2`，开发树、`overrides`、`minimumReleaseAgeExclude` 整体上移（同日发布的 Cordis 4.0.4 系一并豁免）；两份 README 更新兼容性、落盘位置与迁移步骤；文档契约把 `composer-quick-actions-catalog` 列为禁用词。

### 验证

- `pnpm test` 487 通过，`pnpm typecheck` 两遍、`pnpm lint`、`pnpm peers check` 干净。
- **真实 DSH `0.1.7-alpha.2` 的无界面 Host 冒烟**（隔离 `DSH_HOME`，`runProfile()` + 禁用 webserver/connection 的 overlay，未碰 `~/.dsh`、未起服务器）：插件 fiber ACTIVE、无 warn/error；`describe()` 列出本条目且 `autoGenerate: false`；预置的旧 `settings.yaml` 被改名为 `.imported` 并导入 profile patch（五个字段齐全）；第二次启动规范化补齐预置、第三次幂等；volatile 写入不重挂 fiber。对照组装 npm 上的 `0.1.0` 复现出报告中的 `settings.register is not a function`。
- 冒烟发现首启时导入晚于重写读取。试过改为监听 `settings/document-updated` 重写，实测被 DSH 以 `HMR transactions cannot be nested` 拒绝，已撤回并把原因写进 spec 第 22.7 节与源码注释；接受「下次启动规范化」。
- **未验证**：Client 半边在真实 GUI 上的渲染与读写——唯一的 GUI 通道仍运行 `0.1.5` 线，`tests/gui/` 驱动也按旧布局编写，立为[票据 32](./32-port-the-gui-rounds-to-profile-backed-settings.md)。

### 发布前须知

- DSH `latest` 仍停在 `0.1.5` 线，新版不应发到 npm `latest`（spec 第 22.6 节）；版本号与发布由用户决定，本票据未改版本号、未发布。
- 报告者先升 DSH、插件仍是 `0.1.0`，其一次性导入已失败，数据若有则在 `settings.yaml.imported`，须按 README 手工迁移。
