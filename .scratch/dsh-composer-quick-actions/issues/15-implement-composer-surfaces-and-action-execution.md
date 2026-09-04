# 实现三种 Composer 界面与动作执行

Type: task
Mode: AFK
Blocked by: 10, 14

## Question（问题）

实现 `ribbon`、`bar`、`launcher` 三种布局、共享动作控件和每会话执行控制器。注册 `conversation.input.dock` 与 `conversation.composer.dock`，但只渲染当前全局布局；严格复现已验证的输入框等宽公式和窄布局密度规则。插入动作必须能力检测并调用公共 `inputActions.insertText`；发送动作只处理未占用草稿、跟随原生 guard/queue、按会话单飞并使用官方 `submit()`。不得缓存 DSH 活对象、访问 DOM/Lexical 或私有事件。每个 Slot 使用局部错误边界和可重试失败状态。
