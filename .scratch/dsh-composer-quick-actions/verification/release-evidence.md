# 发布证据

spec 第 13.1 节要求的统一证据文件。**追加式**：每张票据把自己的验证追加为一节，不要重写或删除既有节。最终候选（票据 21）要求全部证据新鲜通过。

不得记录凭据、授权头、真实用户数据或真实对话内容。

---

## 票据 17 — 安装形态与发布文档（2026-09-08）

### 环境

| 项目 | 值 |
|---|---|
| 运行时间 | 2026-09-08T14:48:53+08:00 起，同一工作树连续执行 |
| 分支 | `worktree-ticket-17-install-bundle-and-docs` |
| 基线提交 | `c687344`（票据 16 收尾）；本节验证的是在其之上的票据 17 变更集，随后拆分为多个提交 |
| Node | v24.18.0 |
| pnpm | 11.7.0 |
| `dsh --version` | `0.1.1-rc.2` — 这是桌面端**依赖集标签**，不是核心包版本 |
| `@deepseek-ai/dsh` | 0.1.2-rc.1 |
| 核心包 | `dsh-base` / `dsh-web-app` / `dsh-settings` / `dsh-client-modules` / `dsh-client-ui-renderer` / `dsh-client-ui-settings` / `dsh-client-connection` / `dsh-client-locale` / `dsh-client-ui-conversation` 均为 0.1.2-rc.1 |
| `@deepseek-ai/cordis` | 4.0.2 |
| `@deepseek-ai/schemastery` | 3.18.2 |

声明的 DSH peer 下界 `>=0.1.2-rc.1` 与上表核心包版本一致；本节所有安装证据都是在该核心版本上取得的。

### 质量门

| 命令 | 退出码 | 结果 |
|---|---|---|
| `pnpm typecheck` | 0 | 两遍（`tsc -b` + `tsc -p tsconfig.test.json`）均通过 |
| `pnpm lint` | 0 | `oxlint . --deny-warnings`，无告警 |
| `pnpm test` | 0 | 22 个测试文件全部通过；476 个用例通过 / 0 失败 |
| `pnpm build` | 0 | Host ESM + Client 单文件 lazy-CJS |

`pnpm test` 期间有一次真实失败并已修复：`docs.spec.ts` 的 “feature README.en.md documents the local tarball flow” 报 `expected … to contain 'pnpm pack'`——改写英文 README 措辞时把 `pnpm pack` 字面量丢了。修复后重跑为上表结果。该失败正是文档契约测试的目的所在，记录在此以说明它确实会拦住回归。

### 打包

```sh
cd packages/composer-quick-actions      && pnpm pack --pack-destination <out>   # exit 0
cd packages/composer-quick-actions-bundle && pnpm pack --pack-destination <out> # exit 0
```

| 产物 | 大小 | 条目数 |
|---|---|---|
| `dsh-composer-quick-actions-0.1.0.tgz` | 161426 B | 47 |
| `dsh-composer-quick-actions-bundle-0.1.0.tgz` | 3216 B | 5 |

功能包打包会先执行 `prepack`（`pnpm build`），因此 tarball 内产物必然新鲜。bundle tarball 的 5 个条目为 `package.json`、`README.md`、`README.en.md`、`cordis.patch.yml`、`LICENSE`——**不含**功能包、`node_modules/`、嵌套 tarball 或任何 `lib/`。`LICENSE` 由 pnpm 从仓库根自动带入两个包。

### 安装矩阵（隔离 `DSH_HOME`）

全部在 `DSH_HOME=<隔离目录>` 下执行，**未启动任何服务器**，未触碰用户的运行中 GUI（遵守 spec 第 13.3 节单通道约束）。每个变体前删除隔离目录重建。

| # | 命令 | 退出码 | 结果 |
|---|---|---|---|
| V1 | `dsh plugin --profile web add ./dsh-composer-quick-actions-bundle-0.1.0.tgz` | 1 | `ERR_PNPM_FETCH_404` —— pnpm 去 registry 解析 bundle 的传递依赖 `dsh-composer-quick-actions@0.1.0`，两个包按票据 20 决定尚未发布 |
| V2 | `add ./dsh-composer-quick-actions-0.1.0.tgz ./dsh-composer-quick-actions-bundle-0.1.0.tgz` | 1 | `ERR_PNPM_FETCH_404` —— 同一条命令里给出两个 tarball **也不行**：直接依赖不满足传递依赖 |
| V3a | `add ./dsh-composer-quick-actions-0.1.0.tgz` | 0 | 装上了，但打印 `dsh: warning: dsh-composer-quick-actions declares no dsh.bundle`（功能包本身不是 bundle 层，属预期） |
| V3b | 紧接 V3a 执行 `add ./dsh-composer-quick-actions-bundle-0.1.0.tgz` | 1 | `ERR_PNPM_FETCH_404` —— 先装功能包**同样不能**满足 bundle 的传递依赖 |
| V4 | 先在 profile 的 `pnpm-workspace.yaml` 写 `overrides: dsh-composer-quick-actions: file:<绝对路径>/dsh-composer-quick-actions-0.1.0.tgz`，再 `add ./dsh-composer-quick-actions-bundle-0.1.0.tgz` | 0 | **成功** |
| V5 | 重复 V4 的 `add` | 0 | 幂等：`dsh.profile.bundles` 无重复项 |
| V6 | `dsh plugin --profile web remove dsh-composer-quick-actions-bundle` | 0 | 依赖与层同时移除 |

