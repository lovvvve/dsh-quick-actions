# 把 GUI round 驱动移植到 profile 承载的 Settings

Type: task
Mode: AFK
Status: resolved
Blocked by: none

## Question（问题）

`tests/gui/` 的 round 驱动（`settings-namespace.mjs`、`scale-round.sh`、`send-round.sh`、`support.ts`、`acceptance.spec.ts` 等）按 DSH `0.1.5` 线的布局编写：种子数据与备份/还原都读写 `<DSH_HOME>/settings.yaml` 的 `composer-quick-actions` section，目录断言依赖只读命名空间 `composer-quick-actions-catalog`。票据 31 把插件改到 DSH `0.1.7` 的 Settings 表单模型之后（spec 第 22 节），这套驱动在新线上不再对应任何真实存储。

要做：

1. 种子、备份、还原改为操作 active profile 的 `cordis.patch.yml` 里 `id: composer-quick-actions` 那一行的 `config`（五个状态字段；`presets` 另行处理），并保持「收尾逐字还原 profile 与 patch」的指纹校验。
2. 去掉对 `composer-quick-actions-catalog` 的一切引用；目录断言改为读 Client 重建的目录。
3. 补一轮旧文档导入的验证：预置 `settings.yaml` → 首次启动 → `settings.yaml.imported` + profile patch 出现该行。

### 前置条件

唯一的 GUI 通道 `http://127.0.0.1:3080`（非本项目启动）运行的必须是 DSH `0.1.7` 线。票据 31 收尾时它仍是 `0.1.5` 线（2026-09-18 以 `npx @deepseek-ai/dsh@latest` 启动），切换由用户决定。

## Comments

### 2026-09-24：用户告知 3080 已升级

用户回复「本地 dsh 已经升级，做下测试」。实测 3080 由用户 tmux 里的 `npx @deepseek-ai/dsh@next web` 提供，运行时 `dsh`、`dsh-settings`、`dsh-client-ui-settings` 均为 `0.1.7-rc.1`（与票据 33 的验证基线相同）。profile 里已无本插件（用户此前以 `plugin rm` 卸掉了 `0.1.0`），`~/.dsh/settings.yaml.imported` 只有 `ui-onboarding` 一节，本插件没有待迁移的数据。前置条件满足，认领。

## Answer（结论）

**驱动的存储层与起停层已移植到 DSH 0.1.7；新增「外部通道」轮次，在用户正在运行的服务器上不重启地验证通过。** 需要本轮自己起停 profile 或靠命令行 overlay 注入预置的 round 另立[票据 34](./34-rerun-the-restarting-and-overlay-rounds.md)。

### 移植

- `settings-namespace.mjs`：种子、读取、备份、还原改为操作 active profile `cordis.patch.yml` 的 `id: composer-quick-actions` 行（只动五个状态字段，保留同行 `presets`）；备份改为**整份文件逐字节**，还原逐字节写回；新增 `readNamespace()` 与 `--backup`（`seed-scale.mjs`），供只让 GUI 写入的轮次先备份。
- `support.ts` 的 `storedNamespace()` 改读同一行的 `config`；`surface.spec.ts` 的注释改为「目录由 Client 从内置清单加表单 `presets` 重建」。
- `boot.sh`：运行时改为 `DSH_QA_RUNTIME`，默认 `@deepseek-ai/dsh@next`（`latest` 仍是 `0.1.5` 线）；新增外部通道模式——给了 `DSH_GUI_ENTRY` 且通道有应答时，`boot` 不起任何服务器、`stop_ours` 不停任何进程。
- `install.sh`：同一运行时；tarball 目录可由 `DSH_QA_TARBALLS` 指到工作树外（用户 profile 不指向会被删掉的检出）；指纹由两个文件扩到 `package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`、`cordis.patch.yml` 四个（插件状态现在就在 patch 里）。
- 新增 `live-round.sh`：指纹 → 备份 patch → 打包 → `dsh plugin add`（靠 `patchReload: live` 热加载）→ `channel.spec` 作为就绪探针 → 默认跑 `surface`/`manager`/`stacking`/`validation`/`conflict` → 退出时卸载、逐字节还原 patch、核对四个指纹。
- `conflict.spec.ts` 自带 240 秒预算（见下）。`send-round.sh`、`scale-round.sh`、`acceptance.spec.ts` 里残留的 `settings.yaml` 字样改为 profile patch。

### 真机验证（用户的实时 DSH `0.1.7-rc.1`，未重启服务器，未发送任何模型消息）

- **热加载成立**：`dsh plugin add` 之后不重启，`channel.spec` 三项通过——官方 GUI 应答、hero 屏零渲染（在插件样式注入之后才断言）、常驻消息编辑器出现布局 cell 与管理入口。
- **整轮**：42 项中 33 通过、8 跳过（`conflict` / `validation` 在窄视口按设计跳过）、1 失败。通过的包括三视口下的内置预置目录（5 个预置由 Client 重建目录呈现）、ribbon 布局、**与输入框等宽误差 ≤ 1 CSS px**、官方 primitives 叶子控件、不溢出输入框与视口、管理面板的标签/Escape 归还焦点/布局切换跨刷新保持/launcher 可搜索面板、面板控件不被遮挡，以及表单校验三项（码点计数、trim、DSH 保留占位符拒绝）。
- **唯一失败是 `conflict.spec` 的 90 秒总超时**，两次都卡在预算上（报错落在 `finally` 的 `context.close()`，是超时后的清理）：两个客户端各要找一个常驻消息编辑器，而这个 profile 侧栏前几行是 hero 会话，单次进入就要 26–80 秒。以 240 秒预算单独重跑，**1.8 分钟通过**——新模型下的 revision 冲突分支（写后快照判定 `conflict` 并刷新到权威状态）在真实 GUI 上成立。
- **收尾**：两轮都已卸载插件、逐字节还原 patch，四个文件的 sha256 与开窗前的独立备份逐一一致；profile `node_modules` 无残留（`quick-format-unescaped` 是 pino 的依赖，与本插件无关）。
- 日志里反复出现的 `plugin card registration into "plugins.bundle.config" was refused` 来自 `dsh-context` 与 `@linxin666/dsh-remote-web-ui`，本插件产物中该字串出现 0 次。

### 未覆盖

- 第 3 项「旧文档导入」没有在 GUI 上补做：用户的一次性导入已于 14:07 发生过、且没有本插件的数据，在其 profile 上无法重演；该路径已由票据 31、33 在隔离 `DSH_HOME` 的无界面冒烟中两次验证。
- 需要本轮自己重启 profile 的 round（`reinstall`、`restart`、`lifecycle`、`scale`、`screenshots`、`acceptance`）与靠 `dsh --patch` overlay 注入预置的 round（`presets`、`host-config`）未重跑，见票据 34。

### 事故记录

读取 tmux 输出里的入口 URL 时，脱敏命令只替换了每行第一个 token，用户 DSH web 的一个 LAN 访问 token 被打印进本会话记录。已告知用户；该 token 随下一次 `dsh web` 启动失效。之后入口 URL 只从 0600 文件读入环境变量，日志经 `sed` 脱敏。
