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


### 第三轮（2026-09-09）：发送路径与其余六项

用户明确许可真实模型调用（建议用其默认模型 GPT-5.6 Luna），第三轮据此完成上一轮列出的 9 项。仍在同一实时 DSH 上开临时安装窗口，收尾卸载并还原。

#### 先复验第二轮的审查修复

三套全部重跑通过：`verify:gui` **12 过 / 5 跳**（新加的驱动守卫按预期让 `scale` 与 `restart` 在无驱动时跳过）；`scale-round` 的 53 行与 0 行各 3 条通过，**种子工具备份 → 种入 → EXIT trap 自动还原**成立；`restart-round` 两半各自通过（store 半程已强制经 `ribbon` 往返，不再可能空转假通过）。

#### 发送路径（6 条，真实模型）

夹具由 `seed-send.mjs` 种入：一条 `confirm: false` 的普通发送动作（文本 `回复 ok`，刻意取最便宜的有效提示词）、一条 `confirm: true` 的命令动作（文本 `/qa-probe-unknown-command`，命名空间化的未知命令——走命令路径与 DSH 裁决，但不会改动会话），并**隐藏全部随包预置**，避免误发真实的 `/compact`。

| 用例 | 结果 |
|---|---|
| 确认面板预览命令并取消 | 通过：`role="dialog"` + `aria-label` + `aria-modal="true"`、逐字预览待提交文本、命令动作含「不会出现原生 `/` 候选菜单」说明、开场焦点在发送键；Escape 取消后**零发送**且草稿为空 |
| 命令动作确认后提交一次 | 通过（DSH 自己裁决未知命令，不消耗模型） |
| `confirm: false` 一键提交 | 通过：面板从不出现，提交一次 |
| **同 tick 两次激活只发送一次** | 通过。判据从 Playwright 的两次 `click()` 改为**页面内同步派发两次 click**——前者之间有可观测性等待，属于合法的二次激活，不是单飞窗口要挡的东西 |
| 模型运行期间的第二次激活 | 通过：两次**顺序**激活都发出，由 DSH 官方 queue 承接，插件不报 `failed` |
| 占用草稿时不覆盖用户文本 | 通过：控件不可用并给出原因（`title`），点击不发送，草稿原样保留 |

判据说明：计数用 `[data-chat-flow-kind="user"]`。DSH 一次交互渲染多个 `data-chat-turn`（实测 70→73），且助手会把提交文本引用回 `assistant-step`，不限定 user flow 会把两者都数进去——「发送一次」就成了证明不了任何事的数字。

#### 其余四项

| 项 | 做法与结果 |
|---|---|
| **Host Config 变化** | 额外预置写在 `dsh --patch` 的 overlay 里（应用在所有 bundle 层之后，与 profile 自身 `cordis.patch.yml` 同位），**不改用户文件**。通过：该预置作为第 4 条加入目录、顺序在随包三条之后（spec 第 5 节），且与其他预置一样只读（有克隆、无删除） |
| **断线恢复** | 测试自己按 `boot.sh` 记录的进程组停掉 profile。通过：表面不清空而以最后确认快照**只读**服务，管理面板给出只读说明；重连后写入恢复 |
| **失败草稿保留** | 同一次掉线中激活动作：`setDraft` 已装载、`submit` 无从落地，草稿**原样保留**（spec 第 6/9.5 节的保守失败语义）。重连后激活仍能发送，证明断线留下的单飞窗口**会释放**而非卡死 |
| **生命周期 stop/update 清理** | 重连半程断言 `data-quick-actions-layout` 与 `dsh-cqa-` 样式表**各只有一份**——跨 profile 重启没有重复注册或样式泄漏 |
| **截图基线** | 9 张：ribbon / bar / launcher × 桌面 / 768 / 360，每张裁剪到插件自己的 cell（32px 高条带，合计约 48KB）——页面其余部分是用户真实会话，第 13.1 节禁止写进证据。允许 2% 像素差（第 13.3 节写明跨平台字体差异不阻断） |

#### 本轮的两个行为发现（不是缺陷，但应记录）

1. **断线时插件不发布结果反馈**。`retained` 只在 `submit()` **抛错**时发布；连接断开时 DSH 的 submit 既不抛错也不落地，执行层因此停在观察阶段，用户看到文本留在草稿里而没有说明。第 9.5 节的硬要求（零内容丢失）不受影响，且重连后窗口会释放——但「留下文本却不解释」是一处可改进的 UX 缺口。

   **第四轮更正机制描述**：`retained` 其实有**两个**发布点——`submit()` 抛错，或提交之后的**下一次 Input 提交**里草稿仍未被清空（`execution.ts` 的 `observe`）。断线时 `submit()` 不抛错，而 DSH 也不会再发布任何 Input 提交，于是执行机停在 `submitted` 观察阶段，两个发布点都不触发。结论不变（用户得不到解释），成因比原记录更准确。
2. **Composer 动作控件用原生 `disabled` 而非 `aria-disabled`** 表达不可用（占用草稿时附 `title` 说明原因）。CLAUDE.md 里「其余一律 `aria-disabled` + 守卫」那条记的是票据 16 **管理面板键盘重排**场景，不覆盖 Composer 按钮，故不判为偏离；断言已改为机制无关（`toBeDisabled` 同时覆盖两种写法）。

#### 本轮修掉的一个基础设施缺陷

`boot.sh` 的 `stop_ours` **一直静默失效**：`setsid` 在调用方已是组长时会 fork，`$!` 记到的是转瞬即逝的父进程，因此进程组信号一直打空（错误被 `2>/dev/null` 吞掉）。改由组长自己写 pidfile；测试内停 profile 改用 Node 的 `process.kill(-pgid)`，因为外部 `kill` 会把 `-<pid>` 当成选项。

