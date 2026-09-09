# 领域文档

本仓库使用单一领域上下文。

## 开始探索前，请阅读以下内容

- 仓库根目录下的 `CONTEXT.md`
- 不可逆决策的记录（本仓库不用 `docs/adr/`，见下）

## 本仓库的 ADR 等价物

**不要新建 `docs/adr/`。** 长期有效、不可逆的决策在本仓库有既定归属，另起一处会造出与它们并行的第二份真相：

- [`.scratch/dsh-composer-quick-actions/spec.md`](../../.scratch/dsh-composer-quick-actions/spec.md) 是 baseline，冲突时以它为准。第 15 至 18 节逐条记录了收尾决策、首版范围收缩、目录改走 Settings base 层与样式偏离，其中**第 17 节优先级最高**。
- 各票据 `.scratch/dsh-composer-quick-actions/issues/NN-*.md` 的 `## Answer` 是该决策的完整论证与取证。
- [`map.md`](../../.scratch/dsh-composer-quick-actions/map.md) 的 `Decisions so far` 是已关闭决策的索引。
- 根目录 [`CLAUDE.md`](../../CLAUDE.md) 的「已闭合、不得倒退的决策」是同一批结论的速查版。

domain-modeling 技能默认会在形成长期决策时创建 ADR 文件；在本仓库请改为写进上述位置。若工作与已记录的决策矛盾，明确指出冲突，不要在不作说明的情况下覆盖它。

## 布局

```text
/
├── CONTEXT.md            领域词汇
├── CLAUDE.md             项目指令与已闭合决策速查
├── packages/             功能包与安装 bundle
├── tools/                私有构建适配器（不发布）
├── tests/gui/            真实 GUI 验证（不在 vitest include 内）
└── .scratch/<feature>/   议题跟踪器：spec、map、issues、research、verification
```

这是 pnpm workspace，源码在各包自己的 `src/` 下，仓库根目录没有 `src/`。

请使用 `CONTEXT.md` 中定义的词汇。
