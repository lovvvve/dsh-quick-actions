# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 与 AGENTS.md 的关系

本仓库已有 [AGENTS.md](AGENTS.md) 作为通用代理指令，本文件不重复其内容。开始前先读：

1. [AGENTS.md](AGENTS.md) — 沟通语言、议题跟踪、分诊标签、领域文档三条规则的入口。
2. [docs/agents/issue-tracker.md](docs/agents/issue-tracker.md) — `.scratch/` 本地议题跟踪与 Wayfinder claim/resolve 约定。
3. [CONTEXT.md](CONTEXT.md) — 领域词汇（Quick Action / Preset / Custom / Insert / Send / Resident Composer 等）。**写代码、命名、文案、commit 一律使用这里定义的术语**，`docs/agents/domain.md` 提到的 `docs/adr/` 目前尚不存在。
4. [HANDOFF.md](HANDOFF.md) — 跨对话交接：哪些结论已闭合、哪些不得倒退。

## 项目状态（先看这条）

这是**进行中**的持久化 DSH 插件项目，不是已完成产品。`packages/composer-quick-actions` 已有共享领域模型 `src/model/`（票据 12）、Host `src/host/`（票据 13：配置合并、两个 Settings 命名空间、规范重写）、Client 控制器 `src/client/controller.ts`（票据 14）与 Composer 界面 + 动作执行 `src/client/{index.tsx,dsh.ts,session/,surfaces/}`（票据 15：两个 dock Slot 注册、Resident Composer 信标、三种布局、单飞发送与确认流程）。**管理面板、共享可搜索动作面板与自定义动作表单尚未实现**（票据 16）。

真正完成的有六件事：DSH 核心 `insertText` 补丁（`.scratch/.../core/`，仅作能力基线，**未合入官方，不得宣称正式上游版本**）、workspace + Client 构建适配器、共享领域模型（纯 JSON，`src/model/`）、Host 侧装配（`src/host/`）、Client 控制器，以及 Composer 界面与动作执行。**后三者都未经真实 DSH 运行验证**——功能包还没有安装进运行中的 DSH，Client 读取目录 `base`、常驻判定、等宽与端到端发送都归票据 18 在前台 GUI 会话实测。

## 命令

