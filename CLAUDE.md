# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 与 AGENTS.md 的关系

本仓库已有 [AGENTS.md](AGENTS.md) 作为通用代理指令，本文件不重复其内容。开始前先读：

1. [AGENTS.md](AGENTS.md) — 沟通语言、议题跟踪、分诊标签、领域文档三条规则的入口。
2. [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md) — `.scratch/` 本地议题跟踪与 Wayfinder claim/resolve 约定。
3. [CONTEXT.md](CONTEXT.md) — 领域词汇（Quick Action / Preset / Custom / Insert / Send / Resident Composer 等）。**写代码、命名、文案、commit 一律使用这里定义的术语**。本仓库不用 `docs/adr/`，不可逆决策的归属见 [docs/agents/domain.md](docs/agents/domain.md)。
4. [map.md](.scratch/dsh-composer-quick-actions/map.md) 与 [spec.md](.scratch/dsh-composer-quick-actions/spec.md) 第 16、17 节 — 哪些结论已闭合、哪些不得倒退；本文件下方的「已闭合、不得倒退的决策」是同一批结论的速查版。

## 项目状态（先看这条）

**首版已通过最终人工验收**（票据 21，用户于 2026-09-09 回复「生产验收通过」），Wayfinder 地图目标达成。票据 26 也已 resolved（管理面板改经 `createPortal` 挂到 `document.body`）。**发布状态正在改变**：用户已决定推包，[票据 27](.scratch/dsh-composer-quick-actions/issues/27-publish-to-npm-and-list-in-market.md) 正在进行，它推翻票据 20 的「暂不发布」；在票据 27 resolved 之前，下方「环境与陷阱」里那条禁止 `npm publish` 的告诫仍然有效。 以下现状描述保留，作为改动这个仓库时的地形图。

`packages/composer-quick-actions` 已有共享领域模型 `src/model/`（票据 12）、Host `src/host/`（票据 13：配置合并、两个 Settings 命名空间、规范重写）、Client 控制器 `src/client/controller.ts`（票据 14）、Composer 界面 + 动作执行 `src/client/{index.tsx,dsh.ts,session/,surfaces/}`（票据 15：两个 dock Slot 注册、Resident Composer 信标、三种布局、单飞发送与确认流程），管理面板 + 共享可搜索动作面板 + 自定义动作表单 `src/client/{manager/,modal.ts}`（票据 16：独立注册的管理 overlay、B/C 共用的可搜索面板、表单校验与命令发送动作警示），以及安装形态与发布文档（票据 17：两个包的发布身份、`dsh.client` 声明、peer range、只发声明的打包修复、四份中英文 README）。界面的叶子控件已换成官方 primitives（票据 23：`Button` / `Pill` / `Input` + 官方图标，容器仍自绘）。构建适配器的发布路径已改为从内存原子发布，watch 关闭不再遗留 scratch（票据 22）。自动化与发布验证已完成（票据 18：四轮真实 GUI，`tests/gui/` 下的 spec 与 round 驱动 + 脚本化的安装窗口，证据在 `verification/release-evidence.md`；票据 21 与 26 之后该目录共 15 个 spec）。票据 18 发现的两处边缘状态 UX 缺口已由票据 25 定案：管理表单现在接管开场焦点并归还焦点（Escape 两级退出）；断线发送经源码取证确认由 DSH 自己恢复草稿并给出提示，插件按 spec 9.5 不加第二条说明。最终人工验收已完成（票据 21：步骤 1–8 由 Agent 在用户实时 DSH 的一次性窗口里驱动，`tests/gui/acceptance.spec.ts` + `acceptance-round.sh` + 19 张截图，第 9 步由用户本人答复）。

真正完成的有七件事：DSH 核心 `insertText` 补丁（`.scratch/.../core/`，仅作能力基线，**未合入官方，不得宣称正式上游版本**）、workspace + Client 构建适配器、共享领域模型（纯 JSON，`src/model/`）、Host 侧装配（`src/host/`）、Client 控制器、Composer 界面与动作执行，以及管理与动作面板界面。**后四者已由票据 18 在用户自己的实时 DSH 上实测**（四轮临时安装窗口，每轮收尾卸载并把 profile 与 Settings 逐字还原）：Client 读取目录 `base`、常驻判定、等宽（误差 0.0 px）、端到端发送与确认、重装恢复、预置往返、revision 冲突分支均已确证，取证见 `.scratch/dsh-composer-quick-actions/verification/release-evidence.md`。