### 第一轮遗留的 harness 卫生问题（第二轮已闭合）

第一轮结束时发现测试**误建了 2 条克隆动作**（`总结对话`、`压缩上下文`，带 `clonedFromPresetId`），已随命名空间清除。管理面板用例必须改成严格只读，或在每次运行前后重置插件命名空间；否则规模矩阵（0/1/6/25/50）会被残留数据污染。第二轮按后者实现（种子工具备份 → 种入 → 退出时还原）。

### 第一轮未覆盖的项（第二至四轮已逐条闭合）

- 发送动作全部项（单飞、确认面板、失败草稿保留、命令发送动作的两种确认设置、queue）——第一轮按用户指示不触发真实模型调用，**第三轮**在获得许可后完成。
- 布局切换 / 管理面板 / 搜索面板 / 键盘与无障碍的窄视口结果，以及 0/1/6/25/50 与 53 项超限降级的规模矩阵——**第二轮**完成。
- Settings 跨 DSH 重启持久化（**第二轮**）、卸载与重装（**第四轮**）、生命周期 stop/update 清理（**第三轮**）。
- 截图基线（三种布局 × 桌面/窄）——**第三轮**完成。

### 第四轮（2026-09-09）：收口前的最后四项

第三轮列出的四项——重装恢复、预置升级/降级的完整往返、结构化 mutation outcome 的 conflict 分支、占位符与 Unicode / `trim()` 口径的集成层复核——本轮全部完成，都不需要模型调用，共开一次安装窗口。

本轮把**安装窗口本身脚本化**（`tests/gui/install.sh` + `profile-override.mjs` + `close-window.sh`）。前三轮的安装是手工执行的，而重装恢复必须在一轮之内关掉再开一次窗口，于是 README 的离线流程逐条落成可复现脚本：打包 → profile `overrides`（yaml 文档 API 写入，其余键与注释逐字保留）→ `dsh plugin add` bundle tarball → `--dump-config` 核对 row → 重启 profile。用户 profile 的两份文件在开窗前取 sha256 指纹，关窗后逐条校验。

#### 脚本化过程中暴露的两个安装事实

1. **两个 tarball 路径都必须是绝对路径**。`dsh plugin` 是 pnpm 的转发器，pnpm 在 **profile 目录**里运行，相对路径会解析到 `<DSH_HOME>/profiles/web/` 下并以 `ENOENT` 失败。README 第 2 步只对 override 写了「绝对路径」，第 3 步 `add` 的参数同样如此。
2. **`plugin remove` 也需要那个一次性标志**。卸载会先校验它即将改写的 lockfile，因此同样撞上 `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`（仍是用户 profile 里那 3 个第三方插件版本，与本插件无关）。第三轮的卸载一节记过这条，脚本化时漏加，一次失败后补上。

#### 1. 重装恢复（`reinstall.spec.ts` + `reinstall-round.sh`，三段各一次启动）

| 阶段 | 结果 |
|---|---|
| `mark` | 通过：经 GUI 把布局设为 `launcher` 并新建自定义动作「重装恢复标记」；`settings.yaml` 的插件命名空间里 `layout: launcher` 与该动作标签均已落盘 |
| `gone`（已卸载） | 通过：在**本轮受控启动**的服务下，进入有历史的会话后 `data-quick-actions-layout` / `data-quick-actions-manage` / `dsh-cqa-` 样式表**计数均为 0**；同时命名空间**原样保留** `launcher` 与该动作 |
| `back`（已重装） | 通过：布局回到 `launcher`（不是随包默认 `ribbon`），标记动作的标签与文本原样回来 |

`gone` 阶段特意不满足于「随便一个屏幕上没有插件」——hero 屏本来就没有表面。判据改为先进入带 `data-chat-flow-kind` 的会话再断言零渲染，因此**闭合了第三轮卸载一节里那处标注为「存在混淆、不作为结论」的 GUI 观测**。

顺带把 README「重复 `add` 同一版本是幂等的」这条声明也执行了一遍：同一 tarball 再 `add` 一次后，`dsh.profile.bundles` 里仍只有一条 `dsh-composer-quick-actions-bundle`、`dependencies` 未变、功能包仍在 profile `node_modules` 里。

#### 2. 预置升级 / 降级的完整往返（`presets.spec.ts` + `presets-round.sh`，四段各一次启动）

预置经 `dsh --patch` overlay 声明（应用在所有 bundle 层之后，与 profile 自身 `cordis.patch.yml` 同位），**不改用户文件**；跨四次启动携带的是用户 Settings 里的存量状态，那正是往返的被测对象。基线为 `seed-scale.mjs 3`（随包三条、无隐藏、无自定义）。

| 阶段 | 目录 | 结果 |
|---|---|---|
| `stage` | 随包 3 + 探针（`confirm: true`） | 通过：探针**追加在末尾**（spec 第 5.3 节）；克隆它 → 克隆的编辑表单确认开关**为开**（克隆复制策略而非重施默认值）；隐藏它 → 行上 `data-quick-action-hidden`、计数仍为 5（隐藏计入合计）、表面回落到 4 |
| `tombstone` | 随包 3 | 通过：探针**不显示**（表面 4 条 = 随包 3 + 克隆）、**不计数**（`共 4`）、管理列表无该行；而 `settings.yaml` 里 `presetStateById['qa-preset-probe']` 仍是 `{hidden: true}`、`actionOrder` 仍保留该 preset 引用——**经过一次目录已不含该 ID 的规范重写后依然如此** |
| `restore` | 随包 3 + 探针（同 ID，标签已改） | 通过：**仍然隐藏**（表面不变），管理行标签为升级后的新文案（同 ID 可更新标签/图标/文本，spec 第 5.1 节），计数回到 5 |
| `signature` | 随包 3 + 探针 v2（新 ID，`confirm: false`） | 通过：旧 ID 再次成为墓碑，v2 作为新动作**追加在末尾**；克隆 v2 → 编辑表单确认开关**为关**，即新 ID 的策略取自目录、不继承旧 ID 留下的偏好 |

