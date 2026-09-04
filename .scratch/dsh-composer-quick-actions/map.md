# 交付 DSH 消息编辑器快捷动作

Label: `wayfinder:map`

## Destination（目标）

实现、验证并记录一个可安装的持久化 DSH 插件，在每个消息编辑器附近提供全局快捷动作。交付的插件支持作者拥有的预置快捷动作和用户拥有的自定义快捷动作，既能在光标处插入静态文本，也能直接发送，并可为每个动作单独设置发送确认，还能通过 DSH 本地持久化使数据跨重启保留。

## Notes（备注）

- 领域：DSH 消息编辑器交互与持久化 Cordis 插件交付。请使用 [`CONTEXT.md`](../../CONTEXT.md) 中的词汇。
- 本项工作明确涵盖执行、测试、打包和使用文档，并将其推进至全部完成；不会止步于可供实施的规格说明。
- 预置快捷动作为只读，但用户可以将其隐藏，或克隆为可编辑的自定义快捷动作。
- 首个版本中的所有快捷动作均为全局生效。
- 在依赖 Cordis 的 Services、Events、Builtins、Slots 或 token 之前，请查阅 `cordis-plugin-development`；Inspect 结果是运行时契约的事实来源。
- Client `cordis_inspect_query` 调用只能由拥有活动 GUI 页面的前台父会话运行，然后再将结果传给研究代理。如果没有页面响应该子 Agent，后台子代理的查询可能会无限期保持等待；Host Inspect 和已打包源码的读取可在子代理中安全进行。
- 视觉交互工作请查阅 `prototype` 和 `frontend-design`，词汇发生变化时请查阅 `domain-modeling`，实施期间请查阅 `test-driven-development`，宣布交付完成之前请查阅 `verification-before-completion`。
- 工作区是一个位于 `main` 分支且没有远程仓库的本地 Git 仓库。本目录下的本地 Markdown 是议题跟踪器，研究证据则隔离在 `research/<topic>` 分支上。

## Decisions so far（已有决策）

<!-- 这里只列出已关闭票据的索引。每项决策均记录在对应票据中。 -->

- [建立用于研究的版本化工作区](./issues/01-establish-versioned-research-workspace.md) — 已提交的本地 `main` 基线现在支持隔离的研究分支；无需远程仓库。
- [识别受支持的 DSH 消息编辑器扩展点](./issues/02-identify-composer-extension-seams.md) — 支持持久化 Client Slots 和官方提交流程，而按选区插入以及覆盖所有消息编辑器的放置方式仍需就产品/核心边界作出决策。
- [识别持久化配置和预置扩展点](./issues/03-identify-durable-configuration-seams.md) — Host Settings 应持有用户自有快捷动作和预置差异；不可变的预置快捷动作仍归软件包所有，并通过可向后读取的数据模式重写来弥补当前的迁移能力缺口。

## Not yet specified（尚未明确）

- 具体的实施切片和源文件边界；只有在选定受支持的 DSH 扩展点和架构后，才能明确这些内容。
- 自动化测试的确切拆分方式、测试夹具以及浏览器手动验证流程；这些内容将在运行时行为和架构确定后转为正式票据。
- 打包、安装、升级和最终用户文档任务；这些内容将在软件包契约确定后转为正式票据。

## Out of scope（范围外）

- 当前 DSH 进程重启后即消失的临时动态插件。
- 首个版本中按 Agent、按 Preset 或按对话设置可见性规则。
- 首个版本中的跨设备同步、导入和导出。
- 快捷动作文本中的运行时变量、模板、任意脚本或其他生成内容。
- 命令面板或纯键盘宏系统等非按钮调用界面。
