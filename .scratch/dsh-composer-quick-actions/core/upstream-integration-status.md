# DSH `inputActions.insertText` 上游集成状态

验证窗口：2026-09-05 13:23:49–14:24:29 +0800

## 当前官方基线

- 官方仓库：[`deepseek-ai/deepseek-harness`](https://github.com/deepseek-ai/deepseek-harness)
- 默认分支：`master`
- 基线提交：`d347e703908d0406b7a7ef80e3a0e594d86b2215`
- 同提交发布标签：[`dsh-v0.1.3-alpha.1`](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.3-alpha.1)

官方基线尚未声明 `inputActions.insertText(text: string): void`，但公共 `InputActions` 已提供同步 `setDraft(text)` 与 `submit()`，可在最终重验空草稿后承载发送动作的兼容路径。已把基于 `dsh-v0.1.2-rc.1` 的审查补丁重放到上述 `master`，适配其通用附件 API 命名，并生成当前基线可应用的补丁：[`0001-expose-public-text-insertion-dsh-v0.1.3-alpha.1.patch`](./0001-expose-public-text-insertion-dsh-v0.1.3-alpha.1.patch)。本地重放提交为 `2efa35fa782c536eb7385bb2ec69e79b02d29b51`；该哈希仅标识本地重放产物，不是正式 DSH 发布版本。

## 当前基线验证

在 Node `v26.4.0`、pnpm `11.7.0`、macOS arm64 上完成：

- 公共插入行为测试：1 个文件，6/6 通过。
- 最终 `pnpm run test:gui`：291/291 个文件通过；4021 个测试通过、1 个平台测试跳过。
- `pnpm run build:lib:host && pnpm run typecheck:contracts-ready`：通过。
- `pnpm run build:lib:client`：通过。
- 变更 TypeScript Oxlint：0 warnings、0 errors。
- `pnpm run doc-sync`：33/33 检查通过。
- `pnpm run hygiene`：完整 Client 构建后 16/16 检查通过。
- `@deepseek-ai/dsh-client-ui-conversation` bundle 与 pack：通过；tarball 的 `lib/types/client/contract/input.d.ts` 包含 `insertText(text: string): void`，`lib/client.js` 中该动作直接委托 `this.paste(text)`。
- 刷新后的 format-patch 在全新 `master` 克隆中通过 `git am` 干净重放，所得 Git tree 与本地重放提交完全一致。

### 可审计命令记录

以下命令均在 `/tmp/dsh-wayfinder-19` 的最终重放提交上运行；未特别注明时退出码均为 0：

- `pnpm install --frozen-lockfile` — 15.6s；安装 273 个 workspace project 的锁定依赖。
- `pnpm exec vitest run packages/client/ui-conversation/tests/input-actions.client.spec.ts` — 1.48s；1 个文件、6/6 测试通过。
- `pnpm run test:gui` — 55.92s；291/291 个文件通过，4021 个测试通过、1 个平台测试跳过。
- `pnpm run build:lib:host && pnpm run typecheck:contracts-ready` — 92.96s；Host 构建与完整 Client 类型检查通过。
- `pnpm run build:lib:client` — 3.83s；Client 类型与 bundle 全部构建通过。
- `files=$(git diff --name-only master...HEAD -- '*.ts' '*.tsx'); pnpm exec tsx scripts/run-oxlint.ts $files` — 2.5s；15 个变更文件，0 warnings、0 errors。
- `pnpm run doc-sync` — 69.47s；33 passed、0 failed、0 skipped。
- `pnpm run hygiene` — 12.81s；在完整 Host/Client 构建后 16 passed、0 failed、0 skipped。
- `rm -rf /tmp/dsh-wayfinder-19-pack && mkdir -p /tmp/dsh-wayfinder-19-pack && pnpm --filter @deepseek-ai/dsh-client-ui-conversation run bundle && pnpm --filter @deepseek-ai/dsh-client-ui-conversation pack --pack-destination /tmp/dsh-wayfinder-19-pack` — bundle 与 tarball 生成通过。
- `rm -rf /tmp/dsh-wayfinder-19-pack/unpacked && mkdir -p /tmp/dsh-wayfinder-19-pack/unpacked && tar -xzf /tmp/dsh-wayfinder-19-pack/deepseek-ai-dsh-client-ui-conversation-0.1.3-alpha.1.tgz -C /tmp/dsh-wayfinder-19-pack/unpacked` — 确定性解包发布 tarball，供下一条断言读取。
- `node -e "const fs=require('fs'); const t=fs.readFileSync('/tmp/dsh-wayfinder-19-pack/unpacked/package/lib/types/client/contract/input.d.ts','utf8'); const j=fs.readFileSync('/tmp/dsh-wayfinder-19-pack/unpacked/package/lib/client.js','utf8'); const i=j.indexOf('insertText: (text) => {'); if(!t.includes('insertText(text: string): void;')||i<0||!j.slice(i,i+80).includes('this.paste(text);')) process.exit(1)"` — tarball 类型与委托实现断言通过。
- `git format-patch -1 --stdout > /tmp/0001-expose-public-text-insertion-dsh-v0.1.3-alpha.1.patch` — 生成所保存的补丁；下列 SHA-256 固定其内容。
- `rm -rf /tmp/dsh-wayfinder-19-replay && git clone --no-local --branch master /tmp/dsh-wayfinder-19 /tmp/dsh-wayfinder-19-replay && git -C /tmp/dsh-wayfinder-19-replay am '/Users/lovvvve/src/dsh-plugins/.scratch/dsh-composer-quick-actions/core/0001-expose-public-text-insertion-dsh-v0.1.3-alpha.1.patch' && test "$(git -C /tmp/dsh-wayfinder-19-replay rev-parse 'HEAD^{tree}')" = "$(git -C /tmp/dsh-wayfinder-19 rev-parse '2efa35fa782c536eb7385bb2ec69e79b02d29b51^{tree}')"` — 全新 `master` 克隆重放成功且 tree 相同。

审计标识：

- 基线 commit：`d347e703908d0406b7a7ef80e3a0e594d86b2215`
- 基线 tree：`699dd8bb33bd13fddca68f39e6544bb272c39275`
- 本地重放 commit：`2efa35fa782c536eb7385bb2ec69e79b02d29b51`
- 本地及全新克隆重放 tree：`cacda222331480c38593a6e022434dca44875cf4`
- stable patch-id：`fa800fb44d4dedbc76ebc2e9617a490de2cd7abc`
- 补丁 SHA-256：`0a413e13f0fa2a95c989476e728541b14325a7a84a336d4a5be2ea305b786291`

## 上游协作阻塞

官方[贡献说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/CONTRIBUTING.md)明确表示目前不接受外部 Pull Request，并要求通过 GitHub Discussions 报告问题或建议；仓库 REST 元数据同时返回 `has_pull_requests: false`，Pull Requests API 返回 404。当前 SSH 身份 `lovvvve` 对官方仓库的分支推送 dry-run 被拒绝，且 `lovvvve/deepseek-harness` Fork 不存在。当前运行环境也没有 `gh`、`GH_TOKEN`、`GITHUB_TOKEN` 或已存储的 GitHub HTTPS 凭据。

因此当前尚未创建上游 PR，也没有上游 CI、维护者审查、合并结果或首个正式包含该接口的发布版本；不得把 `2efa35fa…` 或 `dsh-v0.1.3-alpha.1` 写成完整功能最低正式版本。

## 当前地图的范围处置

[将 insertText 补丁集成到 DSH 官方发布](../issues/19-upstream-insert-text-and-record-release.md)已关闭并列入当前地图的范围外；正式上游发布不再阻塞首版插件。首版按运行时能力启用完整插入，或从 Composer 省略但在管理界面保留兼容性抑制插入动作。发送动作在最终空草稿重验后，能力存在时使用公共 `insertText`、缺失时仅为发送使用公共 `setDraft`，随后均调用公共 `submit`；兼容矩阵不声明尚不存在的最低正式版本。[执行集成与发布验证](../issues/18-run-integration-and-release-verification.md)将在现有官方 GUI 验证能力缺失通道，并在应用本补丁的隔离源码检出上以受管独立 URL 验证完整能力通道。

## 未来独立 effort 的协作步骤

1. 在[官方 Discussions](https://github.com/deepseek-ai/deepseek-harness/discussions/new/choose)提交该插件的选区感知纯文本插入用例、最小公共接口说明和上述补丁验证证据。
2. 请官方维护者确认是否愿意由内部贡献者接手，并将补丁 cherry-pick/重放到内部可创建 PR 的分支；或者为当前贡献者提供官方认可的可写分支与审查入口。
3. 获得可写入口后推送当前补丁，完成官方 CI 与维护者审查并合并。
4. 等待首个包含该提交的正式 DSH tag/npm 发布，核验发布 tarball 后记录准确版本。
