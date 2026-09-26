# 收掉 0.1.7 适配分支代码审查的发现

Type: task
Mode: AFK
Status: resolved
Blocked by: none

## Question（问题）

2026-09-25 对 `ticket-31-dsh-017-settings` 分支（`main...HEAD`，票据 31–33）跑了一次双轴代码审查（Standards / Spec）。源码没有违反已闭合决策，但有一处用户可见的行为缺陷，以及若干条没跟上第 22 节的文档。

### 目录错误的文案与重试按钮

spec 第 22.3 节改变了三种目录错误的来源，界面没有跟上：

| reason | 0.1.7 下的触发 | 现在的文案 | 重试有没有用 |
|---|---|---|---|
| `unreadable` | 首次读取共享文档失败（mirror 回到 `idle`） | 「无法读取设置，快捷动作暂不可用」 | 有：`ensure()` 只在 `idle` 时读，正好覆盖 |
| `unavailable` | 表单不提供给本页：条目未激活（例如启动时预置校验失败）、或非 loopback 页面的 memory 模式 | 「未找到预置目录」——第 17 节目录命名空间的旧义 | 没有：已持有文档，`ensure()` 什么也不做 |
| `undecodable` | 作者在运行期把 `presets` 改坏了（不是列表或任一条不合法） | 「预置目录版本过新，无法读取」——旧义 | 没有：同上；作者改好 patch 后 mirror 随广播自行刷新 |

spec 第 10 节只把「首次目录读取失败」定为可重试。管理面板在目录仍 `loading` 时也挂着重试按钮，同样是空操作。

要做：`unavailable` / `undecodable` 的中英文文案按新义改写；重试按钮只在 `unreadable` 时出现（动作带位置的 `CatalogNotice` 与管理面板两处）。

### 文档漂移

- `docs/agents/domain.md:14` 与 `map.md` Notes 两行仍说「第 17 节 / 第 16 节优先级最高」，与 spec 第 22 节开头及 CLAUDE.md 冲突。
- `CLAUDE.md` 环境与陷阱一节仍说「两个 Settings 命名空间……另一条身份轴」，与 22.2（两条身份轴重合）、22.3（目录命名空间作废）冲突；同一节的发布命令没带 dist-tag，与 22.6「新版发到非 `latest` 的 dist-tag」冲突。
- `spec.md` 22.6 仍写 Cordis 4.0.4 系「一并豁免」，票据 33 已把它们移出 `minimumReleaseAgeExclude`。
- 两份 README 的安装命令不带 tag：DSH 把 `0.1.7` 推上 `latest` 之前，本版若发到 `next`，照 README 装到的是 `latest` 上的 `0.1.0`，在 0.1.7 上激活失败。

### 未验证的数据保留承诺

spec 第 6.1 节要求卸载保留数据、重装恢复。0.1.7 下数据在 profile patch 那一行的 `config` 里，`dsh plugin remove` 对这一行的影响在 `research/dsh-0.1.7-settings-host.md`「未决」第 3 条列为未验证，README 却断言「重装应当恢复你的动作」。票据 32 第 3 项（旧 `settings.yaml` 导入的 GUI 验证）也只以无界面冒烟抵充，没有转进票据 34。

要做：从 DSH `0.1.7-rc.1` 源码取证 `plugin remove` / 重新 `add` 对该行的处置，README 按证据陈述；两项 GUI 验证明确记进票据 34。

### 不做

审查里的判断性 smell（Host `stateOps` 与 Client `sectionOps` 同形、GUI 驱动两处定位插件行、改模型后遗留的 `Namespace`/`unregistered` 旧名等）不在本票据内；它们不影响行为，要动另开票据。

## Comments

## Answer（结论）

**行为缺陷已修，文档已跟上第 22 节；卸载保留数据的承诺由源码取证成立，真机验证记进票据 34。**

### 目录错误

- 新增 `isRetryableCatalogError(reason)`（`src/client/controller.ts`，与 `CatalogErrorReason` 放在一起），只有 `unreadable` 返回 `true`。动作带位置的 `CatalogNotice` 与管理面板共用它：`unavailable`、`undecodable` 与管理面板里的 `loading` 不再挂重试按钮。
- 文案按新义改写：`unavailable` →「DSH 未向本页面提供快捷动作设置，快捷动作暂不可用」/ "DSH is not serving Quick Actions settings to this page, so Quick Actions are unavailable"；`undecodable` →「预置目录配置无效，快捷动作暂不可用」/ "The Preset Catalog configuration is invalid, so Quick Actions are unavailable"。
- 测试（TDD，先红后绿）：`surfaces.spec.tsx` 的目录错误组改为三条——`unavailable` 与 `undecodable` 显示对应文案且无重试；`unreadable` 由真实的首读失败造出（不再像旧用例那样把已持有的文档翻回未应答来制造一次重试），重试再失败也不向页面抛未处理拒绝。`manager.spec.tsx` 的 harness 新增 `read: 'pending' | 'failed'`，钉住面板里 `unavailable` 无重试、首读进行中无重试、首读失败有重试且重试成功后列表出现。

### 文档

- `docs/agents/domain.md`、`map.md` Notes 两行：优先级最高的是第 22 节。
- `CLAUDE.md`：身份轴一句改为单一 Settings 命名空间 = 装载条目 id、目录命名空间已作废；发布命令改为 `pnpm --filter dsh-quick-actions publish --tag next`。
- `spec.md` 22.6：Cordis 4.0.4 系「当时一并豁免、已由票据 33 移出」。
- 三份 README（根、包中文、包英文）：安装命令改为 `dsh-quick-actions@next` 并说明为什么不能省；根 README 的「两个 Settings 命名空间」同步改掉。**npm 上 `dsh-quick-actions` 目前只有 `latest: 0.1.0`**，`@next` 在新版以 `--tag next` 发布之后才可用。

### 卸载与重装

从 `0.1.7-rc.1` 源码（本机 npx 缓存，只读）取证，细节与行号记在 `research/dsh-0.1.7-settings-host.md`「未决」第 3 条下：`plugin remove` 不写 `cordis.patch.yml`，该行连同 `config` 保留；重启时它只打 `patch: entry "composer-quick-actions" not found` 警告、不阻塞启动；重新 `add` 后 profile 那一行按 id 把 `config` 叠回 bundle 插入的条目，之后的写入复用同一行、不产生重复。README 的「重装恢复」因此成立，并补上了只卸不装时的警告与清理方式。

票据 34 新增两项真机验证：`reinstall` round 对这条链路的显式断言，以及票据 32 第 3 项的旧文档导入 GUI 验证（只能在停服窗口里让 3080 临时以一次性 `DSH_HOME` 启动）。

### 验证

`pnpm lint`、两遍 `pnpm typecheck` 通过；`pnpm test` 23 个文件 492 条全过（文档改完后重跑一次仍全过）。GUI 未跑：文案与按钮显隐只影响目录错误态，常规 GUI 套件不覆盖这些状态。

### 未做

审查的判断性 smell 保持原样，见 Question「不做」。
