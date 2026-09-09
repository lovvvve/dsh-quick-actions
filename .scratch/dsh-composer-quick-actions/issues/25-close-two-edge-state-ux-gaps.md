# 补齐两处边缘状态的用户可见反馈

Type: task
Mode: AFK
Blocked by: none

## Question（问题）

[票据 18](./18-run-integration-and-release-verification.md) 的真实 GUI 验证发现两处**用户可见的反馈缺口**。两者都不违反 spec 的硬要求（零内容丢失、Escape 关闭 overlay 都成立），都不阻塞[票据 21](./21-run-final-human-acceptance.md)，但都是用户会撞上的粗糙面。本票据的问题是：首版收口前要不要补这两处，以及各自补到什么程度。

### 缺口 1：断线时装载失败没有任何说明

激活一个发送动作会走 `setDraft(text)` → `submit()`。连接断开时 `setDraft` 已经把文本装进 Composer，而 `submit()` 既不抛错也不落地，于是执行层停在观察阶段，**不发布任何结果反馈**：用户看到自己的文本躺在草稿里，没有一句话解释发生了什么。

- 取证：`verification/release-evidence.md` 第三轮「两个行为发现」第 1 条；用例 `tests/gui/lifecycle.spec.ts`（`down` 半程）里有一段注释说明此处**故意不断言**反馈，因为那是观测到的行为而非契约。
- `retained` 有两个发布点（`src/client/session/execution.ts`）：`submit()` **抛错**，或提交之后的**下一次 Input 提交**里草稿仍未被清空（`observe`）。断线时 `submit()` 不抛错，而 DSH 也不会再发布任何 Input 提交，于是执行机停在 `submitted` 观察阶段，两个发布点**都不触发**。
- spec 第 9.5 节的硬要求（零内容丢失）不受影响，重连后单飞窗口也会释放——缺的只是解释。
- 待定：是靠超时判定「没落地」，还是在装载前用公开 Input snapshot / 连接态先行判定并直接拒绝激活（后者更保守，也更接近第 9.2 节的发送前置条件）。**不得**为此新增 DSH 核心接口（spec 第 16.4 节）。

### 缺口 2：管理面板的表单不接管开场焦点

`useInitialFocusIn` 用在 `ManagerPanel` / `ActionPanel` / `ConfirmPanel` 上，却没有用在 `ActionForm` 上。于是点「编辑」或「新建」之后，焦点仍停在行内那颗按钮上——在面板内、表单外——此时按 Escape 不会经过表单的 `stopPropagation`，而是直达面板自己的 Escape 处理器：**整个管理面板被关掉，而不是只退出表单**。

- `src/client/modal.ts` 的 `useModalKeys` 注释写的是「嵌套编辑上下文会在 Escape 到达本处理器前拦下它，因此退出表单不会关闭面板」。该意图只在焦点已在表单内时成立。
- 候选修复：给 `ActionForm` 也加 `useInitialFocusIn`。primitives 没有 `forwardRef`，所以要按标记属性寻址（现有做法：`ConfirmPanel` 用 `[data-quick-actions-confirm-send]`）；最自然的落点是标签输入框，它是用户接下来要打字的地方。
- 顺带要确认的：`client/manager.spec.tsx` 里现有的焦点断言不会因此变红，以及 `useFocusReturn` 在「表单打开时关闭面板」这条路径上仍把焦点还给管理入口。
- 取证：`verification/release-evidence.md` 第四轮「本轮的一个新发现」。ticket 18 的 harness 已改为不依赖 Escape 的作用域（离开表单和面板都走各自的显式控件），因此这条修复不会让任何现有 GUI 用例失效。

## 为什么合成一张票据

两者是同一个问题的两面——**边缘状态下用户得不到解释**：一处是失败没有说明，一处是键盘操作的作用域超出预期。要不要在首版收口前补、以及补到什么程度，是同一个取舍，适合一次定案。实施时仍应拆成两个提交。

## 约束

- 不新增任何 DSH 核心接口（spec 第 16.4 节）。
- 不改动已闭合决策：发送只有 `setDraft` → `submit` 一条装载路径；不自制候选菜单；`confirm` 的默认值只在创建/克隆时初始化。
- 两项都要有回归用例：缺口 1 在 `client/execution.spec.ts`，缺口 2 在 `client/manager.spec.tsx`。GUI 层的补充断言可加进 `tests/gui/lifecycle.spec.ts` 与 `tests/gui/validation.spec.ts`，但需要一次安装窗口，可与票据 21 的人工验收合并进行。
