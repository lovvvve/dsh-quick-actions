# 适配 DSH 0.1.7 的 Settings 模型重写

Type: task
Mode: AFK
Status: claimed
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
