# 交付 DSH 消息编辑器快捷动作

Label: `wayfinder:map`

## Destination（目标）

实现、验证并记录一个可安装的持久化 DSH 插件，在每个常规、由会话支持的常驻消息编辑器附近提供全局快捷动作。交付的插件支持作者拥有的预置快捷动作和用户拥有的自定义快捷动作，既能通过公共 `InputActions` 接口在光标处插入静态文本，也能直接发送，并可为每个动作单独设置发送确认，还能通过 DSH 本地持久化使数据跨重启保留。

## Notes（备注）

- 领域：DSH 消息编辑器交互与持久化 Cordis 插件交付。请使用 [`CONTEXT.md`](../../CONTEXT.md) 中的词汇。
- 本项工作明确涵盖执行、测试、打包和使用文档，并将其推进至全部完成；不会止步于可供实施的规格说明。
- 预置快捷动作为只读，但用户可以将其隐藏，或克隆为可编辑的自定义快捷动作。
- 首个版本中的所有快捷动作均为全局生效。
- 布局也是全局持久化设置：默认 `ribbon`（A，上方动作带），并可选择 `bar`（B，下方操作栏）或 `launcher`（C，单入口面板）。
- 正常状态下预置与自定义动作合计最多 50 个；升级导致既有状态被动超限时保留全部数据，但禁止新增和克隆，直到恢复到上限以内。
- 完整插入功能依赖 DSH 核心公共 `inputActions.insertText(text)`；已测试补丁基于 `dsh-v0.1.2-rc.1`，正式首发版本仍需上游集成后记录。旧版本保留发送与配置能力，但禁用插入动作，且不得使用私有接口回退。
- 在依赖 Cordis 的 Services、Events、Builtins、Slots 或 token 之前，请查阅 `cordis-plugin-development`；Inspect 结果是运行时契约的事实来源。
- Client `cordis_inspect_query` 调用只能由拥有活动 GUI 页面的前台父会话运行，然后再将结果传给研究代理。如果没有页面响应该子 Agent，后台子代理的查询可能会无限期保持等待；Host Inspect 和已打包源码的读取可在子代理中安全进行。
- 视觉交互工作请查阅 `prototype` 和 `frontend-design`，词汇发生变化时请查阅 `domain-modeling`，实施期间请查阅 `test-driven-development`，宣布交付完成之前请查阅 `verification-before-completion`。
- 工作区是一个位于 `main` 分支且没有远程仓库的本地 Git 仓库。本目录下的本地 Markdown 是议题跟踪器，研究证据则隔离在 `research/<topic>` 分支上。

## Decisions so far（已有决策）

<!-- 这里只列出已关闭票据的索引。每项决策均记录在对应票据中。 -->

- [建立用于研究的版本化工作区](./issues/01-establish-versioned-research-workspace.md) — 已提交的本地 `main` 基线现在支持隔离的研究分支；无需远程仓库。
- [识别受支持的 DSH 消息编辑器扩展点](./issues/02-identify-composer-extension-seams.md) — 支持持久化 Client Slots 和官方提交流程，而按选区插入以及覆盖所有消息编辑器的放置方式仍需就产品/核心边界作出决策。
- [识别持久化配置和预置扩展点](./issues/03-identify-durable-configuration-seams.md) — Host Settings 应持有用户自有快捷动作和预置差异；不可变的预置快捷动作仍归软件包所有，并通过可向后读取的数据模式重写来弥补当前的迁移能力缺口。
- [制定快捷动作的数据结构与预置合并规则](./issues/05-specify-action-schema-and-preset-merge.md) — 采用稳定双来源身份、插入/发送判别联合、不可变预置与用户增量、统一引用顺序，以及带确定性修复的版本化存储。
- [选择所需的 DSH 消息编辑器核心扩展](./issues/09-choose-required-dsh-composer-core-extensions.md) — 新增最小公共 `inputActions.insertText` 接口，同时将首版放置范围限定为常驻消息编辑器，并为旧 DSH 版本安全禁用插入动作。
- [确定运行时与失败语义](./issues/06-decide-runtime-and-failure-semantics.md) — 插入动作保留编辑上下文；发送动作只处理未占用草稿并按会话单飞，所有确认、失败、断线和会话切换均采用无内容丢失的保守行为。
- [选择快捷动作的放置方式和管理流程](./issues/04-choose-placement-and-management-flow.md) — 默认使用与输入框等宽的上方单行动作带，并提供下方操作栏和单入口面板作为全局持久化选项，三者共享管理与确认面板。
- [选择插件架构与软件包契约](./issues/07-select-plugin-architecture-and-package-contract.md) — 采用双面功能包加安装 bundle、Host Settings 与只读目录 Remote、共享领域深模块、局部会话执行，以及仓库自有的可测试 Client 构建适配器。
- [定义验证与发布验收标准](./issues/08-define-verification-and-release-acceptance.md) — 发布要求全部新鲜自动化、安装与人工验收通过，并保存可复核证据；动作上限为 50，升级被动超限必须无损降级。
- [公开 DSH 消息编辑器 insertText 接口](./issues/10-publish-dsh-composer-insert-text-api.md) — 基于当前 DSH 标签完成了经 TDD、构建、GUI 测试和独立审查的上游补丁；正式发布版本由后续集成票据记录。

## Not yet specified（尚未明确）

<!-- 当前没有仍处于迷雾中的范围；实施、验证、打包和文档均已毕业为正式票据。 -->

## Out of scope（范围外）

- 当前 DSH 进程重启后即消失的临时动态插件。
- 在 no-session、hero 或 takeover 消息编辑器周围显示快捷动作，或为此新增覆盖所有消息编辑器的外层通用 Slot。
- 首个版本中按 Agent、按 Preset 或按对话设置可见性规则。
- 首个版本中的跨设备同步、导入和导出。
- 快捷动作文本中的运行时变量、模板、任意脚本或其他生成内容。
- 命令面板或纯键盘宏系统等非按钮调用界面。