**结论：两个 tarball 的唯一可复现解析方式是 profile 级 pnpm `overrides` 指向功能包 tarball 绝对路径 + `dsh plugin add` 指向 bundle tarball。** V1/V2/V3b 三条否证说明这不是可选优化。

### V4 成功后的落地状态

profile `package.json`（由 `dsh plugin` 自行回填，未手工编辑）：

```json
"bundles": ["@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app", "dsh-composer-quick-actions-bundle"]
```

`<profile>/node_modules/` 只有两项：`dsh-composer-quick-actions`（0.1.0，作为传递依赖 hoist）与 `dsh-composer-quick-actions-bundle`。

已安装功能包的完整文件清单（`lib/types/` 之外）：

```text
LICENSE  README.en.md  README.md  package.json
lib/client.js  lib/client.js.map  lib/index.js  lib/types.js
```

`lib/types/` 共 39 个文件，其中**非 `.d.ts` 者 0 个**。这就是本票据修掉的跨代发布缺陷的验证点：修复前 `tsc -b` 会往 `lib/types/` 发 JS 与 `.js.map` / `.d.ts.map`，`files` 再把它们打进 tarball，等于随包发布整包第二份未打包 JS（含一份 ModuleLoader 无法加载的 tsc 编译 Client）以及指向未发布 `src/` 的坏 sourcemap。

### 重启激活

```sh
dsh --profile web --dump-config    # exit 0，合成树共 136 条 row
```

输出中包含：

```text
# == dsh-composer-quick-actions-bundle
- id: composer-quick-actions
  name: dsh-composer-quick-actions
```

该层已进入下一次 profile 启动会应用的合成树。**这是结构性证据**，证明「装对了、下次启动会加载这条 row」；它**不**证明 Host 真的起来、Client 真的渲染。

### V6 卸载后的残留

`<profile>/node_modules/` 只剩 pnpm 自身元数据（`.modules.yaml`、`.pnpm`、`.pnpm-workspace-state-v1.json`），两个包均已移除；`dsh.profile.bundles` 回到 base + web-app 两项。

隔离目录内**没有** `settings.yaml`（从未启动过 DSH），因此本节**未能**验证卸载后用户 Settings section 的保留与手工清理效果——该项归票据 18。

### 本节未覆盖（留给票据 18 / 21）

1. 正式 registry 安装命令的形态：两个包按票据 20 决定尚未发布，V1 的 404 就是当前真实行为。发布之后才谈得上实测。
2. Host 真实加载、Client 从 `composer-quick-actions-catalog` 的 `base` 层读到目录快照、常驻判定、等宽、端到端发送与确认流程——全部需要运行中的 DSH GUI。
3. 卸载后 `<DSH_HOME>/settings.yaml` 中 `composer-quick-actions` section 的保留，以及手工彻底清理的逐条执行。
4. spec 第 11.2 节「关闭时不得遗留临时 staging」：经核查**不成立**，已拆为[票据 22](../issues/22-clean-client-staging-on-watch-close.md)，须在票据 18 收口前完成。
5. spec 第 13.2 节的自动化行为矩阵（0/1/6/25/50 动作、53 项被动超限等）与浏览器检查截图。

---

## 票据 24 — 打包验证与工作树隔离（2026-09-08）

### 环境

| 项目 | 值 |
|---|---|
| 运行时间 | 2026-09-08T16:50:19+08:00 起，同一工作树连续执行 |
| 分支 | `main` |
| 基线提交 | `70798a2`（票据 23 收尾 + 票据 24 立项） |
| Node | v24.18.0 |
| pnpm | 11.7.0 |
| 副本位置 | `mkdtempSync(join(tmpdir(), 'quick-actions-pack-'))`，仓库外 |

### 质量门

