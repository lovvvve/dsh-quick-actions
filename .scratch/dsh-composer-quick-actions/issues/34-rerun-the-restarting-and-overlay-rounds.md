# 重跑需要重启 profile 与靠 overlay 注入预置的 GUI round

Type: task
Mode: AFK
Status: open
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

## Comments
