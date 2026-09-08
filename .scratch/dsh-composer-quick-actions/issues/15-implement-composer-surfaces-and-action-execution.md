# 实现三种 Composer 界面与动作执行

Type: task
Mode: AFK
Status: resolved
Blocked by: 14

## Question（问题）

实现 `ribbon`、`bar`、`launcher` 三种布局、共享动作控件和每会话执行控制器。注册 `conversation.input.dock` 与 `conversation.composer.dock`，但只在公开可核验的 Resident Composer 判定为真时渲染当前全局布局；不重开规格第 2.3 节范围，交付该公开判定的运行时/契约证据并用测试固定，杜绝 hero 渲染。严格复现已验证的输入框等宽公式和窄布局密度规则。若隐藏/停用后没有可执行动作，仍保留当前布局的紧凑管理入口。

**首版只有发送动作**（spec 第 16 节）：不实现插入能力检测、不实现兼容性抑制投影、不存在按能力分支的装载路径。发送动作只处理未占用草稿（须覆盖目标 DSH 公开的全部附件字段），最终重验通过后调用公共 `inputActions.setDraft(text)` 装载静态文本，随后调用公共 `inputActions.submit()`，按规格第 9.5 节保持单飞至官方提交阶段结束。

Command Send Action（命令发送动作，`/` 开头文本）走完全相同的两步，恒需确认，不解析或改写命令语义；**不得注册、驱动或复现 `inputTriggers` 的 `/`、`@` 候选项 pipeline，也不得自制候选菜单**（spec 第 9.1、16.2 节）。

单飞窗口只能基于目标 DSH 已公开的状态实现——公开 Input snapshot 为 `{ draft, imageIds, draftRev, phase, claim?, occurrences, queue }`，本票据须查证这些字段的实际语义，确定可归属于本次提交的最迟可靠边界，并用测试固定该判据；不得用 DOM/Lexical/私有事件或私有状态兜底，也不得新增 DSH 核心接口（spec 第 9.5、16.4 节）。硬验收标准是**不产生重复发送**：官方 sink 乐观清空，`setDraft` + `submit()` 后草稿一帧内回到空态，"草稿已占用"不足以充当互斥，必须覆盖快速连续激活的回归测试。任何写入后的同步失败都保留草稿且不自动重试。不得缓存 DSH 活对象、访问 DOM/Lexical 或私有事件。每个 Slot 使用局部错误边界和可重试失败状态。

## Answer（答案）

已交付三种 Composer 布局、共享动作控件与每会话执行层。源码位于
`packages/composer-quick-actions/src/client/{dsh.ts,index.tsx,session/,surfaces/}`、
`src/locales/` 与 `src/styles/`；测试位于 `tests/client/{composer.ts,execution.spec.ts,layout.spec.ts,plugin.spec.ts,surfaces.spec.tsx}`。

### 1. Resident Composer 的公开判定

**判据**：`conversation.composer.dock` 条目「已挂载」当且仅当随附 composer 处于常驻、
由 session 支持的形态。因此该条目的挂载本身就是 DSH 自己给出的常驻声明。

运行时/契约取证（DSH 0.1.2-rc.1，检出于 `~/.npm/_npx/.../node_modules/@deepseek-ai/`）：

- `InputBar` 只在 `variant === "composer" && input !== undefined && sessionId !== undefined`
  时渲染 `conversation.composer.dock`（`dsh-client-ui-conversation/lib/client.js:15716`）；
  hero 走 `variant: "hero"` 分支（`same file:14438`），不渲染该 dock。
- `ConversationRoot` 从 composer stack 渲染 `conversation.input.dock`，只要 `zone`
  存在即可（`same file:14459`），而 `zone` 只要求 Session 与 Input 存在
  （`same file:14404`）——因此 input dock **会**出现在 hero 上，单独不足以判定。
- 生成式 Slot 账本同样把 `conversation.composer.dock` 记为「Ambient entries below the
  composer card」，`declaredBy: an entry in 'conversation.composer.bar'`
  （`dsh-cordis-client-runner/lib/client.js:2463-2511`）。
- takeover 无需另设判定：chain 条目胜出时 renderer 保留常驻 fallback 挂载但把 wrapper
  设为 `display: none`（`dsh-client-ui-renderer/lib/client.js:871-878`），两个 dock 一并隐藏。

