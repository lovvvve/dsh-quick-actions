# 交付 DSH 消息编辑器快捷动作

Label: `wayfinder:map`

## Destination（目标）

实现、验证并记录一个可安装的持久化 DSH 插件，在每个常规、由会话支持的常驻消息编辑器附近提供全局快捷动作。交付的插件支持作者拥有的预置快捷动作和用户拥有的自定义快捷动作：当前 DSH 提供公共 `InputActions.insertText(text)` 时可在光标处插入静态文本，否则从消息编辑器布局中省略兼容性抑制插入动作但保留其管理与持久化；发送动作在空草稿上通过公共 `insertText` 或兼容性的公共 `setDraft` 写入文本后使用官方 `submit`，可为每个动作单独设置发送确认，所有用户数据通过 DSH 本地持久化跨重启保留。

## Notes（备注）

- 领域：DSH 消息编辑器交互与持久化 Cordis 插件交付。请使用 [`CONTEXT.md`](../../CONTEXT.md) 中的词汇。
- 本项工作明确涵盖执行、测试、打包和使用文档，并将其推进至全部完成；不会止步于可供实施的规格说明。
- 预置快捷动作为只读，但用户可以将其隐藏，或克隆为可编辑的自定义快捷动作。
- 首个版本中的所有快捷动作均为全局生效。
- 布局也是全局持久化设置：默认 `ribbon`（A，上方动作带），并可选择 `bar`（B，下方操作栏）或 `launcher`（C，单入口面板）。
- 正常状态下预置与自定义动作合计最多 50 个；升级导致既有状态被动超限时保留全部数据，但禁止新增和克隆，直到恢复到上限以内。
- 插入功能以运行时能力而非未确定的正式版本号作为兼容边界：公共 `inputActions.insertText(text)` 存在时启用插入；缺失时将插入动作作为兼容性抑制插入动作从消息编辑器列表省略，但在管理界面保留、允许配置并计入 50 个动作上限，三种布局仍保留紧凑管理入口。完整能力路径使用已验证核心补丁覆盖；不得使用私有接口回退或虚构最低正式版本。
- 发送动作不因缺少 `insertText` 而被抑制：最终重验草稿未占用后，能力存在时使用公共 `insertText(text)`，缺失时仅为本次发送使用公共 `setDraft(text)`，随后调用公共 `submit()`。`setDraft` 不得成为插入动作的回退；异常时文本留在草稿中且不自动重试。
- 在依赖 Cordis 的 Services、Events、Builtins、Slots 或 token 之前，请查阅 `cordis-plugin-development`；Inspect 结果是运行时契约的事实来源。
- Client `cordis_inspect_query` 调用只能由拥有活动 GUI 页面的前台父会话运行，然后再将结果传给研究代理。如果没有页面响应该子 Agent，后台子代理的查询可能会无限期保持等待；Host Inspect 和已打包源码的读取可在子代理中安全进行。
- 能力缺失通道使用现有 `http://127.0.0.1:3080` 官方 DSH GUI；完整插入通道在最终验收时从官方基线创建隔离源码检出、应用已验证补丁，并用受管后台任务启动和记录独立测试 URL。不得修改已安装 `node_modules`，也不得声称独立服务器更新了现有 GUI。
- 视觉交互工作请查阅 `prototype` 和 `frontend-design`，词汇发生变化时请查阅 `domain-modeling`，实施期间请查阅 `test-driven-development`，宣布交付完成之前请查阅 `verification-before-completion`。
- 工作区是一个位于 `main` 分支且没有远程仓库的本地 Git 仓库。本目录下的本地 Markdown 是议题跟踪器，研究证据则隔离在 `research/<topic>` 分支上。
- 统一规格已汇总于 [`spec.md`](./spec.md)（baseline）；实现与验证工作以 spec 为准，正文与决策票据冲突时由 spec 第 1、15 节评估，不再重开已关闭决策。

## Decisions so far（已有决策）

<!-- 这里只列出已关闭票据的索引。每项决策均记录在对应票据中。 -->

