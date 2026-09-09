# 补齐两处边缘状态的用户可见反馈

Type: task
Mode: AFK
Status: resolved
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

## Answer（答案）

两处都已定案，按票据要求拆成三个提交：缺口 2 的修复（`cc7e74d`）、缺口 1 的回归用例（`2cf9b46`）、缺口 2 的 GUI 层断言（`d7ef081`）。**缺口 2 改了发货 UI；缺口 1 不改任何运行时行为**——源码取证表明票据 18 记录的成因不成立，插件当前行为正是 spec 第 9.5 节要求的，任何插件侧补充反馈都会违反第 9.5 或第 10 节。

### 缺口 1：不加插件侧反馈——机制取证纠正了票据 18 的记录

对 `@deepseek-ai/dsh-client-ui-conversation@0.1.2-rc.1`（`lib/client.js`）逐段读源码，得到的链路与票据 18 的描述不同：

1. **`submit()` 没有任何连接态检查。** `SessionInputShell.submit()` 把 `enter` 喂给 `SubmitMachine.onEnter()`；对任何非空白普通文本它一律返回 `default-sink` + `commit-draft` 两个 effect，`run()` 同步执行两者再 `publish()`。于是 `submit()` 返回时草稿**已被乐观清空**，不论连接是否存在。
2. **执行引擎不是「停在 `submitted` 观察阶段」，而是正常以成功关闭。** 引擎自己的 `publish()` 让拥有布局的 Slot entry 重渲染，其 layout effect 把最新 Input snapshot 喂进 `observe`：`draft === ''` 且 `phase === 'plain'` → 按第 9.5 节判定官方状态机已接收 → `settle(undefined)`，单飞释放、无反馈。`retained` 的两个发布点确实都不触发，但原因是**引擎已经关闭**，不是卡住。
3. **文本回到草稿是 DSH 自己恢复的。** sink 走 `conversation.sendSession()` → `session.prompt()`（fetch RPC）；断线时 fetch 拒绝，shell 的 `settleDetachedFailure()` → `restoreFailedDrafts()` 把失败文本按提交顺序放回草稿，并以 `sink-settled { ok: false, message }` 触发 `notice(error)`——InputBar 把 error 级 notice 转成 toast。这就是 GUI 用例里「文本回到草稿」的来源，也是**用户按原生发送按钮断线时逐字相同的体验**。票据 18 的 harness 只断言了草稿文本，没有检查 DSH 的 toast，因此「没有一句话解释」这一观察对 DSH 侧并未取证。

据此逐项裁定票据里的两个候选：

- **超时判定「没落地」**：不可达（单飞早已在乐观清空处关闭），并且被第 9.5 节明文禁止——「消息已经进入官方提交路径后的失败完全交给 DSH 原生错误反馈和失败草稿恢复；插件不得自动重试、复制草稿或显示重复错误」。
- **装载前按连接态拒绝激活**：违反第 10 节「成功加载后短暂断线：继续显示并**允许执行**最后一次 Host 确认的目录和用户动作快照」，控制器 `writeGate` 的注释与票据 14 的 Answer 都按此实现（可执行、不可写回）。同时原生发送按钮的 `disabled` 是 `removed || inert || !live || blocked || parentOffline`，其中 `live = input && keyboard && inputActions` **不含连接态**；插件若比原生按钮更严，就违背第 9.2 节「复现发送按钮自身的条件」。`guards.ts` 关于 `disabled` 的注释因此仍然成立。

**结论：不改发送路径，不加超时，不加连接态门禁。** 用户可见的最终行为：断线时点动作，文本短暂进入草稿并被乐观清空，随后由 DSH 恢复到草稿并给出 DSH 自己的错误提示；插件不加第二条说明。若票据 21 的窗口里观察到 DSH 的 toast 缺失（rejection message 为空），那是 DSH 的缺口，不在本插件可动范围。

落地为回归用例（`2cf9b46`）：

| 文件 | 内容 |
|---|---|
| `tests/client/composer.ts` | 假 Composer 新增 `holdSink` / `failHeldSinks()`，按上述源码建模「乐观清空 → sink 失败 → 恢复草稿」 |
| `tests/client/execution.spec.ts` | 新增 `a send the connection cannot carry` 三条：引擎在乐观清空处关闭且无反馈；恢复草稿后仍无第二个错误、投影为 `occupied-draft`；绝不代用户重试 |
| `tests/client/surfaces.spec.tsx` | 「断线时动作仍可执行」固定第 10 节，防止将来加连接态门禁 |
| `tests/gui/lifecycle.spec.ts` | 注释改为真实机制，新增断言 `[data-quick-actions-feedback]` 计数为 0（**未执行**） |

### 缺口 2：表单接管开场焦点，并把焦点还回去（`cc7e74d`）

- `ActionForm` 补上其他三个面板都有的两条焦点规则（spec 8.4）：打开时把光标放进标签输入框（`data-quick-actions-form-label` 标记，经 `useInitialFocusIn` 寻址，与票据 23 的做法一致），关闭时把焦点还给打开它的「新建」/「编辑」控件。于是第一下 Escape 只退出表单、焦点回到打开控件（仍在面板内），第二下才关面板——键盘用户的两级退出符合直觉。
- `useFocusReturn` 新增可选 `panel` 参数：嵌套面板只在焦点仍在自身内部（或已落到 body）时归还焦点。这是「面板在表单打开时整体关闭」路径所必需：React 卸载时先跑外层清理（焦点已还给管理入口）、再跑内层清理、最后才摘 DOM，若不加此规则，表单会把焦点拉回即将被移除的按钮，最终落到 body。`ManagerPanel` 自己的调用不传参数，行为不变。
- `ManagerPanel` 按目标给 `ActionForm` 加 `key`：从一个动作的编辑切到另一个动作时重挂载，光标重新进入表单，焦点归还指向打开这一份表单的控件。
- `manager.spec.tsx` 新增 7 条（`the form’s own focus scope`）；既有的焦点断言与 Tab 边界用例全部保持绿色。
- `tests/gui/validation.spec.ts`（`d7ef081`）的编辑段改用 Escape：标签框已聚焦 → Escape → 表单消失、面板仍在、焦点回到「编辑」（**未执行**）。

### 质量门（worktree，2026-09-09）

| 门 | 结果 |
|---|---|
| `pnpm test` | 22 文件 / **496 通过**（票据 18 收口时 485，新增 11） |
| `pnpm typecheck` | 两遍均通过（含 `tests/gui/`） |
| `pnpm lint` | 通过 |

### 留给票据 21 的两件事

1. 两条新增的 GUI 断言（`lifecycle.spec.ts` 的无 feedback note、`validation.spec.ts` 的编辑表单 Escape 作用域）需要安装窗口，随人工验收一起跑；`lifecycle` 那条要走 `sh tests/gui/lifecycle-round.sh` 的 `down` 半程。
2. 票据 21 评论里「用户在步骤 2/8 可能撞上表单 Escape 关掉面板」的预告已失效，已另加评论更正。
