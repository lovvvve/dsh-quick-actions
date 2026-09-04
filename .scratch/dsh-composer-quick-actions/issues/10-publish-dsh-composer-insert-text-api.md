# 公开 DSH 消息编辑器 insertText 接口

Type: task
Mode: AFK
Blocked by: 09

## Question（问题）

在 `@deepseek-ai/dsh-client-ui-conversation` 的公共 `InputActions` 契约中实现并验证同步的 `insertText(text: string): void`。该接口必须直接复用现有私有 `paste(text)` 的占位符清理、选区替换、无选区末尾回退、富内容保留和独立撤销边界语义；更新相关类型、生成式 Inspect/Slot 契约、测试及版本记录。不得新增 options、返回值、DOM/Lexical 绕过或覆盖所有消息编辑器的外层 Slot。记录首次包含该接口的 DSH 版本，以供快捷动作插件声明完整功能的兼容边界。
