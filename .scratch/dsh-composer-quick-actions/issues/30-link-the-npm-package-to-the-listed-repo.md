# 让 npm 包与市场条目的仓库关联起来

Type: bug
Mode: HITL
Status: claimed
Blocked by: none

## Question（问题）

上架 PR（[awesome-dsh-plugin#4762](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/4762)）已于 2026-09-11 合入，但从插件市场点安装必定失败。用户 2026-09-13 报告：

```text
构建脚本被 pnpm 默认拦截（dsh-quick-actions），点击「放行构建脚本并重试」即可放行并重装
/ build scripts are blocked by pnpm by default (dsh-quick-actions); use
"Allow build scripts and retry" to approve and reinstall
```

点那个按钮，市场回 `no installed packages given`。

### 三段失败链

三段都不在本仓库的运行时代码里。

**① 市场退回 GitHub 源。** 线上目录 `https://awesome-dsh-plugin.com/plugins.json` 里本条目实测为：

```json
{
  "name": "dsh-quick-actions#composer-quick-actions",
  "npm": null,
  "version": null,
  "install": "dsh plugin --profile web add github:lovvvve/dsh-quick-actions#path:/packages/composer-quick-actions"
}
```

`dshmarket` 的 `sources.ts:installTargetFor` 优先级是 `npm` > `tarball` > `github:`。`npm` 为 null，于是安装目标是 GitHub 子目录。

**② GitHub 源必然撞上构建授权。** git-hosted 依赖 pnpm 必须先 prepare（跑构建脚本），pnpm 11 默认拦截。用户 profile 的三次尝试（本地 11:52:13 / 11:52:46 / 11:53:11）在 `.dsh-market/log.ndjson` 里都是同一个错：

```text
ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED: Failed to prepare git-hosted package fetched
from "https://codeload.github.com/lovvvve/dsh-quick-actions/tar.gz/a92de23…":
The git-hosted package "dsh-quick-actions@0.1.0-rc.2" needs to execute build
scripts but is not in the "allowBuilds" allowlist.
```

**③「放行构建脚本并重试」对本条目结构上点不通。** `routes.ts` 的 `/dsh-market/approve-builds` 对一个尚未落地到 `node_modules` 的包，只能回到目录里反查条目才能生成 allowBuilds key：

```ts
entry = (await loadRegistry()).plugins.find(p => p.name === name || p.npm === name)
```

传进来的 `name` 由错误文本解析得到 `dsh-quick-actions`，而本条目的 `name` 是 `dsh-quick-actions#composer-quick-actions`（monorepo 子包条目按策展仓库要求带 `#<子目录名>` 后缀）、`npm` 又是 null，两个分支都不命中 → 授权列表为空 → `400 no installed packages given`。

### 根因：发布的 manifest 没有 `repository`

策展仓库的 `contributing.md` 写明 npm 映射**不接受手写** ——「在 yml 里手写 `npm:` 会被校验拒绝」，映射由 `scripts/probe-npm.mjs` 自动采集。该脚本的判据是：

```js
const pkg = await fetchJson(`https://raw.githubusercontent.com/${repo}/HEAD/${sub}/package.json`)
const meta = await fetchJson(`https://registry.npmjs.org/${pkg.name}`)
const repository = meta.versions?.[latest]?.repository ?? meta.repository
const repoField = typeof repository === 'string' ? repository : repository?.url ?? ''
const linked = repoField.toLowerCase().includes(repo.toLowerCase())
if (!linked) return { npm: null, version: null, checkedAt: today }
```

即：**拿已发布包 `dist-tags.latest` 那份 manifest 的 `repository` 字段反向核对仓库归属**，对不上就判定「没发 npm」。这是刻意的防冒认设计（contributing.md 原文：防止某个包把自己挂到一个并未认领它的仓库上）。

而 `npm view dsh-quick-actions@0.1.0-rc.3 repository` 返回空——**我们发布的包从来没有 `repository` 字段**。票据 17 定 `files`/`exports`/`dsh.*` 时没有涉及它，此前也没有任何东西需要它，所以一直没人发现。

### 一并澄清：GitHub 源对本仓库永远装不成

即使放行了构建也不行，本仓库不具备从源码安装的条件：

| 障碍 | 说明 |
|---|---|
| `lib/` 是构建产物 | `.gitignore` 排除，GitHub tarball 里没有可加载的 `lib/client.js` |
| devDep 有 `workspace:*` | `@dsh-plugins/dsh-client-bundle` 只在本 workspace 内可解析，子目录单独 install 必失败 |
| 没有 `prepare` 脚本 | 构建挂在 `prepack` 上，pnpm 对 git 依赖跑的是 `prepare` |

所以「放行构建脚本」这条路不值得修——正解只有把 npm 映射打通一条。策展仓库的 `tarball:` 字段（给「根本无法从源码安装」的仓库用）在映射生效后也不需要，因为 `npm` 的优先级本就在它之上。

## 变更

`packages/composer-quick-actions/package.json` 补三个字段：

```json
"repository": {
  "type": "git",
  "url": "git+https://github.com/lovvvve/dsh-quick-actions.git",
  "directory": "packages/composer-quick-actions"
},
"homepage": "https://github.com/lovvvve/dsh-quick-actions/tree/main/packages/composer-quick-actions#readme",
"bugs": "https://github.com/lovvvve/dsh-quick-actions/issues"
```

`directory` 是 monorepo 子包的 npm 约定；`probe-npm.mjs` 只做 `url` 的子串匹配，不读它，但条目本身就是子包条目，写对是应有之义。

打包契约加一条断言（`tests/release/packaging.spec.ts` 的 `release identity`）：源 manifest 与 **packed** manifest 都必须带 `repository`，`url` 含 `lovvvve/dsh-quick-actions`，`directory` 等于包目录相对仓库根的路径。断言先验红（移除字段后 `the feature manifest declares no repository object`）再转绿，29 条全过。把它钉成发布契约而不是元数据，是因为它的失效方式正是本票据——发布之后才在第三方通道上暴露，本仓库的任何测试都不会响。

## 剩余步骤（HITL）

1. **用户发布带该字段的版本。** `0.1.0` 已由票据 29 的 `🔖 release: 0.1.0` 提交备好且尚未发布，本次改动叠在其上，因此不需要额外的版本号。发布需要 OTP，Agent 无法代跑：

   ```sh
   pnpm --filter dsh-quick-actions publish --no-git-checks
   ```

   注意票据 27 记下的坑：对刚被撤回过的包名，首次重发可能报 `[E409] Failed to save packument` 但**其实已经发出去了**；遇到先查 `curl -s https://registry.npmjs.org/dsh-quick-actions` 的 `versions`，不要盲目重发。

2. **等策展仓库的 nightly probe 跑一遍。** `probe-npm.mjs` 的 `RECHECK_DAYS = 1`，「未发布」判定一天过期，无需再提 PR；也可用 `PROBE_ALL=1` 由维护者强制。跑过之后目录里本条目的 `npm` 变成 `dsh-quick-actions`、`install` 串变成 npm 形式。

3. **复验**：重新拉 `https://awesome-dsh-plugin.com/plugins.json` 确认 `npm` 非空，再从市场 UI 点一次安装。

在此之前，从命令行装不受影响（票据 27 已在全新 `DSH_HOME` 上实测）：

```sh
dsh plugin --profile web add dsh-quick-actions
```
