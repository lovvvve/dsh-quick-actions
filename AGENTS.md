## 沟通

与用户交流时默认使用中文；仅在用户明确要求使用其他语言时切换。

## 代理技能

### 议题跟踪器

议题以 `.scratch/<feature>/` 下的本地 Markdown 文件进行跟踪。参见 `docs/agents/issue-tracker.md`。

### 分诊标签

使用规范标签 `needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human` 和 `wontfix`。参见 `docs/agents/triage-labels.md`。

### 领域文档

这是一个单上下文仓库：领域词汇在根目录的 `CONTEXT.md`，不可逆决策记在 spec、票据 `## Answer` 与地图里而**不是** `docs/adr/`。参见 `docs/agents/domain.md`。
