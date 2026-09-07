# 实现三种 Composer 界面与动作执行

Type: task
Mode: AFK
Blocked by: 14

## Question（问题）

实现 `ribbon`、`bar`、`launcher` 三种布局、共享动作控件和每会话执行控制器。注册 `conversation.input.dock` 与 `conversation.composer.dock`，但只在公开可核验的 Resident Composer 判定为真时渲染当前全局布局；不重开规格第 2.3 节范围，交付该公开判定的运行时/契约证据并用测试固定，杜绝 hero 渲染。严格复现已验证的输入框等宽公式和窄布局密度规则。若隐藏/停用后没有可执行动作，仍保留当前布局的紧凑管理入口。

**首版只有发送动作**（spec 第 16 节）：不实现插入能力检测、不实现兼容性抑制投影、不存在按能力分支的装载路径。发送动作只处理未占用草稿（须覆盖目标 DSH 公开的全部附件字段），最终重验通过后调用公共 `inputActions.setDraft(text)` 装载静态文本，随后调用公共 `inputActions.submit()`，按规格第 9.5 节保持单飞至官方提交阶段结束。

Command Send Action（命令发送动作，`/` 开头文本）走完全相同的两步，恒需确认，不解析或改写命令语义；**不得注册、驱动或复现 `inputTriggers` 的 `/`、`@` 候选项 pipeline，也不得自制候选菜单**（spec 第 9.1、16.2 节）。

单飞窗口只能基于目标 DSH 已公开的状态实现——公开 Input snapshot 为 `{ draft, imageIds, draftRev, phase, claim?, occurrences, queue }`，本票据须查证这些字段的实际语义，确定可归属于本次提交的最迟可靠边界，并用测试固定该判据；不得用 DOM/Lexical/私有事件或私有状态兜底，也不得新增 DSH 核心接口（spec 第 9.5、16.4 节）。硬验收标准是**不产生重复发送**：官方 sink 乐观清空，`setDraft` + `submit()` 后草稿一帧内回到空态，"草稿已占用"不足以充当互斥，必须覆盖快速连续激活的回归测试。任何写入后的同步失败都保留草稿且不自动重试。不得缓存 DSH 活对象、访问 DOM/Lexical 或私有事件。每个 Slot 使用局部错误边界和可重试失败状态。
