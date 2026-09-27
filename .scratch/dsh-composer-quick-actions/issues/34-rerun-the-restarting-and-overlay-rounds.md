# 重跑需要重启 profile 与靠 overlay 注入预置的 GUI round

Type: task
Mode: AFK
Status: claimed
Blocked by: none

## Question（问题）

票据 32 把 `tests/gui/` 的存储层与起停层移植到 DSH 0.1.7，并用新增的 `live-round.sh` 在用户正在运行的服务器上验证了不需要重启的那部分。剩下两类 round 没有重跑。

### 需要本轮自己重启 profile 的

`reinstall`、`restart`、`lifecycle`、`scale`、`screenshots`、`acceptance`（以及需要用户许可才能跑的 `send`）。它们的 `boot` 只在 3080 空闲时才会起服务器，而用户的 DSH 常驻在 tmux 里——要么由用户先停掉自己的服务器，要么把能改成「不重启」的阶段改成不重启：`patchReload: live` 已证明安装能热加载，卸载与种子写入大概率也能（spec 第 22 节：写 volatile 字段不重挂 fiber），但「重启后恢复」这一类断言本身就需要一次真正的重启。

### 靠 `dsh --patch` overlay 注入预置的

`presets-round.sh` 与 `host-config-round.sh` 把作者预置写进命令行 overlay。按 `research/dsh-0.1.7-settings-host.md` 第 1 节读到的 config-editor 代码，**条目被 home patch 或命令行 overlay 覆盖时，DSH 0.1.7 拒绝对它的表单写入**（`Configuration for "…" is overridden by a home patch or command-line overlay`）。两轮里凡是经 GUI 写入的阶段（隐藏、克隆、排序……）都会被拒。尚未在真机上确认。

要做：

1. 真机确认 overlay 下的写入拒绝，以及 Client 在那种状态下显示什么（`refused`？只读？）——这本身就是一个用户可能遇到的场景：作者若用 overlay 分发预置，用户就改不了自己的状态。结论可能需要写进 README。
2. 把两轮改为把 `presets` 种进 profile patch 的同一行（`settings-namespace.mjs` 已保留同行 `presets`，需要补一个写 `presets` 的入口），或者如果第 1 项证明 overlay 是需要支持的分发方式，另立决策。
3. 与用户约定一次可以停掉其服务器的窗口，重跑重启类 round。
4. `reinstall` round 要显式断言：`dsh plugin remove` 之后 profile patch 里 `id: composer-quick-actions` 那一行连同 `config` 仍在，重启只打 `patch: entry "composer-quick-actions" not found` 警告；重新 `add` 后五个状态字段恢复、patch 里没有重复行。票据 35 已从源码取证这条链路（`research/dsh-0.1.7-settings-host.md`「未决」第 3 条），README 据此陈述，真机尚未跑过。
5. 补票据 32 第 3 项、当时只以无界面冒烟抵充的旧文档导入 GUI 验证：预置 `settings.yaml` 的 `composer-quick-actions` section → 首次启动 → `settings.yaml.imported` 出现、profile patch 该行带上五个字段、GUI 显示导入的动作。用户自己的 `~/.dsh` 已导入过一次，无法重演；GUI 又只有 3080 一个通道、不得另起服务器，所以只能在第 3 项的停服窗口里让 3080 临时以一次性 `DSH_HOME` 启动，须与用户一并约定。

## Comments

### 2026-09-27：认领，先做不需要停服的第 1、2 项

**第 1 项：源码已取证（`0.1.7-rc.1`，未实跑），细节与行号记在 `research/dsh-0.1.7-settings-host.md` 第 1 节「覆盖的粒度与后果」。**

- 拒写**按整个条目**，不按字段：patch 行的 `config` 整份替换，home patch 或 overlay 里只要有一行本条目带任意 `config`（只有 `presets` 也算），config-editor 就拒绝对该条目的一切表单写入。
- 更糟的是遮蔽：Client 的 `value` 取的是覆盖层那份整份 config，overlay 里的 `presets` 到得了 Client，但 profile 行里存的五个状态字段被整体遮住、回落为 schema 默认值——用户的动作在界面上「消失」（磁盘上还在）。
- Client 侧表现：`writable` 恒为 `true`，管理面板不会预先显示只读；每次写入 `mutate` resolve `false`，按写后快照判为 `refused`（「保存被拒绝，没有写入任何内容；请重试。」），重试永远失败。不是 reject，不走传输故障分支。
- Host 启动规范化重写若需要写，会撞上同一报错并抛出，被 `src/index.ts` 的 `logger.error` 接住，不影响激活。
- **结论：home patch 与 overlay 都不是可用的预置分发方式**，不必另立「是否支持 overlay 分发」的决策——支持它要改 DSH 的 patch 合并语义，违反「首版不新增任何 DSH 核心接口」。两份 README 的「配置预置动作」一节已加警告：只声明在 active profile 自己的 `cordis.patch.yml`，写进 home patch 或 overlay 会遮住用户数据并拒绝一切保存，删掉那一行并重启即可恢复。真机确认可放进第 3 项的停服窗口顺带做（起一次带 `--patch` 的 profile，点一次隐藏），不是前置条件。

**第 2 项：已完成。**

- `settings-namespace.mjs` 新增 `seedPresets(presets | undefined)`，与 `seedNamespace` 共用抽出的 `rowConfig()`（建行、建 `config`）、同一份逐字节备份与原子写入；只动 `presets`，五个状态字段原样保留。新增 CLI `seed-presets.mjs <file.yml> | --clear`。
- `presets-round.sh` 四段改为「`seed-presets` → `boot` → 该段 spec」，墓碑段用 `--clear`；`host-config-round.sh` 同理。退出时沿用 `seed-scale.mjs --restore` 的逐字节还原。
- `boot.sh` 删去已无调用方的 `DSH_BOOT_PATCH` 分支。顺带修掉一个旧缺陷：外部通道下 `boot` 是空操作，旧写法的 overlay 会被静默丢掉，第一段必然失败。
- 两个 round 现在可在**外部通道**上跑（给 `DSH_GUI_ENTRY` 即不起停服务器，预置作为 live 更新到达；spec 22.3），也可在自起服务器模式下每段重启一次。外部通道下「外部改 patch 文件能否热到达运行中的 DSH」尚未实测，spec 本身会在第一段暴露。
- 离线验证（假 `DSH_HOME` + 带其他插件行与注释的 patch，工作目录隔离在任务临时目录）：`seed-presets` 写入后其他行、注释、状态字段不变；`--clear` 只删 `presets`；`seed-presets` 与 `seed-scale 3` 交替写互不覆盖；`--restore` 后 sha256 与原文件一致、备份清理；profile 原本无 patch 时还原即删除文件。`sh -n`、`pnpm lint`、两遍 `pnpm typecheck`（覆盖 `tests/gui/**/*.ts`）通过。

**仍需用户：** 在外部通道上跑 `presets`/`host-config` 两轮（会临时改用户 profile patch，退出逐字节还原，同票据 32 的 `live-round.sh`）；第 3–5 项需要停掉 3080 的窗口。另注意 DSH `next` 已是 `0.1.7-rc.2`（2026-09-24），本插件验证基线仍是 rc.1，peer 下界覆盖得到；用户下次以 `npx @deepseek-ai/dsh@next` 重启就会是 rc.2。