| 命令 | 退出码 | 结果 |
|---|---|---|
| `pnpm typecheck` | 0 | 两遍（`tsc -b` + `tsconfig.test.json`）均通过 |
| `pnpm lint` | 0 | 0 warning / 0 error |
| `pnpm test` | 0 | 22 files / 481 tests 全绿，11.72s；`tests/release/` 两个 spec 共 87 tests |
| `pnpm build` | 0 | 工作树 `lib/` 重新落地，无 `lib.dsh-client-stage` 残留 |

### 工作树不被触碰（票据验收第 1 条）

`pnpm test` 前后对 `packages/composer-quick-actions/lib/` 取 `find -printf '%P %s %T@'`（路径 + 字节数 + mtime，共 **44 个文件**）：

```text
$ diff lib-pre-test.txt lib-post-test.txt && echo "FULL pnpm test: LIB UNCHANGED (content+mtime)"
FULL pnpm test: LIB UNCHANGED (content+mtime)
```

同一条不变量已由 `packing isolation` 的三条断言固定在测试里（`size:mtimeMs:sha256` 指纹、副本必须在仓库外、packed 产物必须是副本本次构建的），回归会红而不是无人拦。

### 刻意失败后 `lib/` 仍完整（票据验收第 3 条）

往 `src/index.ts` 追加一行语法错误，跑 `tests/release/packaging.spec.ts`：

```text
❯ packages/composer-quick-actions/tests/release/packaging.spec.ts (27 tests | 27 skipped) 2948ms
⎯⎯⎯⎯⎯⎯ Failed Suites 1 ⎯⎯⎯⎯⎯⎯⎯
Error: Command failed: pnpm pack --pack-destination /tmp/quick-actions-pack-p0U0tV/tarballs
 Test Files  1 failed (1)
```

失败发生在副本的 `prepack` 构建期（正是修复前会先删掉工作树 `lib/` 的那一步之后）。工作树指纹比对：

```text
LIB INTACT AFTER FAILURE
```

随后从备份还原 `src/index.ts`（`git diff --stat` 为空）。

### watch 与 test 并存（票据「四种咬人方式」场景 2）

`pnpm watch:client` 在后台运行、首次发布完成后立即跑全量 `pnpm test`：

```text
watcher pid=3686272 first publish: yes
staging present while watching: no
lib fingerprint before test: 46796ad2ae005b5563cfd2636205562286853a115fc19a75d24c9a299449d6bb
 Test Files  22 passed (22)
lib fingerprint after test:  46796ad2ae005b5563cfd2636205562286853a115fc19a75d24c9a299449d6bb
COEXIST: lib untouched by the test run
client.js size: 146124  loadable: yes
watcher still alive after the test run
```

`node --check lib/client.js` 通过，说明并存期间线上 bundle 始终是完整可加载的产物。这条解除了票据 18 的前置风险：GUI 实测所需的 watcher 现在可以与验证同时运行。

### 打包契约覆盖面未缩水

副本构建出的 `lib/client.js` 为 146124 字节，与工作树 `pnpm build` 产物同尺寸；tarball 的 JS/map 清单仍是：

```text
package/lib/client.js  package/lib/index.js  package/lib/types.js
package/lib/client.js.map
```

两个 tarball 的 `LICENSE`、bundle 的 `dependencies: {"dsh-composer-quick-actions": "0.1.0"}`（`workspace:*` 已替换）均照旧成立——这两项是「副本仍是一个 pnpm workspace」的验证点，副本因此必须携带 `pnpm-workspace.yaml` 与根 `LICENSE`。

### 本节未覆盖

1. SIGTERM 关闭 watcher 后没有遗留 `lib.dsh-client-stage`，但构建失败后再关闭的路径仍归[票据 22](../issues/22-clean-client-staging-on-watch-close.md)，本节不作结论。
2. 一切 GUI 侧行为仍归票据 18；本节只证明验证流程不再破坏 GUI 所加载的产物。

---

## 票据 22 — Client scratch 目录关闭清理（2026-09-09）

### 环境

| 项目 | 值 |
|---|---|
| 运行时间 | 2026-09-09T00:04:36+08:00 起至 00:23:06+08:00，同一 worktree 连续执行 |
| 分支 | `worktree-ticket-22-staging-cleanup`（`.claude/worktrees/` 隔离检出） |
| 基线提交 | `3c46800`（票据 24 收尾） |
| Node | v24.18.0 |
| pnpm | 11.7.0 |
| tsdown / rolldown | 0.22.14 / 1.2.7 |

### 质量门