实现为 `surfaces/residency.ts` 的 beacon 注册表：composer dock 条目挂载期间标记该
Session，input dock 条目只在标记成立时渲染 `ribbon` / `launcher`。**不复刻 shell 私有的
hero 公式，不读 DOM、不读私有 Composer 状态。** 代价是 hero→常驻切换时晚一帧渲染；方向正确
（硬要求是「绝不出现在 hero」，不是「立刻出现」）。测试见 `surfaces.spec.tsx` 的
「the Resident Composer predicate」三例。

### 2. 单飞窗口的公开状态判据

互斥锁是插件自己的：`activate()` 在任何 await 与任何草稿写入之前同步占用。**刻意不用草稿占用
充当互斥**——官方 sink 乐观清空，`submit()` 内草稿就已回到空态。

窗口何时**关闭**才用公开 Input snapshot 判定。依据：`SessionInputShell.submit()` 同步把
`enter` 事件喂给纯 `SubmitMachine`、同步执行返回的 effects、然后 `publish()`
（`dsh-client-ui-conversation/lib/client.js:11713-11751, 11955-11992`），因此 `submit()`
返回后的第一个快照就带有机器裁决：

| 观察到 | 判定 | 处置 |
|---|---|---|
| `phase` 为 `adjudicating` / `submitting` | 机器为本次尝试占用了独占的 frozen slot（`onEnter` 在这两个 phase 下拒绝新 `enter`，`lib/client.js:10564-10566`） | 保持单飞，直到 phase 离开这两个状态——这是可归属于本次提交的**最迟可靠边界** |
| `phase` 回到 `plain` 且 `draft` 为空 | 官方乐观提交清空了装载（`commit-draft`，`lib/client.js:11993-12017`）；detached sink 之后完全不进入公开快照 | 关闭单飞，无成功提示（本地消息回显即反馈） |
| `phase` 仍为 `plain` 且 `draft` 非空 | 机器拒绝了本次提交 | 关闭单飞，保留草稿，提示「未发送，文本已保留」 |

普通发送用**是否清空**而非「是否等于装载文本」判定：`draft` 是编辑器的 clipboard-text 投影而不是
交给 `setDraft` 的原串，比较两者会把裁决绑在那次往返归一化上；而装载只在已核验未占用的草稿上执行，
装载后草稿里的内容必然是本功能自己的文本，也只有官方提交会清空它。`run()` 期间的观察一律忽略，
所以窗口**不会在开启它的那一 tick 内关闭**。
硬验收（同一 tick 两次激活只产生一次发送）由 `execution.spec.ts`
「never sends twice for two activations in the same tick」「is not fooled by the optimistic
clear reopening the draft in the same tick」与 `surfaces.spec.tsx`
「never sends twice for two clicks in one tick」固定。

### 3. 其余交付

- **发送前置条件**：`session/guards.ts` 对公开快照 `{draft, imageIds, draftRev, phase,
  claim?, occurrences, queue}` 逐字段表态——`draft !== ''`（含纯空白，不 trim）、
  `imageIds`、`occurrences` 计入占用；`queue` 明确不计（模型流式期间允许发送）；
  `phase !== 'plain'` 归为忙。复刻随附发送按钮的 guard：`removed`、`blocked`、
  continuable subagent 的 `parentAvailable !== true`。`disabled` 无需判定（其成立条件仅
  「无 Session」或 hero，均被 Slot 作用域与常驻判定排除）。
- **`blocked` 的公开读取**：`ctx.conversation.blocks.storeFor(sessionId)`，其文档明确写为
  「the registry face other plugins reach」。通过 `ctx.get`（Cordis 文档：
  「Read a service from the store **without the inject requirement**」）读取，因此
  **`inject` 仍严格是 spec 第 7.3 节的四项** `slots / settingsScope / connection / locale`；
  服务缺席时降级为「未被阻断」，不猜测 DOM。
- **两步装载**：最终重验通过后 `setDraft(text)` → `submit()`，无能力分支。命令发送动作走完全
  相同的两步；不注册、不驱动、不复现 `inputTriggers`，不自制候选菜单。
- **最终重验**：动作定义（含跨越命令边界的改写）、Session、草稿占用、原生 guard 全部重读。
  按 spec 第 9.3 节区分两类：等待期间被**删除/隐藏** → 无副作用取消面板；被**改写** →
  面板保留，确认时报「状态已变化，请重试」。
- **失败语义**：`setDraft` 抛错 → 未写入，保留原草稿并给可重试执行错误；`submit` 抛错或机器
  未接收 → 保留已装载文本并提示「未发送，文本已保留」。两者都不自动重试。已进入官方路径后的
  失败完全交给 DSH，不重复报错。