```bash
pnpm install                 # 仓库默认未安装依赖
pnpm test                    # vitest run，含真实 tsdown 构建，慢（watch 用例 35s 超时）
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

注意 `typecheck` 是**两遍**：`*.spec.ts` 和 `tsdown.config.ts` 不在项目引用里，只有第二遍 `tsconfig.test.json` 才覆盖它们；只跑 `tsc -b` 会漏掉测试侧类型错误。`lib/` 是 gitignored 的构建产物。

## 架构

### 三个 workspace 包

| 路径 | 角色 |
|---|---|
| `packages/composer-quick-actions` | Host + Client **双面功能包**，导出 `.`、`./client`、`./types`、`./remote`、`./package.json` |
| `packages/composer-quick-actions-bundle` | 安装 bundle，只有 `cordis.patch.yml`，把功能包 Host row 插进 DSH `web` profile |
| `tools/dsh-client-bundle` | 私有构建适配器（不发布），把浏览器 CJS 产物包成 DSH ModuleLoader 要的 lazy-CJS |

拆成两个包是刻意的：功能包提供实现，bundle 提供可 `dsh plugin --profile web add` 的安装形态。本地/离线安装要**分别解析两个 tarball**，bundle tarball 不内嵌依赖。

### Host / Client 双面

一个包同时被两侧加载，两侧都导出 Cordis 的 `inject` + `apply(ctx)`，但走完全不同的构建管线（见 `tsdown.config.ts` 导出的数组：`host` 配置 + `dshClientBundle(...)`）：

- **Host**：Node ESM，`lib/index.js` / `lib/types.js` / `lib/remote.js`。拥有 Settings namespace（`composer-quick-actions`，落在 `<DSH_HOME>/settings.yaml`）、预置目录校验与合并、只读 Catalog Remote (`remote.composerQuickActions`)。**Host 独占校验与迁移权威。**
- **Client**：browser-only 单文件 `lib/client.js`。通过 `settingsScope` / `remote.settings` 读写 Host 权威状态（每次修改携带预期 revision），注册 `conversation.input.dock` / `conversation.composer.dock` Slots。Client 不直接写文件、不用浏览器存储作权威源、不做迁移。

规范源码边界见 spec 第 14 节：`src/model/`（纯 JSON 领域模型，Host/Client 共享）、`src/host/`、`src/client/{controller.ts,surfaces/,manager/,session/}`、`src/locales/`、`src/styles/`。内部 controller、构建适配器实现不得成为公共导出。

### Client 构建适配器（`tools/dsh-client-bundle/src/index.ts`）

这是目前最有实质逻辑的代码，理解它才能改 Client 构建：

- 产物固定为 `lib/client.js` + sourcemap，用 `banner`/`intro`/`footer` 包成 `window.__ModuleLoader__.load({ id, factory: (require) => { ... } })`。
- **只有调用方在 `external` 里显式列出的 specifier 才能 `require`**；其余一律 `alwaysBundle`。一个 `renderChunk` AST 插件在构建期硬性拒绝：间接 `require` 引用（`const load = require`）、计算型 `require(id)`、任何 `ImportExpression`（动态 import）、未声明的 external。内部动态 import 必须被内联进同一产物。
- browser platform 在 tsdown 和 Rolldown `inputOptions` **两层**都强制，`conditionNames` 以 `browser` 优先——Node builtin、Node 条件导出会构建失败而不是悄悄进产物。`failOnWarn: true`。
- **原子发布**：先构建到相邻的 `lib.dsh-client-stage/`，`onSuccess` 才把 map、再把 js 逐个 rename 到 `lib/`。watch 构建失败时保留上一次完整成功产物。
- `tools/dsh-client-bundle/tests/bundle.spec.ts` 用真实 tsdown 子进程 + 假 ModuleLoader（`node:vm`）验证上述每条边界、sourcemap 原始位置映射和 watch 恢复。改适配器就要改这里，这些是契约测试不是 smoke test。

## 规格驱动的工作流

`.scratch/dsh-composer-quick-actions/` 是本项目的议题跟踪器：

- [`spec.md`](.scratch/dsh-composer-quick-actions/spec.md) 是 **baseline，冲突时以它为准**。第 1 节说明规范解释，第 14 节给出源码边界 → 票据映射，第 15 节记录首轮收尾决策，第 16 节记录首版范围收缩，**第 17 节记录目录改走 Settings base 层且优先级最高**。正文其余部分不得重开已关闭决策。
- [`map.md`](.scratch/dsh-composer-quick-actions/map.md) 是 Wayfinder 地图，`Decisions so far` 只放已关闭票据索引。
- `issues/NN-*.md`：开工前把 `Status:` 设为 `claimed`，完成时追加 `## Answer` 并设 `resolved`，再回填地图。frontier = 开放、未阻塞、未认领中编号最小者。当前 frontier 是 [16 实现管理、动作面板与发送确认](.scratch/dsh-composer-quick-actions/issues/16-implement-management-and-confirmation-ui.md)（16–18、20 均未认领）。
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
- **首版不新增任何 DSH 核心接口**。`insertText` 和 submit 凭据都不做。单飞窗口只能用公开 Input snapshot（`draft/imageIds/draftRev/phase/claim?/occurrences/queue`）判定，硬标准是不产生重复发送——注意官方 sink 乐观清空，`submit()` 后草稿一帧内就空了，"草稿已占用"不是互斥锁。

## 环境与陷阱

- 用 `pwd` 确认在本项目；DSH 部署目录和官方源码临时检出都不是这里。**不修改已安装的 `node_modules`**，核心补丁只在隔离的官方源码检出里验证。
- 现有 GUI 是 `http://127.0.0.1:3080`（非本项目启动）。`pnpm watch:client` **不等于** DSH GUI HMR；同一 DSH checkout 的 watcher 与页面加载关系必须实测。
- Client `cordis_inspect_query` 只能由有活动 GUI 页面的前台父会话执行，后台子代理会无限等待。Host Inspect 和读已打包源码在子代理里安全。
- 必须交付持久化功能包；不得改成进程内 dynamic Cordis Plugin 来充数。
- `0.0.0` 和当前无 scope 包名是脚手架身份，不是发布结论（票据 20 未决）；不要代填许可证。
- 只提交自己负责的文件或 hunks，不要 `git add .`、`reset` 或 `clean`——本仓库常有其他会话的未提交产物。
- 审查子代理禁止在主工作区跑 install/typecheck（会刷新 gitignored 产物），用隔离临时归档。
