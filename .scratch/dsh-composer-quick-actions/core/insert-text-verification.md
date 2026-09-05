# DSH `inputActions.insertText` 核心补丁验证

## 来源与产物

- 官方仓库：`https://github.com/deepseek-ai/deepseek-harness.git`
- 基线标签：`dsh-v0.1.2-rc.1`
- 基线提交：`a66e4702047846cdaa10c66c9d3df3951f5ea70d`
- 实施分支：`dsh/insert-text-api`
- 已审查提交：`5ee80be58d592d56ad9e163b5e11bc23d5b9f2a9`
- 可应用补丁：[`0001-expose-public-text-insertion.patch`](./0001-expose-public-text-insertion.patch)
- Node：`v26.4.0`
- pnpm：`11.7.0`

该提交尚未进入 DSH 官方发布，因此不能声明正式最低版本。它是基于 `dsh-v0.1.2-rc.1` 的已测试上游补丁；快捷动作插件在正式版本确定前仍必须运行时检测 `inputActions.insertText`。

## TDD 证据

### RED

```bash
pnpm exec vitest run packages/client/ui-conversation/tests/input-actions.client.spec.ts
```

在生产接口不存在时，6/6 测试按预期失败，错误为 `shell.actions.insertText is not a function`。

### GREEN

```bash
pnpm exec vitest run packages/client/ui-conversation/tests/input-actions.client.spec.ts
```

结果：1 个测试文件通过，6/6 测试通过。覆盖范围选区替换、无选区末尾回退、引用占位符清理、占位符-only 无操作、独立撤销边界和引用 chip 保留。

### 变异检查

把委托临时从 `this.paste(text)` 改成 `this.setDraft(text)` 后重跑同一测试，4 个行为测试按预期失败，证明测试能够拒绝破坏性整稿替换；随后恢复正确委托，并重新获得 6/6 通过。

## 自动化验证

### 包级测试

```bash
pnpm exec vitest run packages/client/ui-conversation/tests
```

结果：31 个测试文件通过，359/359 测试通过。

### Client / Host GUI 测试

```bash
pnpm run test:gui
```

结果：282 个测试文件通过、1 个既有文件跳过；3906 个测试通过、4 个既有测试跳过。

### 类型与构建

```bash
pnpm run build:lib:host
pnpm run typecheck:contracts-ready
pnpm run build:lib:client
pnpm --filter @deepseek-ai/dsh-client-ui-conversation run bundle
```

结果：全部退出码为 0。生成的 `lib/types/client/contract/input.d.ts` 包含 `insertText(text: string): void;`，生成的 `lib/client.js` 包含委托实现。

### 目录与公开文档契约

```bash
pnpm run gen-client-catalog
pnpm run gen-cordis-inspect-catalog
pnpm run verify-client-catalog
pnpm run verify-cordis-inspect-catalog
pnpm run verify-export-jsdoc
```

结果：两个目录重新生成后没有衍生差异；检查均通过，公开导出 JSDoc 完整。

### 文档与 Agent Note

```bash
pnpm run verify-translation-pairing
pnpm run verify-agent-note-classification
pnpm run verify-agent-note-format
pnpm run test:docs
```

结果：翻译配对、680 个 Agent Note 分类与格式以及 doc-quick 的 15/15 门槛全部通过。

### Lint 与发布卫生

```bash
files=$(git diff --name-only dsh-v0.1.2-rc.1..HEAD -- '*.ts' '*.tsx')
pnpm exec tsx scripts/run-oxlint.ts $files
pnpm run hygiene
```

结果：Oxlint 0 warnings / 0 errors；完整构建后 hygiene 15/15 门槛通过。

### Pack 检查

```bash
pnpm --filter @deepseek-ai/dsh-client-ui-conversation pack --pack-destination <TEMP_DIR>
```

解包验证发布物同时包含：

- `package/lib/types/client/contract/input.d.ts` 中的 `insertText(text: string): void;`
- `package/lib/client.js` 中的 `insertText: (text) => { ... }`

## 覆盖率说明

仓库当前在 `vitest.config.ts` 中豁免 browser conversation tree 的 V8 per-file coverage。将 coverage 限定到 `facade.ts` 时报告没有可计量文件，因此本补丁不声称数值覆盖率；发布证据采用上述行为测试、变异检查、完整 GUI 测试、类型检查和构建门槛。

## 代码审查

独立审查未发现 Critical 或 Important 问题。唯一 Minor 指出 Agent Note 曾把既有公开 span-CAS 类型/事件误写为私有；已改为准确表述“新 `InputActions` 操作不暴露 span 或 selection”，并重新通过双语配对与 Agent Note 格式检查。