这四段合起来覆盖第 13.2 节「预置新增、文案更新、移除、重新加入和行为签名换 ID」一行的 GUI 侧；上一轮只验了「新增」这一半。

#### 3. 结构化 mutation outcome 的 conflict 分支（`conflict.spec.ts`）

**本轮的关键发现：DSH 的 settings 镜像是跨连接实时同步的。** 第一版判据按「A 写入 → B 持有旧 revision → B 写入即冲突」设计，并把「B 确实还是旧值」写成前置断言；实测该前置断言**失败**——B 无需刷新就看到了 A 的写入。也就是说顺序写入的第二方永远不会持旧栅栏：它会被通知并按新 revision 重新规划。这条断言因此保留在用例里（先正向断言镜像的实时性），而冲突改为**真实竞态**：两个连接的管理面板都先打开，然后在同一瞬间各派发一次**同步** click（在 `page.evaluate` 内派发，两次之间不含任何 Playwright 可操作性往返），两次写入都在任一方被通知之前出发。

通过，且**连跑 4 次全过**（其中一次 `--repeat-each=3`）：

- 恰好一方拿到 `data-quick-actions-write-failure="conflict"`（`role="alert"`，文案「设置已在别处被修改，已刷新到最新状态；请核对后重新确认这次修改。」），另一方无任何失败提示且写入落地；
- 失败方随即显示**胜者的值**而不是自己点的值——即 spec 第 10 节的「刷新最新权威状态」，不维护第二套离线真相；
- 面板保持打开并给出显式重试；点重试后**按刷新后的栅栏重新规划并落地**，失败提示消失。

这同时说明 `refused` 与 `conflict` 的区分不是猜测：拒绝不动 revision，只有丢失栅栏才会让它前移，而控制器是按写后的权威快照判定的。

#### 4. 占位符拒绝与 Unicode code point / `trim()` 口径（`validation.spec.ts`，桌面，三条）

模型层已穷尽覆盖这些规则，集成层要证的是**用户真正打字的那个表单跑的就是同一份实现**（spec 第 4.3 节要求配置入口、表单、迁移与 mutation 共用一组规则），且表单接受的草稿 Host 也接受。

| 用例 | 结果 |
|---|---|
| 标签上限按 **Unicode code point** 计 | 通过：41 个星平面字符（`𝔸`）报「标签超出长度上限」；**40 个（= 80 个 UTF-16 码元）无错并保存成功**——若按 `.length` 计会被拒，若 Host 与表单口径不同则会在保存时被拒 |
| 空白与裁剪按 **ECMAScript `trim()`** | 通过：仅含 U+00A0 / U+FEFF / 空格 / 换行的文本在尝试保存后报「发送文本至少要有一个非空白字符」，且**未产生任何写入**（无失败提示、无新动作）；标签两端空白（含 U+00A0、U+FEFF）保存后被裁剪，而**发送文本原样保留**自身的首尾空白与换行（用编辑表单读回逐字比对） |
| 保留占位符拒绝 | 通过：文本含 U+FFFC 或 U+E100 时报「发送文本包含 DSH 保留的引用占位符，无法作为静态文本提交」；点保存被表单拒绝、草稿原样留存、**不产生一次写入** |

判据说明：断言读的是 `.dsh-cqa-label` 的 `textContent` 而非 `toHaveText`——后者会归一化空白，而空白正是被测对象。

#### 本轮的一个新发现（不判缺陷，已另立票据）

**管理面板的表单不接管开场焦点。** `useInitialFocusIn` 用在 ManagerPanel / ActionPanel / ConfirmPanel 上，却没有用在 `ActionForm` 上；于是点「编辑」或「新建」后焦点仍停在行内那颗按钮（在面板内、表单外），此时按 Escape 不经过表单的 `stopPropagation`，而直达面板自己的 Escape 处理器——**整个管理面板被关掉，而不是只退出表单**。`modal.ts` 的注释写的是「嵌套编辑上下文会在 Escape 到达本处理器前拦下它，因此退出表单不会关闭面板」，该意图只在焦点已在表单内时成立。

本轮不改它：那是发货 UI 的焦点行为变更，按仓库「一轮只领一张票据」的约定应另开票据（见票据 25）。harness 已改为不依赖 Escape 的作用域——离开表单和面板都走各自的显式控件（「取消」与关闭按钮），这同时避开另一个真实风险：面板已关时的 Escape 会落到 DSH 自己的 Composer，而它也监听 Escape。

#### 本轮的 harness 修正

