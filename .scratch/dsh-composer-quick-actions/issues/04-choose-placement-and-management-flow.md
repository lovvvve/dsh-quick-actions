# 选择快捷动作的放置方式和管理流程

Type: prototype
Mode: HITL
Status: resolved
Blocked by: 02, 05, 06

## Question（问题）

哪种具体交互方式最适合在消息编辑器上方或下方提供快捷动作，同时支持可发现性、排序、溢出处理、隐藏和克隆预置快捷动作、编辑自定义快捷动作，并在宽、窄两种布局下支持可选的发送确认？请制作一个受支持的 DSH Slot 拓扑约束的低成本视觉原型，与用户共同比较可行方案，并选定一种交互契约。

## Answer（答案）

一次性原型保存在分支 `prototype/quick-action-layouts` 的提交 `29a06e3`，包含 `.scratch/dsh-composer-quick-actions/prototype/README.md` 与 `client.js`。它曾以动态 Cordis Plugin `qact-1` 的 `pkg-4` 运行在真实 DSH GUI 中，只模拟交互，不修改草稿、发送消息或保存配置。

最终产品保留三种全局布局，并将选择持久化到 Host Settings：

- A / `ribbon` 为默认布局：使用 `conversation.input.dock`，在常驻消息编辑器上方显示单行横向动作带。独立标题行被移除，“快捷动作”、动作列表和“管理”入口共处一行；动作过多时列表横向溢出，而管理入口保持可见。
- B / `bar` 为可选布局：使用 `conversation.composer.dock`，在消息编辑器下方直接显示少量高频动作，其余动作进入“更多”面板，“管理”入口常驻。
- C / `launcher` 为可选布局：使用 `conversation.input.dock`，上方只显示一个紧凑单行入口和动作数量；点击后打开带搜索与完整动作列表的面板，适合动作较多或偏好低信息密度的用户。

A 与 B 的左右外边界必须和消息输入框一致。A 位于 InputBar 外部，因此宽度采用 `100% - 2 × --dsh-composer-side-clearance` 并受 `--dsh-composer-card-max-width` 限制；B 的父级已包含 clearance，因此使用 `100%` 并应用同一个 card max-width。两者均居中。窄布局只压缩或隐藏次要内部信息，不改变外边界宽度。

三种布局共享集中式管理面板：预置快捷动作可排序、隐藏和克隆；自定义快捷动作可创建、编辑、启停、排序和删除。B 的“更多”和 C 的入口复用可搜索动作面板。需要确认的发送动作使用展示完整待发送文本的确认面板；用户已确认最终插件可以使用这些产品弹窗，此前“不用弹窗”仅指本次讨论不使用对话选择弹窗。

所有控件保留文本标签与清晰的键盘焦点样式；emoji 仅作装饰，不替代无障碍名称。响应式状态、面板和确认交互沿用[确定运行时与失败语义](./06-decide-runtime-and-failure-semantics.md)中的无内容丢失规则。