| 命令 | 退出码 | 结果 |
|---|---|---|
| `pnpm typecheck` | 0 | 两遍（`tsc -b` + `tsconfig.test.json`）均通过 |
| `pnpm lint` | 0 | 0 warning / 0 error |
| `pnpm test` | 0 | 22 files / **485 tests** 全绿，11.57s |
| `pnpm vitest run tools/dsh-client-bundle/tests/bundle.spec.ts` | 0 | 16 tests / 3.71s（基线 12 tests / 2.58s） |
| `pnpm vitest run packages/composer-quick-actions/tests/release/packaging.spec.ts` | 0 | 27 tests / 5.67s，打包契约未受影响 |
| `pnpm build` | 0 | `lib/client.js` 146124 字节 + map 落地，无 `lib.dsh-client-stage` 残留 |

### 关闭时机取证（票据决策 1 的依据）

`eval` + `failOnWarn` 的失败构建，插件钩子实际序列：

```text
[HOOK] buildStart
[HOOK] buildEnd          ← 无 error 参数
[HOOK] renderStart
[HOOK] generateBundle
[HOOK] writeBundle       ← 失败构建照样把产物写进了 scratch
[HOOK] closeBundle
```

错误是 rolldown 事后在 `unwrapBindingResult` 把升级后的警告聚合成 JS 错误抛出的，因此 `buildEnd(err)` / `renderError` 都拿不到错误：**失败与成功在钩子层面不可区分**，"按失败清理"不成立。tsdown 侧则确认进程退出时没有关闭钩子（`disposeCbs` 只在配置重载的 `restart()` 里执行，`q + enter` 直接 `process.exit(0)`，全无 SIGINT / SIGTERM 处理）。

`write: false` 实测：一次性构建完全不落盘（`generateBundle` 仍拿到 `client.js` 与 `client.js.map`，`writeBundle` 不触发，连 `lib` 都不建）；但 **watch 模式忽略它**，坏产物会被直接写进 `outDir`。故 `outDir` 仍指向同级 scratch，该选项不采用。

### 真实功能包 watch 实测（非 fixture）

```text
published after 5 polls: 1
scratch during watch: none
scratch after close: none
client.js size: 146124
```

`pnpm watch:client` 启动后正常发布与 `pnpm build` 同尺寸的产物；watch 期间与 SIGTERM 关闭之后，包目录都没有 `lib.dsh-client-stage`，watcher 自身正常退出（无遗留子进程）。

### 变异校验（新用例不是装饰）

| 刻意破坏 | 结果 |
|---|---|
| 删掉 `closeBundle` 里的 scratch 清理 | `leaves no build scratch behind when the watcher closes after a failed build` 立刻红，其余 15 条绿 |
| 删掉 `onSuccess` 的异常兜底 | `fails the build loudly when the generated client cannot be published` 立刻红，失败信息退化成裸的 `node:internal/fs/promises` unhandled rejection |
| 删掉 `buildStart` 里的预清理 | 仍全绿——`closeBundle` 连早期失败构建也会触发。预清理保留为「进程被强杀后无人清理」的唯一兜底 |

### 既有缺陷：`onSuccess` 不被 await（本票据顺手修掉）

`tsdown@0.22.14` 的 `executeOnSuccess` 为 `config.onSuccess(config, ab.signal)`，**既不 await 也不 catch**（`build-D_enfyvD.mjs:177`）。发布过程中的任何异常都会变成 unhandled rejection，在 Node 24 默认策略下直接打死 watcher，与第 11.2 节「修复后继续发布」相悖。修法：发布包在 try/catch 内，失败时打印带 `dshClientBundle:` 前缀的错误并设 `process.exitCode = 1`（与 tsdown 自身 `logger.error` 一致），watch 会话得以存活，一次性构建仍以非零退出码失败。

### 本节未覆盖

- 真实 DSH GUI 下的加载与端到端行为仍归[票据 18](../issues/18-run-integration-and-release-verification.md)。
- 进程被 SIGKILL、或在写盘与 `closeBundle` 之间被强杀时，scratch 会残留到下一次构建开始（由 `buildStart` 清掉）；该窗口进程内钩子无法覆盖，spec 第 11.2 节的「关闭时不得遗留」按正常关闭路径判定。

---

## 票据 18 — 运行集成与发布验证（2026-09-09，进行中）

本节随票据推进增量追加。本轮范围：安装形态在**真实运行的 DSH** 上执行、GUI 通道打通、非发送项的自动化断言。发送动作相关项按用户指示暂缓（不触发真实模型调用）。

### 环境