## 命令

```bash
pnpm install                 # 仓库默认未安装依赖
pnpm test                    # vitest run，含真实 tsdown 构建（打包契约在工作树外的 workspace 副本里构建），慢（watch 用例 35s 超时）
pnpm typecheck               # tsc -b（项目引用，产出 lib/types）+ tsc -p tsconfig.test.json（测试/配置，noEmit）
pnpm lint                    # oxlint . --deny-warnings（无配置文件，用默认规则）
pnpm build                   # 各包 tsc -b && tsdown
pnpm watch:client            # 只重建 Client bundle
```

单个测试文件 / 单个用例：

```bash
pnpm vitest run tools/dsh-client-bundle/tests/bundle.spec.ts
pnpm vitest run -t 'rejects computed require calls'
```

GUI 验证（票据 18，`tests/gui/`，**不在 vitest include 内**，需要插件已装进 web profile 且 profile 已启动）：

```bash
sh tests/gui/reinstall-round.sh   # 开安装窗口（打包 + 安装）并跑重装恢复三段
sh tests/gui/verify-round.sh      # 常规套件（= pnpm verify:gui），可转发参数重跑单个 spec
sh tests/gui/presets-round.sh     # 预置往返四段（dsh --patch overlay）
sh tests/gui/send-round.sh        # 发送路径（真实模型调用，需用户许可）
sh tests/gui/close-window.sh      # 卸载 + profile 指纹校验
```

每个 `*-round.sh` 自带 profile 启停与命名空间备份/还原（`boot.sh`、`install.sh`、`settings-namespace.mjs`）。**不要直接 `pnpm verify:gui`**：`validation.spec.ts` 与 `conflict.spec.ts` 会写入 Settings，必须跑在种子命名空间上并在退出时还原。

注意 `typecheck` 是**两遍**：`*.spec.ts` 和 `tsdown.config.ts` 不在项目引用里，只有第二遍 `tsconfig.test.json` 才覆盖它们；只跑 `tsc -b` 会漏掉测试侧类型错误。`lib/` 是 gitignored 的构建产物；包级 `tsc -b` 只发 `.d.ts`（`emitDeclarationOnly`），别让它重新向 `lib/types/` 发 JS 或 sourcemap——那会把整包第二份 JS 打进 tarball（票据 17 修复，`tests/release/packaging.spec.ts` 固定）。

## 架构

### 三个 workspace 包

| 路径 | 角色 |
|---|---|
| `packages/composer-quick-actions` | Host + Client **双面功能包**，导出 `.`、`./client`、`./types`、`./package.json`（`./remote` 已按 spec 第 17 节于票据 17 删除，不要加回） |
| `packages/composer-quick-actions-bundle` | 安装 bundle，只有 `cordis.patch.yml`，把功能包 Host row 插进 DSH `web` profile |
| `tools/dsh-client-bundle` | 私有构建适配器（不发布），把浏览器 CJS 产物包成 DSH ModuleLoader 要的 lazy-CJS |

拆成两个包是刻意的：功能包提供实现，bundle 提供可 `dsh plugin --profile web add` 的安装形态。本地/离线安装要**分别解析两个 tarball**，bundle tarball 不内嵌依赖。

### Host / Client 双面

一个包同时被两侧加载，两侧都导出 Cordis 的 `inject` + `apply(ctx)`，但走完全不同的构建管线（见 `tsdown.config.ts` 导出的数组：`host` 配置 + `dshClientBundle(...)`）：

- **Host**：Node ESM，`lib/index.js` / `lib/types.js`。拥有两个 Settings namespace（持久化的 `composer-quick-actions` 落在 `<DSH_HOME>/settings.yaml`；只读目录 `composer-quick-actions-catalog` 只发 composition `base`，不写用户层）、预置目录校验与合并。**Host 独占校验与迁移权威。** 不存在自有 Catalog Remote。
- **Client**：browser-only 单文件 `lib/client.js`。经 `ctx.settingsScope` 读写 Host 权威状态（每次修改携带预期 revision），目录只读命名空间的 `base` 层；`remote.settings` 由 `settingsScope` 内部持有，插件不直接注入。注册 `conversation.input.dock`（布局 + 管理 overlay 两个 cell）与 `conversation.composer.dock`（常驻信标 + `bar` 布局）Slots。Client 不直接写文件、不用浏览器存储作权威源、不做迁移。