- [建立用于研究的版本化工作区](./issues/01-establish-versioned-research-workspace.md) — 已提交的本地 `main` 基线现在支持隔离的研究分支；无需远程仓库。
- [识别受支持的 DSH 消息编辑器扩展点](./issues/02-identify-composer-extension-seams.md) — 支持持久化 Client Slots 和官方提交流程，而按选区插入以及覆盖所有消息编辑器的放置方式仍需就产品/核心边界作出决策。
- [识别持久化配置和预置扩展点](./issues/03-identify-durable-configuration-seams.md) — Host Settings 应持有用户自有快捷动作和预置差异；不可变的预置快捷动作仍归软件包所有，并通过可向后读取的数据模式重写来弥补当前的迁移能力缺口。
- [制定快捷动作的数据结构与预置合并规则](./issues/05-specify-action-schema-and-preset-merge.md) — 采用稳定双来源身份、插入/发送判别联合、不可变预置与用户增量、统一引用顺序，以及带确定性修复的版本化存储。
- [选择所需的 DSH 消息编辑器核心扩展](./issues/09-choose-required-dsh-composer-core-extensions.md) — 选择最小公共 `inputActions.insertText` 接口并将首版放置范围限定为常驻消息编辑器；能力缺失时不使用私有回退，插入动作按后续范围决策从 Composer 省略。
- [确定运行时与失败语义](./issues/06-decide-runtime-and-failure-semantics.md) — 插入动作保留编辑上下文；发送动作只处理未占用草稿，按能力选择公共写入操作后沿官方提交路径按会话单飞，所有失败均采用无内容丢失的保守行为。
- [选择快捷动作的放置方式和管理流程](./issues/04-choose-placement-and-management-flow.md) — 默认使用与输入框等宽的上方单行动作带，并提供下方操作栏和单入口面板作为全局持久化选项，三者共享管理与确认面板。
- [选择插件架构与软件包契约](./issues/07-select-plugin-architecture-and-package-contract.md) — 采用双面功能包加安装 bundle、Host Settings 与只读目录 Remote、共享领域深模块、局部会话执行，以及仓库自有的可测试 Client 构建适配器。
- [定义验证与发布验收标准](./issues/08-define-verification-and-release-acceptance.md) — 发布要求全部新鲜自动化、安装与人工验收通过并保存证据；官方 DSH 覆盖兼容性抑制路径，能力环境覆盖完整插入路径，动作上限与被动超限均须无损。
- [公开 DSH 消息编辑器 insertText 接口](./issues/10-publish-dsh-composer-insert-text-api.md) — 已产出经 TDD、构建、GUI 测试和独立审查、并重放到当前官方主线的核心补丁；它只证明能力路径，不冒充正式 DSH 发布版本。
- [搭建可发布工作区与 Client 构建适配器](./issues/11-scaffold-workspace-and-client-build-adapter.md) — 已建立双面功能包、安装 bundle 与经真实 tsdown/ModuleLoader/watch 测试的 browser-only 单文件 Client 构建链路，业务逻辑仍留给后续任务。
- [汇总统一规格](./spec.md) — 统一规格已转为 baseline：能力自适应兼容、无损被动超限、Unicode 校验口径、占位符拒绝、`SettingsScope` 结构化结果、最小公开提交凭据、Resident 公开判定、工具链原子发布与发布身份均已落入各自票据。

## Not yet specified（尚未明确）

<!-- 当前没有仍处于迷雾中的范围；实施、验证、打包和文档均已毕业为正式票据。 -->

## Out of scope（范围外）

- 当前 DSH 进程重启后即消失的临时动态插件。
- 在 no-session、hero 或 takeover 消息编辑器周围显示快捷动作，或为此新增覆盖所有消息编辑器的外层通用 Slot。
- 首个版本中按 Agent、按 Preset 或按对话设置可见性规则。
- 首个版本中的跨设备同步、导入和导出。
- 快捷动作文本中的运行时变量、模板、任意脚本或其他生成内容。
- 命令面板或纯键盘宏系统等非按钮调用界面。
- [将 insertText 补丁集成到 DSH 官方发布](./issues/19-upstream-insert-text-and-record-release.md) — 官方当前不接受外部 PR，且正式上游版本不再阻塞首版能力自适应插件；待官方提供协作入口时作为新的独立 effort 跟踪。