| 项目 | 值 |
|---|---|
| DSH 运行时 | `npx @deepseek-ai/dsh@latest web`，`latest` dist-tag 解析为 **0.1.2-rc.1**（`next` 同版，`alpha` 为 0.1.5-alpha.1） |
| 核心包版本 | `dsh-settings` / `dsh-client-ui-settings` / `dsh-client-connection` / `dsh-client-ui-conversation` / `dsh-client-ui-renderer` / `dsh-client-locale` 均 0.1.2-rc.1，`@deepseek-ai/cordis` 4.0.2 |
| peer 结论 | 插件声明 `>=0.1.2-rc.1`，与运行时**正好相等**，不存在版本缺口 |
| `DSH_HOME` | `~/.dsh`（用户自有环境，非隔离目录） |
| web profile | 已装 7 个第三方插件（dshmarket / dsh-context / dsh-codex-connect / remote-web-ui / better-sidebar / dsh-im / skill-explorer）+ `@deepseek-ai/dsh-base`、`dsh-web-app`；`patchReload: "live"` |
| PATH 陷阱 | 有两个 `dsh`：桌面 shim（内置 0.1.2-rc.1）会**优先 exec** 用户全局的 `0.1.1-rc.2`，因此安装命令必须显式走 `npx @deepseek-ai/dsh@latest`，否则用错运行时 |
| 浏览器 | Playwright 1.63.0 + Chromium 153.0.8010.12（headless shell） |
| 视口 | 1440×900 / 768×900 / 360×780（spec 第 13.3 节的桌面 / ~768 / ~360） |

### 安装：README 离线流程逐条执行

1. **打包**通过：`dsh-composer-quick-actions-0.1.0.tgz`（165372 B）、`dsh-composer-quick-actions-bundle-0.1.0.tgz`（3216 B）。tarball 内容核对：`lib/` 每入口只有一份 JS（client/index/types）+ 唯一一份 `client.js.map` + 声明目录 + 两份 README + LICENSE；`client.js` 末尾 `//# sourceMappingURL=client.js.map` 完好（票据 22 的内存发布路径经 pack 验证）。
2. **profile override** 追加到 `<DSH_HOME>/profiles/web/pnpm-workspace.yaml`，指向功能包 tarball 绝对路径。
3. **`dsh plugin add` 首次失败**，且与本插件无关：`ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` —— 用户 profile 现有 lockfile 里有 3 个第三方插件版本落在 pnpm 默认 24h 窗口内（`@linxin666/dsh-client-ui-skill-explorer@0.3.18`、`@linxin666/dsh-remote-web-ui@0.3.18`、`dsh-better-sidebar@0.18.1`）。
   - **附带发现（pnpm 11.7.0 缺陷）**：`minimumReleaseAgeExclude` 对 **scoped 包无效**。三种写法逐一实测均不生效：`'@scope/name@version'`、`'@scope/name'`、`'@scope/*'`；同一次实测里无 scope 的 `dsh-better-sidebar@0.18.1` 一次即生效。用户配置里原有的 `'@linxin666/dsh-remote-web-ui@0.3.18'` 因此一直是空转条目。
   - **处置**：改用**仅作用于该次命令**的 `--config.minimumReleaseAge=0` 完成安装，不持久化任何策略变更；用户 profile 的 `minimumReleaseAgeExclude` 列表已与安装前逐字还原（仅保留 override 块）。
4. **安装结果**符合 README「安装后应当看到什么」：`--dump-config` 中出现 `# == dsh-composer-quick-actions-bundle` 层贡献的 `- id: composer-quick-actions` / `name: dsh-composer-quick-actions`；功能包以传递依赖落在 `<DSH_HOME>/profiles/web/node_modules/dsh-composer-quick-actions`（`lib/` 下 client.js、client.js.map、index.js、types.js、types/）；pnpm 打印 peer 警告，与 README 说明一致。
5. **`patchReload: "live"` 不会热接新插件 row**（实测）：安装完成后，已运行的 web 服务与页面刷新都看不到插件表面；重启 web profile 后才出现。README 第 4 步「重启 web profile」的必要性由此确认，不能因 `patchReload: live` 省略。

### GUI 通道

- 根路径返回 **401**，正文为 `dsh web authentication required; reopen the URL printed by dsh web`：凭据在启动时打印的入口 URL 的 `token` query 里。**全新 Chromium profile 兑换该入口 URL 即可进入**，无需设备配对。token 只经环境变量传入，不入仓库、不入本证据。
- **Resident Composer 判定实测通过**：hero 屏（空会话）不挂 `conversation.composer.dock`，插件零渲染（`data-quick-actions-layout` / `data-quick-actions-manage` 计数均为 0）；进入有历史的会话后表面出现。与票据 15 的公开信标设计一致。
- DSH 会话是**纯客户端路由**，切换会话不改变 URL，因此没有可直接导航的会话路径；窄视口下侧栏收起。harness 据此固定为「桌面尺寸进入会话 → 再缩到目标视口」，这也正是 spec 第 13.3 节响应式检查所描述的行为。
- 用户环境自带的 `remote-web-ui` 在启动时打出 CRITICAL：`/api` 围栏对三个 LAN 地址开放，未配对客户端可达完整 host API。与本插件无关，已向用户报告。