规范源码边界见 spec 第 14 节：`src/model/`（纯 JSON 领域模型，Host/Client 共享）、`src/host/`、`src/client/{controller.ts,surfaces/,manager/,session/}`、`src/locales/`、`src/styles/`。内部 controller、构建适配器实现不得成为公共导出。

### Client 构建适配器（`tools/dsh-client-bundle/src/index.ts`）

这是目前最有实质逻辑的代码，理解它才能改 Client 构建：

- 产物固定为 `lib/client.js` + sourcemap，用 `banner`/`intro`/`footer` 包成 `window.__ModuleLoader__.load({ id, factory: (require) => { ... } })`。
- **只有调用方在 `external` 里显式列出的 specifier 才能 `require`**；其余一律 `alwaysBundle`。一个 `renderChunk` AST 插件在构建期硬性拒绝：间接 `require` 引用（`const load = require`）、计算型 `require(id)`、任何 `ImportExpression`（动态 import）、未声明的 external。内部动态 import 必须被内联进同一产物。
- browser platform 在 tsdown 和 Rolldown `inputOptions` **两层**都强制，`conditionNames` 以 `browser` 优先——Node builtin、Node 条件导出会构建失败而不是悄悄进产物。`failOnWarn: true`。
- **原子发布**：产物由 `generateBundle` 捕获在内存里，`onSuccess` 才把 map、再把 js 逐个原子写入 `lib/`——**绝不从磁盘 scratch 目录发布**。bundler 仍会往相邻的 `lib.dsh-client-stage/` 写，那里的内容一律不可信：`failOnWarn` 是在写完之后才升级为错误的，失败构建照样会写盘，而 `write: false`（本仓库**未设置**）在 watch 模式会被忽略，救不了场；该目录在每次构建开始与 `closeBundle` 时无条件删除（票据 22：tsdown 在进程退出时没有关闭钩子，`Symbol.asyncDispose` 只在配置重载时跑，`q`/SIGINT/SIGTERM 直接终止 watcher，因此清理不能挂在关闭时机上）。构建失败时 `lib/` 里上一次完整成功产物原样保留。**tsdown 调 `onSuccess` 时既不 await 也不 catch**，所以发布必须自己兜住异常（打印 + `process.exitCode = 1`），否则 unhandled rejection 会直接打死 watcher。
- `tools/dsh-client-bundle/tests/bundle.spec.ts` 用真实 tsdown 子进程 + 假 ModuleLoader（`node:vm`）验证上述每条边界、sourcemap 原始位置映射和 watch 恢复。改适配器就要改这里，这些是契约测试不是 smoke test。

## 规格驱动的工作流

`.scratch/dsh-composer-quick-actions/` 是本项目的议题跟踪器：

- [`spec.md`](.scratch/dsh-composer-quick-actions/spec.md) 是 **baseline，冲突时以它为准**。第 1 节说明规范解释，第 14 节给出源码边界 → 票据映射，第 15 节记录首轮收尾决策，第 16 节记录首版范围收缩，**第 17 节记录目录改走 Settings base 层且优先级最高**。正文其余部分不得重开已关闭决策。
- [`map.md`](.scratch/dsh-composer-quick-actions/map.md) 是 Wayfinder 地图，`Decisions so far` 只放已关闭票据索引。
- `issues/NN-*.md`：开工前把 `Status:` 设为 `claimed`，完成时追加 `## Answer` 并设 `resolved`，再回填地图。frontier = 开放、未阻塞、未认领中编号最小者。**01 至 26 全部 resolved**，地图目标已达成；当前 frontier 是[票据 27 发布到 npm 并在插件市场上架](.scratch/dsh-composer-quick-actions/issues/27-publish-to-npm-and-list-in-market.md)（已认领）。票据 26 把管理面板改经 `createPortal` 挂到 `document.body`；**只做了管理面板**，两个锚定 popover（`ActionPanel` / `ConfirmPanel`）仍在 dock 子树内、带着同一个层叠根因，只是尚无用户可见症状——要动它们须先解决锚定定位改用视口坐标的问题，且应另开票据。
- `research/`、`core/` 保存证据，不要重跑已完成的研究或原型迭代。

每轮只领取并解决一张票据；后续领域行为用 TDD 实施。

## 已闭合、不得倒退的决策

历史票据里能找到旧答案，但已被 spec 第 16 节覆盖 —— **首版范围收缩，以第 16 节为准**：

