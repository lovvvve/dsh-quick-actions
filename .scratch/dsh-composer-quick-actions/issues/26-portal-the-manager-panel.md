# 把管理面板 portal 到 body

Type: task
Mode: AFK
Status: open
Blocked by: none

## Question（问题）

管理面板 `.dsh-cqa-manager` 是 `position: fixed; z-index: 31`，却渲染在 `conversation.input.dock` 的子树里。只要祖先里有任何一层建立了层叠上下文，这个 z-index 就只在该上下文内部有效，面板会被 shell 里 z-index 远低于它的元素压住。

[票据 21](./21-run-final-human-acceptance.md) 的最终验收在用户的实时 DSH 上撞到了这个问题的一个实例：侧栏拖拽把手（`class="wSkVaW_widthHandle"`，`position: absolute`、`z-index: 8`、占据 x 425–465 且贯穿全高，**不属于本插件**）盖在居中的管理面板左侧一条 40px 竖带上。面板里唯一中心落进这条带的控件是编辑表单的 13×13 原生复选框「发送前确认」，于是精确点那个方框会被把手接走（并可能开始拖动侧栏）。取证记在 `verification/release-evidence.md` 的票据 21 一节。

严重度按 spec 第 13.1 节判定：不涉及内容丢失、重复发送、持久化损坏或 Composer 崩溃，**不阻止发布**，故票据 21 未被它拦下。用户仍有两条可用路径——点开关文字可切换（实测 true → false），Tab 到开关后按空格可对称切换（true → false → true）。

要解决的问题：

1. 把 `ManagerPanel`（以及需要一并评估的 `ActionPanel` / `ConfirmPanel`）通过 `createPortal` 挂到 `document.body`，脱离输入坞的祖先层叠上下文；
2. 确认 portal 之后仍然满足既有约束——[票据 23](./23-adopt-dsh-ui-primitives.md) 已裁定三个面板容器**不改用 `Modal`**（锚定 popover 语义 + spec 第 13.3 节视觉基线），因此 `ActionPanel` / `ConfirmPanel` 的锚定定位若依赖 `.dsh-cqa-anchor` 的 `position: relative`，portal 化会改变定位基准，需要重新测量或改用视口坐标；
3. 焦点管理不得回退：`modal.ts` 的 `useInitialFocusIn` / `useFocusReturn` 与票据 25 定下的「第一下 Escape 只退表单、第二下才关面板」必须原样成立，`manager.spec.tsx` 现有用例是硬门槛；
4. 每 Slot 错误边界与 fiber dispose 时的清理不得泄漏 portal 容器（spec 第 7.3 节）；
5. GUI 侧补一条回归：面板内每个控件的中心点命中测试应当落在它自己或它的后代上，而不是 shell 的元素——这正是本票据的可复现判据，`tests/gui/` 里用 `document.elementFromPoint` 即可写。

## Comments（评论）

### 2026-09-09 — 由票据 21 的最终验收立项

本票据在地图目标达成之后创建，属发布后的界面打磨，不回溯阻塞任何已关闭票据。注意验收当时的覆盖物来自用户 profile 里的第三方侧栏插件，**不要**把修复写成针对某个具体类名的规避；要修的是本插件面板的层叠归属。