### 已确证的行为（真实 GUI）

| 项 | 证据 |
|---|---|
| **Catalog `base` 端到端**（票据 14 挂起项） | Resident Composer 下渲染出恰好 3 条内置预置：`📝总结对话`、`🔍解释改动`、`🧹压缩上下文命令`；目录经只读 Settings 命名空间的 composition `base` 层送达 Client |
| 默认布局 | `data-quick-actions-layout="ribbon"`、`data-quick-actions-density="wide"` |
| **等宽（硬门槛 ≤1 CSS px）** | ribbon cell `left 468.8 / right 1243.2 / width 774.4`，Composer 卡片 `left 468.8 / right 1243.2 / width 774.4` —— **误差 0.0 px** |
| **官方 primitives 真实可用**（票据 23 挂起项） | 动作按钮 class 同时包含 primitives 的 CSS Modules 哈希类 `_button_cfgyt_4 _toolbar_cfgyt_65 _sm_cfgyt_30` 与插件自有的 `dsh-cqa-action`，证明模块表 `require('@deepseek-ai/dsh-client-ui-primitives')` 解析到官方 `Button` |
| 三种布局 | `ribbon` / `bar` / `launcher` 均在管理面板切换成功并渲染；`launcher` 的单入口打开 B/C 共用搜索面板，搜索框开场自动获得焦点，输入「压缩」后命中 1 条 |
| Settings 持久化 | 切到 `bar` 后**刷新页面**仍为 `bar`（Host Settings 为权威源，Client 重新装载后恢复） |
| 键盘与无障碍 | 管理 overlay 为 `role="dialog"` 且带 `aria-labelledby`；`Escape` 关闭后焦点**返还管理入口** |
| 窄视口 | 768 与 360 下表面不溢出视口、宽度跟随输入框（差值 ≤8px，即 Composer 边框） |
| 持久化形态 | 测试结束后 `<DSH_HOME>/settings.yaml` 的插件命名空间为规范化默认态：`layout: ribbon`、`userActionsById: {}`、`presetStateById: {}`、`actionOrder` 三条预置按 id 引用（`summarize-thread` / `explain-last-change` / `compact-context`） |

### 自动化结果

`pnpm verify:gui`（36 条 = 12 条 × 桌面 / 768 / 360 三个视口）：**35 条一次通过，1 条（360 下的 launcher 搜索面板）为导航偶发，重试即过**，13.0 分钟。该套已配置 `retries: 1` 并注明理由——通道是用户自己的实时 DSH，里面还有 7 个第三方插件，进入会话不是密闭操作；真实失败会连续失败两次而不会被重试掩盖。

排查过程中确认的两个**环境**事实（都不是插件缺陷，但会让任何 GUI 自动化踩坑）：

1. **第三方 shell 浮层会吞掉指针事件**：`dshmarket` / `dsh-codex-connect` 的版本提示挂在 `[data-shell-overlay="true"]` 层，窄视口下覆盖 Composer 区域，导致对本插件控件的点击被拦截（报错原文：`... intercepts pointer events`）。harness 先点它自己的「稍后提醒」，否则把该层移出命中测试路径。
2. **侧栏会话树是嵌套的**：工作区行（`role="treeitem"`）内部才嵌着会话行，点击工作区行会折叠它、反而藏掉会话。只能点**叶子** `treeitem`。

### 证据的隐私约束

快捷动作只在 Resident Composer 渲染，而 Resident Composer 必然是用户自己的会话，因此 Playwright 的**自动全页截图与 trace 一律关闭**（`screenshot: 'off'`、`trace: 'off'`、`video: 'off'`）：全页捕获会把真实对话内容写进证据，违反本文件开头的约束。需要图像的用例改为对 composer 区域做裁剪截图。断言只读插件自有的 `data-quick-action*` 标记与几何量，不读会话内容。

### 第 13.2 节行为矩阵对账（485 条自动化的归属）

第 13.2 节要求「覆盖率以行为矩阵而非统一行覆盖率为门槛」。逐条核对现有 22 个 spec 文件 / 485 条用例的归属，**矩阵在模型 / Host / Client 三层已完整**，缺口只剩需要真实 GUI 或真实模型调用的项：