- **首版只有发送动作**。不提供插入动作，不做 `insertText` 能力检测，不存在 Compatibility-Suppressed 投影。票据 06/08/09/10/19 里的能力自适应描述全部作废（各票据 `## Comments` 已标注）。
- **数据契约保留 `kind`，首版恒为 `'send'`**。它不是配置项——预置作者不声明、表单无选择器、用户改不了，规范化统一写出。保留标签是为了 v2 加插入动作时不升 `schemaVersion`、不改写既有用户数据。非 `'send'` 值：Config 里是作者错误（加载失败），已存储数据里是降级场景（保留为墓碑，不显示不计数不改写）。
- **发送只有一条装载路径**：`setDraft(text)` → `submit()`。
- **`/` 开头文本是合法的命令发送动作**，确认默认开启但用户可关闭。**规范化绝不能依据文本改写 `confirm`**——默认只在创建/克隆时初始化，放进规范化会毁掉用户选择并破坏幂等。表单警示不锁定，确认面板启用时须说明不会出现 DSH 原生候选菜单。**不要**恢复票据 06 的"斜杠命令一律配置无效"，也不要恢复强制确认。不得自制候选菜单或驱动 `inputTriggers`。
- **不发布自有 Catalog Remote**。已发布的 typert 生成器要求 `@Remote` 符号来自 `<root>/packages/` 下已注册的 workspace 包，第三方包做不到；目录改由只读 Settings 命名空间 `composer-quick-actions-catalog` 的 composition `base` 层承载，Client 读 `base` 不读 `value`（spec 第 17 节，取证见 `research/catalog-remote-assembly.md`）。不要重新尝试生成式 Remote。
- **GUI 验证只有一个通道**（现有 `http://127.0.0.1:3080`）。不要再创建隔离检出、应用核心补丁或起第二个服务器。
- **`SettingsScope` 的结构化写入结果由插件自己判定，不改 DSH 核心**。spec 第 15 节决定 4 的「扩展 `SettingsScope`」已被第 16.4 节的「首版不新增任何 DSH 核心接口 / 没有剩余的核心契约依赖」取代；已发布的 `mutate` 返回 `void`，控制器改用写后权威快照区分成功 / `conflict` / `refused`（票据 14 `## Answer` 记有已知边界）。不要重新提出改 `@deepseek-ai/dsh-client-ui-settings`。
- 官方上游合并已列为首版范围外，**不要**用"等待官方发布"重新阻塞产品。
- **首版按作者格式接受 CSS Modules 偏离**（spec 第 18 节）。插件样式是带 `dsh-cqa-` 前缀的样式字符串，但**投递机制与第一方插件逐字相同**（运行时注入 `<style data-plugin-css>` + 内联字符串 + 幂等判断）；差距只有作者格式与类名生成方式，用户不可见。控件本身已由票据 23 改用官方 primitives，配色只用 `--dsw-alias-*` token。**不要**在其他票据里顺手改造成 CSS Modules——要做须先核实 `@tsdown/css` 能把 CSS 内联进单文件 `client.js`（ModuleLoader 只加载 `lib/client.js`），通过后另开票据。
- **`pnpm test` 不再触碰工作树的 `lib/`**（[票据 24](.scratch/dsh-composer-quick-actions/issues/24-isolate-pack-from-the-working-tree.md)）：打包契约把 workspace 复制到 `tmpdir()` 下的副本再 `pnpm pack`，`prepack` 的 `rmSync('lib')` 与构建都发生在副本里；副本不复制 `node_modules`/`lib`，依赖用 symlink 指回已安装位置，因此**不需要 install**。`pnpm watch:client` 与 `pnpm test` 现在可以同时跑，失败的测试也不会让线上 bundle 消失。改 `tests/release/support.ts` 的 `stageWorkspace()` 时**不要**把 `lib/` 复制进副本——那会让打包契约测到陈旧产物；`packing isolation` 三条断言（工作树 lib 内容与 mtime 不变、副本在仓库外、packed 产物由副本本次构建）就是为此设的。
- **首版不新增任何 DSH 核心接口**。`insertText` 和 submit 凭据都不做。单飞窗口只能用公开 Input snapshot（`draft/imageIds/draftRev/phase/claim?/occurrences/queue`）判定，硬标准是不产生重复发送——注意官方 sink 乐观清空，`submit()` 后草稿一帧内就空了，"草稿已占用"不是互斥锁。
- **断线发送不加插件侧反馈，也不加连接态门禁**（[票据 25](.scratch/dsh-composer-quick-actions/issues/25-close-two-edge-state-ux-gaps.md)）。官方 `submit()` 没有连接态检查：普通文本一律同步 `default-sink` + `commit-draft`，草稿在 sink 失败之前就被乐观清空；引擎读到空草稿即按 spec 9.5 关闭单飞，文本随后由 DSH 自己的 `restoreFailedDrafts` 放回并伴随 DSH 的 error toast。给引擎加超时判定「没落地」既不可达也违反 9.5（不得显示重复错误）；按 `ctx.connection` 状态拒绝激活违反 spec 10「断线期间允许执行」，且比原生发送按钮（其 `disabled` 不含连接态）更严。`surfaces.spec.tsx` 的「断线时动作仍可执行」与 `execution.spec.ts` 的 `a send the connection cannot carry` 固定了这两点。