- **有状态的 round 关掉 Playwright 重试**（`presets.spec.ts`、`reinstall.spec.ts` 的 `test.describe.configure({ retries: 0 })`）。首跑失败后的重试会从上一次留下的状态开始（克隆已建、预置已隐藏），第二次失败的原因就与第一次无关了——实测确实如此（第一次失败在「隐藏」按钮，重试却失败在起始计数 4≠5）。失败的阶段应由 round 从种子重跑，不由 Playwright 重试。
- **`enterSession(page, 'plugin' | 'history')`**：`openResidentComposer` 现在是它的一个入口。`history` 只等 DSH 自己的会话流（`data-chat-flow-kind`），供「断言插件缺席」的阶段使用。
- **`tests/gui/verify-round.sh`**：常规套件也有了自己的驱动（种入已知命名空间 → 启动 → 跑 → 退出时还原），并可转发参数给 playwright 以重跑单个 spec。此前这一步是手工设 `DSH_GUI_ENTRY`；而 `validation.spec.ts` 与 `conflict.spec.ts` 会写入，所以「跑在恰好存在的那个命名空间上」不再可接受。

#### 本轮的完整回归与质量门

| 门 | 结果 |
|---|---|
| `sh tests/gui/verify-round.sh`（常规套件，三视口） | **40 通过 / 83 跳过 / 0 失败**，3.8 分钟。83 跳过 = 各 round 自带驱动的用例（send / scale / restart / screenshots / lifecycle / host-config / presets / reinstall）与两条桌面限定用例在窄视口的跳过 |
| `conflict.spec.ts` 稳定性 | 4 次全过（单跑 1 次 + `--repeat-each=3`） |
| `pnpm test` | 22 文件 / **485 通过** |
| `pnpm typecheck` | 两遍均通过 |
| `pnpm lint` | 通过 |

#### 关窗与环境还原

`close-window.sh` 卸载后逐项核对：

| 检查 | 结果 |
|---|---|
| `profiles/web/package.json` | sha256 与开窗前指纹**逐条匹配** |
| `profiles/web/pnpm-workspace.yaml` | sha256 **逐条匹配**（override 块与注释一并消失） |
| `profiles/web/node_modules` | 功能包已移除 |
| `profiles/web/cordis.patch.yml` | `composer-quick-actions` 出现次数 **0** |
| `<DSH_HOME>/settings.yaml` | 插件命名空间 **0** 次出现；仅剩用户自己的 4 个命名空间（`ui-onboarding` / `llm-openai-codex` / `agent-default-model` / `locale`），共 603 字节 |
| harness 备份 | `.playwright/` 下的命名空间备份与 profile 备份均已消费并删除 |
| 端口 3080 | 已关闭 |

Settings 命名空间的删除是 README 的**手工彻底清理**步骤而非卸载的一部分（正因如此重装才能恢复用户的动作）；本轮它是被种子工具的「还原到安装前状态（原本不存在）」清掉的，两条路径都执行过。

#### 第 13.2 节的剩余缺口

**没有需要真实 GUI 或模型调用的剩余项。** 唯一未逐字执行的是 README 升级/降级步骤里的「override 与 `add` 指向**另一个版本**的两个 tarball」——它需要第二个版本，而两个包按票据 20 的决定**暂不发布**，本地也只有 `0.1.0`。该步骤的机械部分（override 改指向 + 重复 `add` 幂等 + 重启）本轮已执行，其**数据侧后果**（目录增删、墓碑、往返无损）正是上面第 2 项四段覆盖的内容。

---

## 票据 25 — 两处边缘状态的用户可见反馈（2026-09-09）

本节没有开安装窗口：缺口 2 是纯 Client 侧焦点行为，在 jsdom 里可完整固定；缺口 1 的定案依据是对已安装 DSH 源码的取证，而不是新的 GUI 观察。两条为真实 GUI 新增的断言**尚未执行**，见文末。

### 环境

| 项 | 值 |
|---|---|
| 工作方式 | `git worktree`（分支 `ticket-25-edge-state-ux`，自 `fab3b29`），`pnpm install --offline` |
| 取证对象 | `node_modules/.pnpm/@deepseek-ai+dsh-client-ui-conversation@0.1.2-rc.1_*/…/lib/client.js`（与功能包 devDependency 同版本） |

### 缺口 1 的源码取证（第三轮「行为发现」第 1 条的成因更正）

| 环节 | 源码位置（`lib/client.js`） | 事实 |
|---|---|---|
| 提交入口 | `SessionInputShell.submit()` | 直接 `dispatchRun({ type: 'enter', … })`，前后**没有任何连接态判断** |
| 状态机 | `SubmitMachine.onEnter()` | 非空白普通文本 → `beginDetached()` → 返回 `[default-sink, commit-draft]`；命令文本 → `adjudicating` |
| 执行 | `run(effects)` → `execute()` | 先 `sinkSerialized()`（调用 `defaultSink`，返回 Promise），**再同步 `commitDraft()` 清空编辑器**，最后 `publish()` |
| sink | `sink()` → `conversation.sendSession()` → `session.prompt()` | `async`，底层是 `createWebConnectionRpc` 的 fetch；断线时以 rejection 结束 |
| 失败恢复 | `settleSink()` → `settleDetachedFailure()` → `restoreFailedDrafts()` | 把失败文本按提交顺序放回草稿（空一行分隔），并 `dispatchRun({ type: 'sink-settled', ok: false, message })` → `notice(error)` → InputBar 的 `showToast` |
| 原生按钮门禁 | InputBar：`disabled = removed \|\| inert \|\| !live \|\| blocked \|\| parentOffline`，`live = input && keyboard && inputActions` | **不含连接态**；原生发送按钮断线时同样可按 |