| 第 13.2 节条目 | 承接位置 |
|---|---|
| 0、1、6、25、50 个正常动作 | `model/projection.spec.ts:101` —— `it.each([0, 1, 6, 25, QUICK_ACTION_TOTAL_LIMIT])` |
| 53 个既有动作无损被动超限 | `client/controller.spec.ts`、`client/manager.spec.tsx` |
| 隐藏与停用动作计数 | `model/projection.spec.ts`、`model/settings.spec.ts`、`model/mutations.spec.ts` |
| 模型不变量、默认值、校验与迁移分支 | `model/validation.spec.ts`、`model/settings.spec.ts`、`model/normalize.spec.ts` |
| 排序重复引用 / 失效自定义引用 / 未知预置保留 / 缺失动作追加 | `model/normalize.spec.ts` |
| 预置新增、文案更新、移除、重新加入、行为签名换 ID | `model/catalog.spec.ts` |
| 幂等规范重写、目录 revision 稳定性、revision 冲突 | `model/normalize.spec.ts`、`model/catalog.spec.ts`、`model/mutations.spec.ts` |
| Host 等待 settings-file 后端、注册/卸载、无效配置、重复 ID、超限目录 | `host/host.spec.ts`、`host/config.spec.ts`、`host/settings.spec.ts` |
| Settings 持久化先于 UI 提交；写入拒绝与 revision 冲突分类 | `client/controller.spec.ts`、`client/manager.spec.tsx` |
| 首次目录失败、首次 Settings 失败、只读、断线与重连 | `client/controller.spec.ts:191`（断线期间只读地继续服务最后确认快照）等 |
| 每连接 generation 最多一次目录读取、无按动作 RPC | `client/controller.spec.ts`（`generation` 用例组） |
| fiber dispose 后无监听器 / Remote / namespace / 样式 / 订阅泄漏 | `client/plugin.spec.ts:155`（fiber unload 时释放每一项注册与订阅） |
| 三种布局、溢出、搜索、管理、确认、宽窄响应式、焦点 | `client/layout.spec.ts`、`client/surfaces.spec.tsx`、`client/manager.spec.tsx`、`client/search.spec.ts` |
| 占用草稿、最终重验、确认取消、动作删除、会话切换、按会话单飞 | `client/execution.spec.ts` |
| 模型运行期 queue、装载后失败草稿保留、失败不重复报错 | `client/execution.spec.ts` |
| 规范化恒写 `kind: 'send'`；Host Config 非 `send` 加载失败 | `model/normalize.spec.ts`、`host/config.spec.ts` |
| 已存储 `kind: 'insert'` 墓碑保留与降级往返无损 | `model/normalize.spec.ts`、`model/projection.spec.ts`、`model/settings.spec.ts` |
| Command Send Action 三种判定 | `model/text.spec.ts:11/15/19`（前导 `/`、空白后 `/`、非 `/`） |
| 规范化不改写 `confirm` | `model/normalize.spec.ts`、`model/lifecycle.spec.ts` |
| 命令动作确认开 / 关的面板与执行路径 | `client/execution.spec.ts`、`client/surfaces.spec.tsx` |
| 两个包的 build / bundle / pack / 安装（两个 tarball 明确解析） | `release/packaging.spec.ts`、`tools/dsh-client-bundle/tests/bundle.spec.ts`，安装矩阵见本节与票据 17 节 |
| README 步骤逐条执行 | 内容契约由 `release/docs.spec.ts` 固定；**执行**由本轮在真实 DSH 上完成（见上「安装」与「卸载」两节） |
| stop / update / unload / 卸载 / 重装 / 重启激活 / 配置恢复 | `model/lifecycle.spec.ts`、`client/plugin.spec.ts`、`host/host.spec.ts`；真实 DSH 上的重装恢复与重启激活仍缺 |

因此第 13.2 节的**剩余缺口**只有三类，且都必须在真实 GUI 或获得模型调用许可后才能补：GUI 层的规模矩阵与截图基线、跨 DSH 重启的持久化与重装恢复、全部发送动作项。

### 卸载（按用户指示于本轮收尾执行）

`plugin --profile web remove dsh-composer-quick-actions-bundle`（同样需要一次性 `--config.minimumReleaseAge=0`）后逐项核对：

| 检查 | 结果 |
|---|---|
| 合成 profile 树 | `--dump-config` 中 `composer-quick-actions` 出现次数 **0**，row 已消失 |
| `profiles/web/package.json` | 与安装前**逐字一致** |
| `profiles/web/pnpm-workspace.yaml` | 与安装前**逐字一致**（override 块与注释一并删除） |
| `profiles/web/node_modules` | 功能包已移除 |
| `settings.yaml` | 插件命名空间整块移除（安装前本就不存在该命名空间），用户其余 4 个命名空间原样保留 |

GUI 层的「UI 消失」观测存在**混淆，不作为结论**：卸载落盘（07:26:09）时 3080 上是桌面应用于 07:23:59 启动的服务，该服务既可能因 `patchReload: "live"` 对移除热生效而卸下插件，也可能本就走 shim 优先的全局 `0.1.1-rc.2` 运行时（不满足插件 peer）。诊断确实读到 `layoutAttr: null` / `actionCount: 0`，但在受控服务下的复测留给下一轮。


