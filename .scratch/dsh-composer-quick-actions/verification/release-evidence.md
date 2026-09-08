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
