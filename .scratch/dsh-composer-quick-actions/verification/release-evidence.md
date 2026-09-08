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