### 第二轮（2026-09-09）：规模矩阵与跨重启持久化

第二轮同样在用户实时 DSH 上开临时安装窗口，收尾照旧卸载并还原。仍不触发真实模型调用。

#### 规模矩阵（spec 第 13.2 节的六行，全部通过）

规模按 spec 的成因写入存量状态（`tests/gui/seed-scale.mjs` 写 `<DSH_HOME>/settings.yaml` 的插件命名空间，目标 <3 时按需隐藏预置，其余用自定义动作补足），再启动 profile 断言，由 `tests/gui/scale-round.sh` 串起「种子 → 启动 → 断言」：

| 规模 | 种子构成 | 结果 |
|---|---|---|
| 0 | 3 条预置全部隐藏 | 通过（空投影，管理入口仍在） |
| 1 | 1 条预置显示、2 条隐藏 | 通过 |
| 6 | 3 预置 + 3 自定义 | 通过 |
| 25 | 3 预置 + 22 自定义 | 通过 |
| 50（恰满上限） | 3 预置 + 47 自定义 | 通过，管理面板 `data-quick-actions-limit="reached"` |
| **53（被动超限）** | 3 预置 + 50 自定义 | 通过：**53 条全部渲染、不丢数据**，`data-quick-actions-limit="overflow"`，新增按钮 `disabled` |

每行三条断言：投影渲染出全部动作、超限状态与种子总数相符、该规模下表面仍不溢出视口。

#### 跨 DSH 重启的持久化

`tests/gui/restart-round.sh` 分两趟跑 `restart.spec.ts`，中间真重启 profile：

```text
=== choose the layout ===        stores the chosen layout … ✓（切到 bar）
=== restart the harness … ===    restores the stored layout … ✓（回到 bar）
```

Host Settings 是权威源，Client 重启后取回存储布局而非默认值。两趟各自用 describe 级 skip 屏蔽另一半，因此单跑 `pnpm verify:gui` 时它们显示为 skipped，而不会在没有重启的情况下「假通过」。

#### 本轮对 harness 的三处修正（都是真实环境的性质，不是插件缺陷）

1. **冷启动首次挂载慢**：服务打印入口 URL 早于应用能服务第一次客户端加载。首次挂载预算放宽到 25s、用例超时 90s，并在驱动脚本的 `boot()` 里加 8s 静置——此前「每次启动后第一条用例要重试」就是这一条。
2. **会话发现代价**：每试一个叶子行都要付一次完整挂载等待，四次未命中就吃掉整个用例预算。改为记住上次成功的叶子序号并优先重试。
3. **端口释放**：`npx` 启动的服务真正持有 socket 的是孙进程，`pkill` 打到中间层后端口仍被占，下一次启动直接 EADDRINUSE 且不打印入口 URL。驱动脚本改为杀干净后轮询到端口关闭再启动。

#### 第二轮的完整回归

修正后重跑全套：**45 条通过 / 6 条 skipped（重启两半按设计跳过）/ 0 失败，4.0 分钟**（第一轮同一套 13.5 分钟——会话发现缓存把每条用例的固定开销去掉了）。用例总数 51 = 17 条 × 桌面 / 768 / 360。

**这个数字须按代码审查的发现打折**：当时 `scale.spec.ts` 没有驱动守卫，普通 `verify:gui` 会以「at 3 actions」跑三条**未种任何种子**的用例（每视口 3 条、共 9 条），它们只是在断言出厂三条预置，与真正的规模行无法从日志区分。守卫已补（无 `DSH_QA_EXPECTED` 时组级 skip），因此该套的有效计数应读作 **36 条通过 + 15 条 skipped**；六行规模矩阵的结论不受影响——那是 `scale-round.sh` 逐行种子后单独跑出来的。

### 下一轮必须先修的 harness 卫生问题

本轮结束时发现测试**误建了 2 条克隆动作**（`总结对话`、`压缩上下文`，带 `clonedFromPresetId`），已随命名空间清除。管理面板用例必须改成严格只读，或在每次运行前后重置插件命名空间；否则规模矩阵（0/1/6/25/50）会被残留数据污染。

### 本轮未覆盖

- 发送动作全部项（单飞、确认面板、失败草稿保留、命令发送动作的两种确认设置、queue）——按用户指示不触发真实模型调用，暂缓。
- 布局切换 / 管理面板 / 搜索面板 / 键盘与无障碍的窄视口结果，以及 0/1/6/25/50 与 53 项超限降级的规模矩阵。
- Settings 跨 DSH 重启持久化、卸载与重装、生命周期 stop/update 清理。
- 截图基线（三种布局 × 桌面/窄）。