- **布局与宽度**：`ribbon`/`launcher` 走 `conversation.input.dock`，`bar` 走
  `conversation.composer.dock`，两者恒注册、只渲染当前布局。ribbon 自行扣除
  `--dsh-composer-side-clearance`（它渲染在 InputBar 的 padding 之外），bar 取 `100%`
  （它渲染在该 padding 之内），两者同取 `--dsh-composer-card-max-width` 并居中——公式由
  `layout.spec.ts` 固定，1 CSS px 实测归票据 18。窄布局只隐藏区段标题并收紧间距，不改外边界，
  控件一律保留可见文本标签。
- **空投影**：三种布局在没有任何可执行动作时仍渲染紧凑管理入口。
- **错误隔离**：每个 Slot 入口自带错误边界，失败只替换快捷动作区域并提供重试。未失败时边界只渲染
  Fragment，不额外插入元素——两个 dock 都在带 `gap` 的 flex column 里，空 wrapper 会推动 hero 的
  输入框位置。
- **确认面板的模态语义**：面板就地渲染（非 portal），因此自带 Tab 焦点陷阱与遮罩，键盘用户无法在
  等待确认时绕到背后的草稿；关闭后焦点回到触发控件，控件已被禁用或已卸载时回落到管理入口。
- **样式标签引用计数记录在 tag 自身的 dataset 上**：热重载期间新旧两个 fiber 各有独立模块作用域，
  计数放 DOM 里才能避免旧 fiber 卸载时删掉仍在使用的样式。
- **`blocked` 每次读取都重新解析 `ctx.get('conversation')`**：该服务不在 `inject` 里，加载顺序无
  保证；缓存首次解析会把「服务还没就绪」变成「这个会话永远不会被阻断」。
- **生命周期**：控制器、会话执行注册表、词典、样式与两个 Slot 注册全部经 `ctx.effect` /
  `ctx.slots.inject` 安装，fiber 卸载后无残留（`plugin.spec.ts` 固定）。

### 已知边界与交给后续票据的部分

1. **管理面板、可搜索动作面板与表单属票据 16**。本票据的「管理」入口调用
   `controller.openManager()`；`bar` 的「更多」与 `launcher` 入口目前打开的是布局自带的
   **普通弹出列表**（同一顺序、无搜索框），使这两种布局可用。票据 16 落地共享**可搜索**动作
   面板后，两个入口应改接该面板，本地列表随之删除。
2. **确认面板** 已在 `session/ConfirmPanel.tsx` 交付（spec 第 14 节把「确认」归入
   `src/client/session/`），含命令发送动作的「无候选菜单」说明、Esc / 遮罩 / 取消三条无副作用
   取消路径与焦点返回。票据 16 若要统一到 DSH primitives，可在其上打磨文案与模态语义。
3. **CSS Modules 改为带前缀的样式字符串 + `<style data-plugin-css>` 注入**：Client 构建适配器
   产出单文件 browser CJS，没有 CSS 管线（spec 第 11.2 节），加一条会改动票据 11 的契约测试。
   类名统一前缀 `dsh-cqa-`，只用 DSH alias 主题 token，不覆盖全局主题。
4. **未使用 `@deepseek-ai/dsh-client-ui-primitives`**：Client bundle 只允许 `require` 构建适配器
   显式声明的 external，本轮只放行 `react` 与 `react/jsx-runtime`。DSH 契约类型同样按既有惯例
   在 `src/client/dsh.ts` 内结构化声明并逐条注明取证来源，不新增运行时依赖。
5. **新增依赖**：`react`/`react-dom`/`@types/react`/`@types/react-dom` 只作包内 devDependency
   （与 `@deepseek-ai/dsh-client-ui-*` 的做法一致——React 由浏览器模块表在运行时提供，不该
   变成安装期约束，因此**不进 `peerDependencies`**）；仓库根新增 `jsdom` 与
   `@testing-library/react` 供界面测试。
6. **真实 GUI 未验证**：本轮全部为受控 fake（无真实 LLM、网络、Lexical、DOM 内部）。常驻判定、
   等宽 1 CSS px、三视口与端到端发送归票据 18。

### 新鲜验证（本轮）

- `pnpm typecheck`：通过（`tsc -b` + `tsc -p tsconfig.test.json` 两遍）。
- `pnpm lint`：0 warning / 0 error。
- `pnpm test`：17 个文件、322 个用例全部通过。
- `pnpm build`：通过；`lib/client.js` 90.17 kB，模块表 `require` 仅 `react` 与
  `react/jsx-runtime` 两项，未出现动态 import 或未声明 external。
