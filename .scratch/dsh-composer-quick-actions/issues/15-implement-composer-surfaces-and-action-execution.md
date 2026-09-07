# 实现三种 Composer 界面与动作执行

Type: task
Mode: AFK
Blocked by: 10, 14

## Question（问题）

实现 `ribbon`、`bar`、`launcher` 三种布局、共享动作控件和每会话执行控制器。注册 `conversation.input.dock` 与 `conversation.composer.dock`，但只在公开可核验的 Resident Composer 判定为真时渲染当前全局布局；不重开规格第 2.3 节范围，交付该公开判定的运行时/契约证据并用测试固定，杜绝 hero 渲染。严格复现已验证的输入框等宽公式和窄布局密度规则。插入动作必须检测公共 `inputActions.insertText`：能力存在时调用它，缺失时把全部插入动作作为兼容性抑制插入动作从 ribbon、bar、launcher 及可搜索动作面板省略；若过滤后没有可执行动作，仍保留当前布局的紧凑管理入口。发送动作只处理未占用草稿（须覆盖目标 DSH 各基线公开的全部附件字段）并在最终重验后装载静态文本：`insertText` 存在时调用它，缺失时仅为发送调用公共 `setDraft`，随后按规格第 9.6 节保持单飞至官方提交阶段结束并使用公共 `submit()`；按规格决定消费新增最小公开提交凭据，凭据可用前不得用任何更短窗口判据，也不得用 DOM/Lexical/私有事件判断。任何写入后的同步失败都保留草稿且不自动重试。不得缓存 DSH 活对象、访问 DOM/Lexical 或私有事件。每个 Slot 使用局部错误边界和可重试失败状态。
