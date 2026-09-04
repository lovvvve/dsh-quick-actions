# 选择所需的 DSH 消息编辑器核心扩展

Type: grilling
Mode: HITL
Status: resolved
Blocked by: 02

## Question（问题）

受支持的消息编辑器界面无法在当前选区插入文本，也没有提供一个覆盖 no-session、hero、resident 和 takeover 消息编辑器的增量 Slot。首个版本应选择哪种边界：添加范围严格受限的 DSH 核心契约，还是将目标收窄为受支持的 resident 消息编辑器行为？如果核心工作仍在范围内，请确定 `inputActions.insertText(text)` 的确切语义、是否确实需要一个覆盖所有消息编辑器的外层 Slot、这些契约的所有权和兼容性，以及针对较旧 DSH 版本的回退方案。

## Answer（答案）

采用混合边界：为选区插入新增一个最小 DSH 核心接口，但将首版的放置范围收窄到常规、由会话支持的常驻消息编辑器。不新增覆盖 no-session、hero、resident 和 takeover 消息编辑器的外层通用 Slot；在 no-session、hero 或 takeover 状态下，快捷动作静默不渲染，并在恢复常驻消息编辑器后自然重新出现。

DSH 核心在 `@deepseek-ai/dsh-client-ui-conversation` 的公共 `InputActions` 契约中新增同步接口：

```ts
insertText(text: string): void
```

该接口不接受 options、不返回结果，也没有异步错误通道。它直接委托现有私有 `paste(text)` 行为：移除内部引用占位符；清理后为空则不操作；范围选区被替换；仅有光标时在光标处插入；没有有效选区时追加到文档末尾；形成独立撤销边界，并保留未被替换的富内容。快捷动作插件只消费公共 `InputActions`，不得访问 Composer DOM、Lexical、私有 shell 或 `slash/input-insert-text` 等内部事件。

核心接口由 DSH 独立实现、测试和发布，并作为本地图内先行但可与插件其他工作并行的实施前置，具体工作记录在[公开 DSH 消息编辑器 insertText 接口](./10-publish-dsh-composer-insert-text-api.md)。首次包含该接口的 DSH 版本确定后，插件文档应记录完整插入功能所需的最低版本。

插件必须在运行时检测 `inputActions.insertText`。旧 DSH 版本中，发送动作和配置管理继续可用；插入动作显示为禁用并明确提示升级 DSH。禁止静默回退到 `setDraft`、DOM 操作或其他私有机制。