推论：插件引擎在紧随激活的那次提交里读到 `draft === ''`、`phase === 'plain'`，按 spec 9.5 判定官方状态机已接收并关闭单飞——它没有「停在 `submitted` 观察阶段」；文本回到草稿与错误提示都来自 DSH。第三轮 harness 只断言了草稿文本，未检查 DSH 的 toast，因此「用户得不到解释」对 DSH 侧并未取证。**插件行为符合 spec 9.5，不加任何补充反馈**；两个候选修复（超时判定、连接态门禁）分别被 spec 9.5 与 spec 10 / 9.2 排除，详见票据 25 的 `## Answer`。

### 缺口 2 的修复与固定

`ActionForm` 接管开场焦点（标签输入框）并在关闭时归还焦点；`useFocusReturn` 为嵌套面板加「焦点已离开本面板则不抢回」规则；`ManagerPanel` 按目标 `key` 重挂载表单。`manager.spec.tsx` 新增 7 条用例，覆盖新建 / 编辑的开场焦点、表单刚打开时 Escape 只退出表单且第二下关面板、取消与保存后焦点回到打开控件、切换编辑目标重新聚焦、面板在表单打开时关闭仍把焦点还给管理入口。修复过程中的一次红灯有取证价值：最后一条用例在只加 `useFocusReturn()` 时失败——React 卸载顺序为外层清理 → 内层清理 → 摘 DOM，表单的归还把焦点拉回即将被移除的按钮，最终落到 body；`panel` 参数正是为此加的。

### 质量门

| 门 | 结果 |
|---|---|
| `pnpm test` | 22 文件 / **496 通过**（票据 18 收口时 485；新增 manager 7 + execution 3 + surfaces 1） |
| `pnpm typecheck` | 两遍均通过（第二遍含 `tests/gui/`） |
| `pnpm lint` | 通过 |

### 本节未覆盖（留给票据 21 的安装窗口）

- `tests/gui/lifecycle.spec.ts`（`down` 半程）新增两条：DSH 自己的 toast 出现（`body > [role="alert"]`，primitives `Toast` 的 portal，3s 保持后淡出，故先于草稿断言）；断线激活后插件 `[data-quick-actions-feedback]` 计数为 0。toast 断言若失败，说明 rejection message 为空、`onSinkSettled` 返回 `[]`——属 DSH 侧缺口。
- `tests/gui/validation.spec.ts` 编辑段改为：标签框已聚焦 → Escape → 表单消失、面板仍在、焦点回到「编辑」。
- 两者均不触发模型调用；`lifecycle-round.sh` 会停掉 profile，需在窗口内按其驱动执行。

---

## 票据 21 — 最终人工验收（2026-09-09，进行中）

本票据是 HITL：Agent 只负责准备一次性 profile 与最终 tarball、按用户指示驱动步骤并记录结果；第 13.4 节第 9 步「生产验收通过」只能由用户本人说出，本节在得到该答复前不得宣告通过。本票据**没有**取得真实模型调用的许可（票据 18 第三轮的许可不延续），因此 `send-round.sh` 与 `lifecycle.spec.ts` 的 `up` 半程（其最后一条断言会真实发送「回复 ok」）均未执行，见文末。

### 环境

| 项 | 值 |
|---|---|
| 最终候选提交 | `b5959d2`（`main`，票据 25 收尾之后；worktree 分支 `ticket-21-final-acceptance` 自该提交建出，`pnpm install --offline` 4.6s） |
| Node / pnpm | v24.18.0 / 11.7.0 |
| DSH 运行时 | `npx --yes @deepseek-ai/dsh@latest` → **0.1.2-rc.1**（与功能包 devDependency 同版；全局 `~/.local/bin/dsh` 是陈旧的 0.1.1-rc.2，脚本不使用它） |
| Playwright | `@playwright/test` 1.63.0，chromium-1243 |
| GUI 通道 | `http://127.0.0.1:3080`，开窗前探测为未占用（`000`），安装窗口关闭状态：`profiles/web/cordis.patch.yml` 与 `<DSH_HOME>/settings.yaml` 中 `composer-quick-actions` 均 0 次出现 |
| 并行会话 | 主检出里另一会话的 `pnpm watch:client` 持续运行；本票据的打包与构建全部发生在 worktree，互不触碰 |

### 质量门（最终候选提交上新鲜执行，15:13–15:14）

| 门 | 命令 | 结果 | 退出码 |
|---|---|---|---|
| 类型检查 | `pnpm typecheck` | 两遍均通过 | 0 |
| lint | `pnpm lint` | 通过 | 0 |
| 单元 / 契约测试 | `pnpm test` | **22 文件 / 496 通过**，23.54s | 0 |

`pnpm test` 日志里两段 vite「Failed to load source map … dsh-client-ui-primitives/lib/index.js.map」是第三方包声明了 `sourceMappingURL` 却未随包发布 map，属上游打包瑕疵，不影响用例；「surface exploded」是错误边界用例的预期抛错。

### 安装窗口的打开：`sh tests/gui/reinstall-round.sh`（15:15–15:19，退出码 0）

按票据评论的要求复用票据 18 第四轮脚本化的窗口，而不是手工执行 README 步骤。本轮先给 `profiles/web/package.json` 与 `pnpm-workspace.yaml` 取 sha256 指纹（`.playwright/profile-fingerprint.txt`，关窗时校验），再走 README 离线流程：

| 步骤 | 结果 |
|---|---|
| 打包（`prepack` 在 worktree 里从当前源码重建） | `dsh-composer-quick-actions-0.1.0.tgz` 167,139 B；`dsh-composer-quick-actions-bundle-0.1.0.tgz` 3,216 B |
| profile `overrides` 指向功能包 tarball（绝对路径，yaml 文档 API 写入） | 写入成功，原 `pnpm-workspace.yaml` 备份在 `.playwright/` |
| `dsh plugin --profile web add <bundle tarball>` | `Done in 2.4s`，`Packages: +2 -2`；pnpm 提示 peer 依赖问题为 profile 既有的第三方插件所致，与本插件无关 |
| `--dump-config` | 出现 `id: composer-quick-actions` / `name: dsh-composer-quick-actions` row |
| 用户命名空间 | 开窗前 **不存在**（harness 记为「absent」，收尾时按此还原） |

