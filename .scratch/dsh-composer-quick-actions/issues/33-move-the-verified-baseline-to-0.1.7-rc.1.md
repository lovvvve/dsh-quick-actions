# 把验证基线升到 DSH 0.1.7-rc.1

Type: task
Mode: AFK
Status: resolved
Blocked by: none

## Question（问题）

DSH `0.1.7-rc.1` 于 2026-09-23 13:44Z 发布（`next` dist-tag），票据 31 的开发树与验证基线停在 `0.1.7-alpha.2`。用户要求「把基线升到 rc.1」。

### 取证（2026-09-24，逐版 `npm pack` 比对 `0.1.7-alpha.2` → `0.1.7-rc.1`）

| 包 | 声明 | 实现 |
|---|---|---|
| `dsh-settings` | 0 处差异 | `lib/index.js` 逐字相同 |
| `dsh-client-ui-settings` | 0 处差异 | `lib/index.js`、`lib/client.js` 逐字相同 |
| `dsh-client-ui-conversation` | 5 个文件（`conversation`、`records`、`assembler`、`index`、`locales`），`contract/input.d.ts` 与 `contract/slots.d.ts` 不在其中 | — |
| `dsh-client-ui-primitives` | `HoverCard`/`Modal`/`Tooltip`/图标/markdown 等；`Button`/`Pill`/`Input` 不在其中；tarball 仍无 `dependencies` | 有差异 |
| `dsh-client-connection` / `-locale` / `-ui-renderer` | 0 处差异 | 逐字相同 |

node-semver：`0.1.7-rc.1` 与 `0.1.7` 满足 `>=0.1.7-alpha.2`，`0.1.8-rc.1` 与 `0.1.5-rc.3` 不满足。

### 范围

- 开发树的 DSH 版本线、`overrides`、`minimumReleaseAgeExclude` 升到 `0.1.7-rc.1`；两份 README 的「验证基线」行改为 `0.1.7-rc.1`。
- **peer 下界保持 `>=0.1.7-alpha.2`**：两版之间被本插件消费的契约逐字相同，抬高下界只会让仍在 alpha 通道的用户（票据 31 的报告者很可能就是）多出 peer 警告，没有任何收益。这需要把文档契约里「基线取自 peer 下界」的耦合拆开：基线改为取自开发树精确锁定的版本。
- 在真实 `0.1.7-rc.1` 上重跑票据 31 的无界面 Host 冒烟，使「验证基线」名副其实。

## Comments

## Answer（结论）

**验证基线升到 `0.1.7-rc.1`，peer 下界保持 `>=0.1.7-alpha.2`；两者从此是两个独立的事实**（[spec 第 22.6 节](../spec.md)）。

### 落地

- 开发树、`overrides`、`minimumReleaseAgeExclude` 整体升到 `0.1.7-rc.1`。Cordis 4.0.4 系发布于 2026-09-22，已过 pnpm 的 24 小时扣留，移出豁免。
- **只改 `overrides` 与 `dsh-settings` 不收敛**：六个 `dsh-client-*` 是按 peer 范围自动安装的，`>=0.1.7-alpha.2` 仍被 lockfile 里的 alpha.2 满足，pnpm 就沿用了（`pnpm up --depth Infinity` 也没动它们），`dsh-brand` / `dsh-credentials` 随之留在 alpha.2。改为给每个 DSH peer 另设锁在基线上的精确 devDependency，lockfile 里除 primitives 外再无非 rc.1 的 DSH 成员。
- 文档契约的「验证基线」改为取自开发树锁定的版本，不再从 peer 下界推导；打包契约新增「所有 DSH peer 的 devDependency 锁在同一个基线上」（primitives 例外），先验红（README 仍写 alpha.2）再转绿。
- 两份 README 的基线行改为 `0.1.7-rc.1`，并说明基线高于下界的原因。

### 验证

- `pnpm test` 488 通过；`pnpm typecheck` 两遍（`contract.spec.ts` 此时对照的是 rc.1 的已发布声明）、`pnpm lint`、`pnpm peers check` 干净。
- **真实 DSH `0.1.7-rc.1` 无界面 Host 冒烟**（沿用票据 31 的驱动，隔离 `DSH_HOME`、不起服务器、未碰 `~/.dsh`；266 个 `dsh-*` 包全部解析为 rc.1）：首启插件 ACTIVE、无插件 warn/error、`autoGenerate: false`，旧 `settings.yaml` 改名为 `.imported` 并导入五个字段；第二次启动补齐内置预置；第三次 patch 的 sha256 与 mtime 均未变（幂等）；`mutate` 只改 `layout` 一处且 fiber uid 不变。与 alpha.2 同场景日志去噪后逐字相同，组装出的配置树逐字相同。
