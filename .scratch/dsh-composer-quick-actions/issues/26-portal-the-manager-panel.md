# 把管理面板 portal 到 body

Type: task
Mode: AFK
Status: resolved
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

### 2026-09-09 — 用户定案：本票据只 portal 管理面板

用户明确「只 portal 管理面板」，据此收窄上面第 1、2 项：

- **在范围内**：`ManagerPanel` 与它的 backdrop 一起 portal 到 `document.body`。
- **不在范围内**：`ActionPanel` 与 `ConfirmPanel` 保持原地。它们是锚定 popover，定位基准是 dock 里 `.dsh-cqa-anchor` 的 `position: relative`，portal 会把基准换成视口、需要重算坐标，属另一种改动；且票据 21 在三个视口下实测其控件均可正常点击，没有实证问题。**这两个面板仍带着同一个根因**，只是尚未表现出用户可见症状——不要在别处把它记成「已解决」。
- 第 3、4 项（焦点归还与 Escape 两级作用域不回退、dispose 不泄漏）是本次的验收门槛，留在范围内。
- 第 5 项的命中测试回归针对管理面板实现（`tests/gui/stacking.spec.ts`），写成机制无关的形式：遍历面板内每个控件做 `elementFromPoint`，命中不属于面板的元素即失败，因此将来换成别的覆盖物也能抓到。

### 2026-09-09 — 由票据 21 的最终验收立项

本票据在地图目标达成之后创建，属发布后的界面打磨，不回溯阻塞任何已关闭票据。注意验收当时的覆盖物来自用户 profile 里的第三方侧栏插件，**不要**把修复写成针对某个具体类名的规避；要修的是本插件面板的层叠归属。

## Answer（答案）

`ManagerPanel` 与它的 backdrop 现在经 `createPortal` 渲染在 `document.body` 上，脱离输入坞的祖先层叠上下文；`z-index: 31` 从此按页面自身的层叠上下文排序。取证见 `verification/release-evidence.md` 的票据 26 一节。

### 为什么是 `document.body` 而不是自建容器

React 自己插拔 portal 的子节点，所以没有本 feature 拥有的容器需要清理——spec 第 7.3 节的「dispose 不泄漏」由构造保证，而不是靠一段卸载代码。单元层为此钉了一条回归：关闭与卸载后 `[data-quick-actions-manager]` 与 `[data-quick-actions-backdrop]` 在 body 上都为 0。

backdrop 必须跟着走。留在原地它会去遮 dock 那一层，而它的「点击关闭」会落到本该在它上面的面板底下。

### `react-dom` 的处置

`createPortal` 来自 `react-dom`，而它是 shell 冻结 seed 表里的条目（`"react-dom": n6`，与 shell 共用同一实例，官方 primitives 自己也从它导入 `createPortal`），所以 require 它不会引入第二份渲染器。三处同步：`tsdown.config.ts` 的 `external`、`package.json` 的 `dsh.client.external`（打包契约对产物 `require` 面做严格相等断言）、`peerDependencies` 的 `^18.3.1`。`tests/release/packaging.spec.ts` 的 `BROWSER_SEEDS` 本就含该键，无需放宽。

### 焦点与键盘没有回退

portal 只搬 DOM 节点、不搬 React 树：事件仍冒泡到 dock，Tab 顺序变成文档末尾（离草稿更远而非更近），`modal.ts` 的两个 hook 都按面板元素工作，不受影响。票据 25 定下的「第一下 Escape 只退表单、第二下才关面板」与焦点归还由 `manager.spec.tsx` 既有用例守住，全部继续通过。`modal.ts` 文件头那句「没有面板经 portal 渲染」已过时，一并改写。

### 验证

`pnpm test` 22 文件 / **498 通过**（新增 2），typecheck 两遍与 lint 均通过。GUI 侧新增 `tests/gui/stacking.spec.ts`：遍历面板内每个控件的中心做 `elementFromPoint`，命中非面板元素即失败，机制无关，将来换个覆盖物也能抓到。**第二轮三视口全部通过**，种子为 3 条预置加 1 条自定义动作并打开编辑表单，即票据 21 失手的那个场景。

第一轮三视口失败的是 harness 判据本身：面板是滚动容器，折叠线以下的控件被裁剪，那个像素本就属于面板背后的东西，于是报成「被自己的 backdrop 盖住」。判据改为先滚进视野再取矩形，并跳过仍在可视框外的控件——这同时让底部那个 13px 复选框第一次真正被测到。同轮常规套件 43 通过 0 失败，反证了产品侧无恙。

### 未做的部分（明确留下，不得记成已解决）

`ActionPanel` 与 `ConfirmPanel` 仍在 dock 子树内，**带着同一个根因**。用户定案本票据只处理管理面板；它们的锚定定位依赖 `.dsh-cqa-anchor` 的 `position: relative`，portal 会把基准换成视口、需要重算坐标。票据 21 与本轮都未观察到它们的用户可见症状（三视口下控件均可点击），因此不新开票据，等出现证据再说。