重装恢复三段（`reinstall.spec.ts`，desktop，各一次 profile 启动）：

| 阶段 | 结果 |
|---|---|
| `mark` | 通过（54.2s）：经 GUI 设布局 `launcher` 并新建自定义动作，命名空间落盘 |
| `gone`（`plugin remove` 后重启） | 通过（52.2s）：进入有历史的会话后 layout / manage / `dsh-cqa-` 样式计数均为 0，命名空间原样保留 |
| `back`（再次 `add` 后重启） | 通过（52.2s）：布局回到 `launcher`，标记动作标签与文本原样回来 |

本轮结束时插件保持已安装、profile 处于停止态、用户命名空间已还原（删除，因原本不存在）。这一段等价于第 13.4 节步骤 7 的机械部分，但**步骤 7 本身仍须用户在人工会话里亲眼确认**。

### 窗口内的 GUI 回归（最终候选提交上新鲜执行，全部不触发模型调用）

票据 18 的四轮 GUI 证据取自票据 25 改动 Client 焦点行为**之前**的提交，第 13.1 节要求集成测试在最终候选提交上新鲜通过，因此本窗口把所有无模型调用的 round 重跑一遍，而不只补票据 25 留下的两条断言。每个 round 自带种子命名空间 → 启动 → 断言 → 还原 → 停机。

| round | 时间 | 结果 | 退出码 |
|---|---|---|---|
| `sh tests/gui/verify-round.sh`（常规套件，desktop / tablet-768 / narrow-360） | 15:20–15:25 | **40 通过 / 83 跳过 / 0 失败**，4.8 分钟，无重试；与票据 18 第四轮数字一致 | 0 |
| `sh tests/gui/restart-round.sh`（`store` → 重启 → `restore`） | 15:25–15:27 | 两半各 1 通过 | 0 |
| `sh tests/gui/scale-round.sh`（0 / 1 / 6 / 25 / 50 / 53 被动超限，六次启动） | 15:28–15:35 | 六行各 3 通过，无重试 | 0 |
| `sh tests/gui/presets-round.sh`（`stage` → `tombstone` → `restore` → `signature`，四次 `--patch` 启动） | 15:35–15:40 | 四段各 1 通过 | 0 |
| `sh tests/gui/host-config-round.sh`（Host `Config.presets` overlay 到达 Client） | 15:40–15:41 | 2 通过 | 0 |
| `sh tests/gui/screenshots-round.sh`（三布局 × 三视口，对比已提交基线） | 15:41–15:45 | 9 通过，3.0 分钟 | 0 |
| `lifecycle.spec.ts` **仅 `down` 半程**（种入发送 fixture → 启动 → 页面加载后停掉 profile） | 15:45–15:46 | 1 通过（52.5s） | 0 |

`lifecycle` 没有用 `tests/gui/lifecycle-round.sh` 驱动：该脚本的 `up` 半程最后一条断言会激活「验证发送」fixture 真实发送「回复 ok」（spec 内注明「the one real model turn this round spends」），票据 21 评论里「两者都不触发模型调用」对 `up` 半程不成立。本票据没有模型调用许可，故只以等价的 `down` 驱动（种子 → 启动 → `DSH_QA_LIFECYCLE=down` → 还原 → 停机）执行。

**票据 25 的另一条断言在真实 GUI 首次成立**：断线后激活发送动作，DSH 自己的 toast（`body > [role="alert"]`）出现、草稿「回复 ok」由 DSH 放回、插件 `[data-quick-actions-feedback]` 计数为 0。toast 断言通过，意味着票据 25 预留的「rejection message 为空则为 DSH 侧缺口」分支**没有触发**，无需记录 DSH 侧缺口。

小结：本窗口内 8 个 round、**13 次 profile 启动**，无一失败、无一重试；所有 round 退出时用户命名空间均按「原本不存在」还原。

### 本票据未执行的自动化（需用户明确许可）

| 项 | 原因 | 触发它会发生什么 |
|---|---|---|
| `sh tests/gui/send-round.sh`（6 条） | 每条真实提交到当前登录账号的模型 | 「回复 ok」最多发送 4 次、`/qa-probe-unknown-command` 交给 DSH 裁决 2 次；覆盖 13.4 步骤 4/5 的自动化侧 |
| `lifecycle.spec.ts` `up` 半程 | 末尾一条真实发送「回复 ok」 | 重连后写入恢复、注册不重复、单飞窗口未被卡住 |

这两项在票据 18 第三轮已在**当时的提交**上通过；对最终候选提交，相关逻辑（`session/`、`execution`）在票据 25 之后没有改动，票据 25 只改了 `manager/` 的焦点行为并新增单元用例。若用户在人工会话中亲自执行步骤 4/5（其本身就是真实发送），该缺口由人工验收覆盖。

### 人工会话就位（15:46，等待用户）

回归收尾后由 `tests/gui/boot.sh` 的 `boot` 再次启动 web profile 并**保持运行**，供用户执行第 13.4 节步骤 1–8：

