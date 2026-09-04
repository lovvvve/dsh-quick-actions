# 识别受支持的 DSH 消息编辑器扩展点

Type: research
Mode: AFK
Status: resolved
Blocked by: 01

## Question（问题）

持久化插件可以使用哪些确切且受支持的 DSH/Cordis 软件包机制、Client Slots、Services、Events 和 Builtins，以便在每个消息编辑器的上方或下方渲染控件、确保生命周期清理、在当前选区插入静态文本，并通过与消息编辑器相同的官方路径提交消息？请记录确切契约和源码引用；如果不存在受支持的扩展点，请指出所需的 DSH 核心扩展。

## Answer（答案）

引用的研究材料是[受支持的 DSH 消息编辑器扩展点](../research/composer-extension-seams.md)，记录于分支 `research/composer-extension-seams` 的提交 `5847e14`。

持久化扩展可采用 web-profile bundle，其 patch 会插入一个构建完成的 `dsh.client` 软件包。增量 `conversation.input.dock` 和 `conversation.composer.dock` Slots 覆盖常规的、由会话支持的 resident 消息编辑器；它们的 Slot 注册和普通 Cordis effect 会随所属 fiber 一并清理。符合 Slot 标准的 `inputActions.submit()` 会沿用内置消息编辑器的提交流程。

DSH `0.1.2-rc.1` 尚未公开两项必需能力：感知选区的文本插入，以及一个覆盖 no-session、hero、resident 和 takeover 消息编辑器的统一增量放置扩展点。`setDraft(text)` 会替换整个草稿并将光标移到末尾，而现有的选区感知 `paste(text)` 路径是私有的。最小的插入前置条件是提供公共的 `inputActions.insertText(text)`，并让它委托给该路径；若要按字面要求覆盖所有消息编辑器，还需要一个外层增量 Slot。产品/核心边界的决策交由[选择所需的 DSH 消息编辑器核心扩展](./09-choose-required-dsh-composer-core-extensions.md)处理。
