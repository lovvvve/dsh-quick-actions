# 把 0.2.0-rc.1 发到 npm 的 next dist-tag

Type: task
Mode: HITL
Status: resolved
Blocked by: none

## Question（问题）

用户要求把票据 31–35 的成果「发布到 next dist-tag」。spec 第 22.6 节：DSH 的 npm `latest` 仍停在 `0.1.5` 线，本插件新版只支持 `0.1.7` 模型，若发到 `latest`，`dsh plugin add` 会把它装到 `0.1.5` 线上失效，所以发到 `next`。README 的安装命令已由票据 35 改为 `dsh-quick-actions@next`；npm 上目前只有 `latest: 0.1.0`，没有 `next`。

### 版本号

`0.2.0-rc.1`：

- 放弃 `0.1.5` / `0.1.6` 线是破坏性变更，0.x 下升 minor。
- 票据 34 的重启类与 overlay 类 GUI round 尚未重跑，按 `0.1.0` 先发 `rc` 再转正的先例，先发预发布版本；转正（`0.2.0`）与挪到 `latest` 等 DSH 把 `0.1.7` 推上 `latest`、票据 34 闭合后另议。
- `tests/release/packaging.spec.ts` 把版本钉在 `0.1.0` 线，须随之改到 `0.2.0` 线；两份 README 的本地 tarball 名由 `docs.spec.ts` 强制与当前版本一致。

### 发布

需要 OTP，Agent 不可代跑、也不经对话传递一次性密码（票据 27）。Agent 负责改版本、跑全部可自动化的验证与 `publish --dry-run`；用户执行：

```sh
pnpm --filter dsh-quick-actions publish --no-git-checks --tag next
```

发布后核验 registry 的 `dist-tags`（`latest` 仍是 `0.1.0`、`next` 是 `0.2.0-rc.1`）、`repository` 字段与 tarball 逐字节一致，再 resolve。

## Comments

### 2026-09-27：`0.2.0-rc.1` 已备好，只差用户执行发布

**改动**（commit `🔖 release: 0.2.0-rc.1`）：`package.json` 版本 `0.1.0` → `0.2.0-rc.1`；两份 README 的本地 tarball 名同步为 `dsh-quick-actions-0.2.0-rc.1.tgz`；`packaging.spec.ts` 的版本线断言由 `0.1.0(-rc.N)` 改为 `0.2.0(-rc.N)`（先改断言见红，再升版本转绿）。

**验证**（在 `ticket-31` worktree 里跑）：

| 检查 | 结果 |
|---|---|
| `pnpm typecheck` | exit=0（两遍） |
| `pnpm lint` | exit=0 |
| `pnpm test` | exit=0，23 文件 / 492 用例全过 |
| `pnpm peers check` | `No peer dependency issues found` |
| `publish --dry-run --no-git-checks --tag next` | exit=0，`📦 dsh-quick-actions@0.2.0-rc.1 → https://registry.npmjs.org/` |

**打包内容**（`pnpm pack` 到任务临时目录）：48 个文件（与 `0.1.0` 相同），解包 621,540 B（`0.1.0` 为 599,903 B，差额来自票据 31–35 的代码）；非声明文件只有 `lib/{client.js,client.js.map,index.js,types.js}`、`package.json`、两份 README、`cordis.patch.yml`、`LICENSE`，`lib/types/` 下全是 `.d.ts`。packed manifest：MIT、`repository` 含 `directory`、无 `publishConfig`、`dependencies` 无、DSH peer 均为 `>=0.1.7-alpha.2`、`dsh.bundle.patch` 与 `dsh.client` 在。

**剩余一步（HITL，需 OTP）**：

```sh
pnpm --filter dsh-quick-actions publish --no-git-checks --tag next
```

`--tag next` 不能省：省了会落到 `latest`，正是 spec 22.6 要避免的。发布后若报 `[E409] Failed to save packument`，先查 `curl -s https://registry.npmjs.org/dsh-quick-actions` 的 `versions`，落库可能滞后 2.5 分钟，不要重发。