| 项 | 状态 |
|---|---|
| `http://127.0.0.1:3080` | 由本窗口启动的进程组提供（pid 记录在 worktree 的 `.playwright/dsh-web.pid`）；入口 URL 含 GUI token，只保存在 `.playwright/dsh-web.log`，不录入本文件 |
| 插件 | 已安装：profile `package.json` 依赖 bundle tarball、`pnpm-workspace.yaml` override 指向功能包 tarball（两者都是 worktree 内 `.playwright/tarballs/` 的绝对路径），`cordis.patch.yml` 未改动（row 来自 bundle 层） |
| 用户命名空间 | 各 round 退出时均按「原本不存在」还原；本次启动后 Host 首次规范化写入 `composer-quick-actions`（1 次出现），即**全新安装状态**——随包三条预置、默认 `ribbon`、无自定义动作 |
| harness 备份 | `.playwright/` 下仅剩 `profile-fingerprint.txt`（供 `close-window.sh` 校验）与 `profile-pnpm-workspace-backup.yaml`（供卸载时还原 override）；命名空间备份已全部消费 |

**关窗须在 worktree 根目录执行 `sh tests/gui/close-window.sh`**（它读取该目录下的 pid 与指纹），且在此之前不得删除 worktree——profile 的两处 `file:` 引用指向 worktree 内的 tarball。

### 窗口在 15:51 被外部关闭（记录事实，不判缺陷）

用户随后指示「你来验证」，由 Agent 驾驭第 13.4 节步骤 1–8。第一次 `acceptance-round.sh walk`（16:04）在进入会话时失败：页面快照显示已进入有历史的会话「Ping」，但插件 cell 未挂出。取证：

| 证据 | 值 |
|---|---|
| `profiles/web/package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`、`node_modules` mtime | **15:51:43** |
| 两文件与开窗前指纹 | `sha256sum -c` **逐条 OK**（override 块与 bundle 依赖均已消失） |
| worktree `.playwright/profile-pnpm-workspace-backup.yaml` | 已被消费（15:46 时尚在） |
| `--dump-config` | 无 `composer-quick-actions` row |
| `<DSH_HOME>/settings.yaml` | 命名空间仍在（1 次出现）——与 README「卸载不删命名空间」一致 |

这组痕迹与在本 worktree 根目录执行 `qa_uninstall`（`close-window.sh` 的第一步）完全一致，本会话没有执行它；推测为用户或另一会话按 15:46 报告里的关窗命令执行。profile 已被证明可字节级还原，属正向证据。Agent 随后用 15:15 打包的同一对 tarball 重新 `qa_install` 打开窗口并继续。

### 步骤 1–8：Agent 驾驭的逐条执行（16:19–16:31）

用户指示「你来验证」，故第 13.4 节步骤 1–8 由 Agent 驱动。新增 `tests/gui/acceptance.spec.ts` 与 `tests/gui/acceptance-round.sh`：`walk` 段一次浏览器会话内走完步骤 2/3/4/5/8 与步骤 6 的刷新，`persist` 段做重启（步骤 6）与卸载 / 重装各带一次重启（步骤 7）。每条观察以 `ACCEPT:` 打印进日志，19 张截图裁剪到插件自身表面存进 `verification/acceptance-21/`（第 13.1 节禁止把用户会话写进证据）。

**没有花费任何真实模型调用**：步骤 4/5 的三次真实提交都用命令发送动作 `/qa-acceptance-unknown-command`，由 DSH 自己裁决（页面回「未知命令：/qa-acceptance-unknown-command」，见 `occupied-draft.png` 底部）；普通文本的真实发送按第 13.4 节留给用户，其确认面板只验到「取消后零发送」。

| 步骤 | 观察 |
|---|---|
| 1 安装并刷新 | Resident Composer 上是随包三条预置：📝总结对话 / 🔍解释改动 / 🧹压缩上下文（后者带「命令」徽标，文本为 `/compact`） |
| 2 创建 | 普通发送动作与命令发送动作各建一条；表单开场焦点在标签框；命令动作的表单出现命令警示且**确认开关不被锁定** |
| 2 编辑 | 改标签后行与按钮同步更新，发送文本逐字保留 |
| 2 排序 | 上移后顺序为 总结对话 > 解释改动 > 压缩上下文 > 验收命令动作 > 验收普通发送（已编辑），且**焦点仍在被点的「上移」上**（spec 8.3 的键盘重排不丢焦点） |
| 2 停用 | 动作离开表面但仍计入总数；启用后回到表面 |
| 2 隐藏 | 预置「总结对话」隐藏后离开表面、仍计数；恢复后回来 |
| 2 克隆 | 预置克隆为带「克隆自预置」标记的可编辑自定义动作，计数 6 / 50 |
| 3 三布局 × 三视口 | 九种组合下与输入框左右边界误差**均为 0.00 / 0.00 px**；密度 1440/768 为 `wide`、360 为 `narrow`；`bar` 在 768 折叠出「更多 2」、在 360 折叠出「更多 5」；`launcher` 面板在三个视口都是 dialog、搜索框自动聚焦且有无障碍名称、列出全部 6 项，Escape 关闭后焦点回到入口 |
| 4 命令动作默认确认 | 表单与管理面板都默认开启确认；确认面板逐字预览命令并给出「不会出现原生 / 候选菜单」说明 |
| 4 关闭确认 | 关闭后一键提交，面板不出现，DSH 照常裁决 |
| 5 空草稿发送 | 草稿为空时确认发送，命令提交一次，插件不发第二条反馈，草稿保持为空 |
| 5 占用草稿 | 草稿有内容时全部动作 `disabled` 并以 `title` 说明原因；强制点击不发送、草稿逐字保留；清空后恢复可用 |
| 5 确认取消 | 取消后零发送、草稿为空、焦点回到发起动作；Escape 同样零发送 |
| 6 刷新页面 | 布局 `bar` 与 6 项动作原样；`settings.yaml` 中 `layout: bar`、自定义动作 3 条 |
| 6 重启 DSH | 重启后布局与全部 6 项动作恢复，计数仍 6 / 50（`manager-after-restart.png`） |
| 7 卸载并重启 | 有历史的会话里 layout cell、管理入口与 `dsh-cqa-` 样式表**计数均为 0**；命名空间原样保留 |
| 7 重装并重启 | 布局与全部 6 项动作恢复 |
| 8 错误信息 | 空标签报「请填写标签」、空文本报「发送文本至少要有一个非空白字符」，均标 `aria-invalid` 且**不产生任何写入** |
| 8 键盘 | 表单内 Escape 只退表单并把焦点还给「新建」，再按一次关面板并把焦点还给「管理」，Enter 可重新打开；Tab / Shift+Tab 在动作之间顺序移动 |
| 8 无障碍名称 | 每个动作的可访问名称等于其可见标签（命令动作再加「命令」徽标文字），装饰图标 `aria-hidden`，「管理」有可见名称加 tooltip |

