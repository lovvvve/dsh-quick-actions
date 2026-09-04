# 选择所需的 DSH 消息编辑器核心扩展

Type: grilling
Mode: HITL
Status: claimed
Blocked by: 02

## Question（问题）

受支持的消息编辑器界面无法在当前选区插入文本，也没有提供一个覆盖 no-session、hero、resident 和 takeover 消息编辑器的增量 Slot。首个版本应选择哪种边界：添加范围严格受限的 DSH 核心契约，还是将目标收窄为受支持的 resident 消息编辑器行为？如果核心工作仍在范围内，请确定 `inputActions.insertText(text)` 的确切语义、是否确实需要一个覆盖所有消息编辑器的外层 Slot、这些契约的所有权和兼容性，以及针对较旧 DSH 版本的回退方案。