## 环境与陷阱

- 用 `pwd` 确认在本项目；DSH 部署目录和官方源码临时检出都不是这里。**不修改已安装的 `node_modules`**，核心补丁只在隔离的官方源码检出里验证。
- 现有 GUI 是 `http://127.0.0.1:3080`（非本项目启动）。`pnpm watch:client` **不等于** DSH GUI HMR；同一 DSH checkout 的 watcher 与页面加载关系必须实测。
- Client `cordis_inspect_query` 只能由有活动 GUI 页面的前台父会话执行，后台子代理会无限等待。Host Inspect 和读已打包源码在子代理里安全。
- 必须交付持久化功能包；不得改成进程内 dynamic Cordis Plugin 来充数。
- 发布身份的形状由[票据 20](.scratch/dsh-composer-quick-actions/issues/20-choose-publishing-identity-and-license.md) 定案（无 scope、初始版本 `0.1.0`、MIT，copyright holder lovvvve；已排除 `@deepseek-ai` 与 `@dsh-plugins`），由[票据 17](.scratch/dsh-composer-quick-actions/issues/17-finish-install-bundle-and-release-docs.md) 落进两个 `package.json`、`cordis.patch.yml` 与四份 README；根 `LICENSE` 由 pnpm 打包时自动带入各 tarball，无需复制。**包名现为 `dsh-quick-actions` 与 `dsh-quick-actions-bundle`**——[票据 27](.scratch/dsh-composer-quick-actions/issues/27-publish-to-npm-and-list-in-market.md) 在首次发布前把票据 20 定的 `dsh-composer-quick-actions*` 缩短为与仓库同名（spec 第 19 节）。**改的只有 npm 包名**：Cordis 装载条目 id、两个 Settings 命名空间与本地化命名空间一律仍是 `composer-quick-actions`，它们是另一条身份轴，其中 Settings 那两个发布后就是用户数据。
- 在票据 27 resolved 之前**不要执行 `npm publish`**；两个包也始终不设 `publishConfig`（无 scope 的包默认就是 public）。
- 只提交自己负责的文件或 hunks，不要 `git add .`、`reset` 或 `clean`——本仓库常有其他会话的未提交产物。
- 审查子代理禁止在主工作区跑 install/typecheck（会刷新 gitignored 产物），用隔离临时归档。
- Client 构建适配器是**受控依赖的构建约束，不是恶意代码沙箱**。它拒绝间接 / 计算型 `require`、动态 `import` 与未声明 external，是为了让产物可预测、不悄悄夹带第二份 React；不要据此把它扩张成通用安全模型。
- **`@deepseek-ai/dsh-client-ui-primitives` 是 web shell 的构建期依赖**，由冻结 seed 表无条件提供（`makeRequire` 第一优先命中），磁盘上不存在该包也 require 得到；取证见 `research/client-ui-primitives-availability.md`。它必须同时出现在 `tsdown.config.ts` 的 `external` 与 `package.json` 的 `dsh.client.external`（票据 17 的契约测试做严格相等断言），devDependency **精确锁 `0.1.2-rc.1`**——`latest` dist-tag 停在陈旧的 `0.0.1-rc.1`，少 17 个导出且不发 CSS。它**没有 `forwardRef`**，`Button`/`Input`/`Pill` 都不能接 `ref`；开场焦点用 `modal.ts` 的 `useInitialFocusIn(container, selector)` 按标记属性寻址。它的裸 ESM 会 `import` 自己的 CSS Modules，所以 `vitest.config.ts` 必须把它列进 `test.server.deps.inline`，否则测试在 import 阶段就报 `Unknown file extension ".css"`。