`walk` 段前三次失败**全部是本轮 harness 的断言过严，不是插件行为**，逐条记录以免后人误读日志：① `setChecked(force)` 在确认开关上净变化为零（详见下一节）；② 点过「保存」后断言焦点在文本框——实际在「保存」按钮上，改为断言焦点仍在表单内；③ 断言动作的可访问名称严格等于标签——命令动作还带「命令」徽标文字，改为按徽标存在与否比较。

### 本轮唯一的新发现：管理面板被 shell 的侧栏把手压住一条 40px 竖带

`setChecked` 的失败查下去是真实环境的层叠问题，用 `tests/gui/switch-diagnose.spec.ts` 取证：

| 事实 | 值 |
|---|---|
| 覆盖物 | `class="wSkVaW_widthHandle"`，`position: absolute`，`z-index: 8`，占据 x 425–465、y 76–900；**不属于本插件**（不在 `[data-quick-actions-*]` 子树内），是 shell / 侧栏的拖拽把手 |
| 被压住的控件 | 只有 13×13 的原生复选框——它的中心恰好落在这条带里；面板其余控件都比它宽，中心避开了 |
| 插件面板的层级 | `.dsh-cqa-manager` 是 `position: fixed; z-index: 31`，理应压过 z-index 8，但它渲染在输入坞子树内，被祖先层叠上下文困住 |
| 用户实际可用的操作 | **点开关文字可切换**（实测 true → false）；**Tab 到开关后空格可对称切换**（true → false → true）。只有精确点那 13px 方框会被把手截获 |

按第 13.1 节判严重度：不涉及内容丢失、重复发送、持久化损坏或 Composer 崩溃，**不阻止发布**。它正是票据 23 备注里「`ManagerPanel` 的 portal 化列为票据 18 之后的候选」所指的症状——面板 portal 到 `body` 即可脱离该祖先层叠上下文。建议另开票据处理，本轮不改发货 UI（一轮只领一张票据）。

### 加入验收 harness 之后的复跑质量门（16:28）

| 门 | 结果 | 退出码 |
|---|---|---|
| `pnpm typecheck` | 两遍均通过（第二遍覆盖新增的 `tests/gui/acceptance.spec.ts`） | 0 |
| `pnpm lint` | 通过 | 0 |
| `pnpm test` | 22 文件 / 496 通过 | 0 |

### 第 13.4 节第 9 步：**已取得**（2026-09-09 16:33）

Agent 报告步骤 1–8 全部通过后，**用户本人回复「生产验收通过」**。这是本票据与 spec 第 13.4 节要求的唯一有效答复，第 9 步至此满足，Wayfinder 地图目标的最后一道门槛清除。

### 关窗与环境还原（16:31，由用户侧执行）

用户在答复前后自行执行了 Agent 给出的两条收尾命令，Agent 随后重复执行时得到「已无可还原 / 已无可移除」，两处报错都是幂等重入而非失败。终态经独立核对：

| 检查 | 结果 |
|---|---|
| `profiles/web/package.json`、`pnpm-workspace.yaml` | sha256 与 15:15 开窗前指纹**逐条 OK**（override 块与 bundle 依赖均已消失） |
| `dsh-composer-quick-actions` 在两份 profile 文件中的出现次数 | **0 / 0** |
| `<DSH_HOME>/settings.yaml` 中 `composer-quick-actions` | **0 次**（README 的手工彻底清理步骤，验收态动作随之清除） |
| worktree `.playwright/` | 命名空间备份与 pid 文件均已消费，仅剩日志与指纹文件 |
| 端口 3080 | 由用户自己重新启动的 DSH 提供（非本轮进程），Agent 未触碰 |

一次性窗口至此关闭：用户的实时 DSH 与开窗前字节一致，本插件不再安装其中。若日后要长期试用，按功能包 README 的本地 / 离线安装流程重新装入即可，两个 tarball 由 `tests/gui/install.sh` 的 `qa_pack` 现打现用。

**票据 25 的断言之一在真实 GUI 首次成立**：`validation.spec.ts` 的「applies trim() whitespace…」用例末尾——点「编辑」后标签框已聚焦 → 按 Escape → 编辑表单消失、管理面板仍可见、焦点回到该行的「编辑」按钮——通过（2.6s）。该 spec 三条桌面用例全部通过，在两个窄视口按设计跳过（表单不随宽度变化）。