### 2026-09-27：第一次发布被 E404 拒绝

用户首次执行发布，pnpm 报 `[E404] 404 Not Found - PUT https://registry.npmjs.org/dsh-quick-actions`，未出现 OTP 提示。registry 核对无残留（仍只有 `latest: 0.1.0`，版本号未占用）。`~/.npmrc` 里有 2026-09-16 16:41 写入的 `_authToken`，但 `npm whoami` 对它返回 E401——token 已失效。npm 对未认证的 PUT 回 404 而不是 401，所以 404 在这里的意思是「没认出你是谁」，不是包不存在。用户 `npm login` 重新登录后发布成功。**下次发布前先跑 `npm whoami`**。

## Answer（结论）

**`dsh-quick-actions@0.2.0-rc.1` 已发在 `next` dist-tag，`latest` 仍是 `0.1.0`；registry 上的包与本地验证过的打包逐字节一致。**

### registry 核验

轮询 `registry.npmjs.org/dsh-quick-actions/0.2.0-rc.1`：本地 01:00:52 起连续 404，01:02:25 转为 200；registry 记的发布时刻 `2026-09-26T17:02:15.180Z`。

| 字段 | 值 |
|---|---|
| `dist-tags` | `latest: 0.1.0`、`next: 0.2.0-rc.1` |
| `versions` | `0.1.0`、`0.1.0-rc.3`、`0.1.0-rc.4`、`0.2.0-rc.1` |
| `repository` | `git+https://github.com/lovvvve/dsh-quick-actions.git` + `directory: packages/composer-quick-actions` |
| `license` / `dependencies` / `publishConfig` | MIT / 无 / 无 |
| `dsh.bundle` | `{"patch":"./cordis.patch.yml"}` |
| `fileCount` / `unpackedSize` | 48 / 621,540 B |
| `shasum` | `6f516b96e5f6f74e63e57f605993b4af68a312f3` |

registry 的 tarball 下载回来，sha1 与 registry 声明值、与本地 `pnpm pack` 产物三者一致。`latest` 没动，市场（按 `dist-tags.latest` 反查 `repository`）继续指向 `0.1.0`。

### 全新 `DSH_HOME` 单命令安装（`npx @deepseek-ai/dsh@next`，即 `0.1.7-rc.1`；用户 `~/.dsh` 前后指纹一致）

| 条件 | 装到 | profile 里的 spec | `--dump-config` |
|---|---|---|---|
| 无标志：`plugin --profile web add dsh-quick-actions@next` | **`0.1.0-rc.4`** | `"0.1.0-rc.4"` | — |
| 加 `--config.minimumReleaseAge=0` | `0.2.0-rc.1` | `"0.2.0-rc.1"` | `- id: composer-quick-actions` / `name: dsh-quick-actions` |

**dist-tag spec 同样受 pnpm `minimumReleaseAge`（24 小时）约束**：目标版本未满 24 小时、又存在更旧的合格版本时，pnpm 静默退回旧版，不报错也不写豁免——这里退到的是 `0.1.0-rc.4`，既不是 `next` 也不是 `latest`。`0.1.0-rc.4` 是 0.1.5 线的插件，在 DSH 0.1.7 上激活失败。窗口到 **2026-09-27T17:02:15Z（本地 2026-09-28 01:02:15）** 结束，之后 README 那条命令直接装到 `0.2.0-rc.1`，无需任何动作。README 已随 tarball 发布、改不了，而且窗口一天后自动关闭，所以不为它改 README；`CLAUDE.md` 记下了这条坑与急用时的 `--config.minimumReleaseAge=0`。

### 已知边界

- 转正为 `0.2.0` 并挪到 `latest`，等 DSH 把 `0.1.7` 推上 `latest`、票据 34 闭合后另议。届时 `packaging.spec.ts` 的版本线已覆盖 `0.2.0`，README 的 `@next` 要一并改回。
- 策展目录只读 `latest`，本版不会进市场，从市场安装仍是 `0.1.0`。

