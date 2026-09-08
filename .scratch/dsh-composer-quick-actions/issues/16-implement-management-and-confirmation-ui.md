# 实现管理、动作面板与发送确认

Type: task
Mode: AFK
Status: resolved
Blocked by: 14, 15

## Question（问题）

实现集中式管理面板、B/C 共用的可搜索动作面板、自定义动作新建/编辑表单，以及发送确认面板。落实预置排序/隐藏/克隆、自定义 CRUD/启停、布局选择、1–4 emoji、验证限制、确认时重验、设置写入失败和 revision 冲突恢复。首版只有发送动作，表单**没有动作类型选择器**，也没有兼容性抑制相关的列表过滤或提示（spec 第 16 节）。

表单必须实时识别 Command Send Action（命令发送动作）：文本首个非空白字符变为 `/` 时给出**警示但不锁定任何控件**——说明该动作会按命令进入官方裁决路径、说明确认面板不会展示 DSH 原生 `/` 候选菜单、说明关闭确认后命令将一键提交且无预览。确认开关始终可编辑，表单不得因文本变化自行改写用户已设定的 `confirm`（spec 第 4.3、8.3 节）。确认面板在启用时必须在完整命令文本之外包含同一条无候选菜单说明（spec 第 9.3、16.2 节）。不得自制候选菜单。

使用 DSH UI primitives、主题 token、CSS module 与中英文 `locale`，保证键盘操作、焦点恢复、可见文本标签及可补充的 `aria-label`、宽窄布局和局部错误隔离；成功操作不得产生额外 toast。所有动作必须复用共享模型的校验；隐藏与停用动作计入总量，合计达到 50 时禁用新增和克隆，因预置升级或 Host Config 变化被动超限时保留全部动作、显示超限警告，并在恢复到 50 以内前持续禁用新增和克隆。基于 14 提供的结构化 Settings mutation outcome 实现写入拒绝与 conflict（重读后要求用户重确认）的精确 UX。确认面板与执行单飞共享票据 15 的每 Session 状态契约，不维护私有第二把锁。

## Comments（评论）

票据 15 已落地并交接以下内容，实施本票据时请在其上继续，不要重建：

- **执行与确认状态契约**：`src/client/session/execution.ts` 的每 Session 引擎发布
  `{ unavailable, confirming, sending, activeRef, feedback }`，并拥有单飞锁与最终重验。
  确认面板必须复用它（`activate` / `confirm` / `cancel`），**不得维护第二把锁**。
- **确认面板已存在**：`src/client/session/ConfirmPanel.tsx`，含命令发送动作的「无候选菜单」
  说明、Esc / 遮罩 / 取消三条无副作用取消路径与焦点返回。本票据只需按需打磨文案与模态语义。
- **可搜索动作面板仍属本票据**：`bar` 的「更多」与 `launcher` 入口当前打开的是
  `surfaces/QuickActionsSurface.tsx` 里的 `ActionList`——同一顺序的普通弹出列表，**没有搜索框**。
  本票据交付共享可搜索面板后，请把这两个入口改接过去并删除 `ActionList`。搜索字段、大小写与
  Unicode 归一化策略需由本票据统一定义并以测试固定（spec 第 8.1 节）。
- **词典**：`src/locales/index.ts` 已有 `QuickActionsLocaleKey` 联合与中英两份字典，新增键请
  同时补两种语言（缺键是编译错误）。
- **样式**：`src/styles/index.ts` 的 `dsh-cqa-` 前缀样式串 + `<style data-plugin-css>` 注入，
  只用 DSH alias 主题 token；新面板沿用同一机制，不引入 CSS Modules（理由见票据 15 `## Answer`）。
- **管理入口**：三种布局的「管理」按钮已调用 `controller.openManager()`，控制器的
  `manager.open` 即本票据面板的开合状态。

## Answer（答案）

已交付集中式管理面板、B/C 共用的可搜索动作面板与自定义动作表单。源码位于
`packages/composer-quick-actions/src/client/manager/{search.ts,press.ts,status.ts,ActionPanel.tsx,ActionForm.tsx,ManagedRow.tsx,ManagerPanel.tsx}`、
`src/client/modal.ts`、`src/client/surfaces/ActionFace.tsx` 与 `src/client/session/availability.ts`；
装配改动在 `src/client/{index.tsx,surfaces/{entries.tsx,QuickActionsSurface.tsx,residency.ts},session/ConfirmPanel.tsx}`，
词典与样式在 `src/locales/index.ts`、`src/styles/index.ts`；测试位于
`tests/client/{manager.spec.tsx,search.spec.ts,plugin.spec.ts}` 与 `tests/locales/dictionaries.spec.ts`。

### 1. 搜索字段、大小写与 Unicode 归一化策略（spec 第 8.1 节）

策略定义在 `manager/search.ts`，由 `tests/client/search.spec.ts` 逐条固定：

| 维度 | 策略 | 理由 |
|---|---|---|
| 字段 | 只匹配 `label` 与 `text` | 二者是用户写下、也读得到的内容；icon 按 spec 第 8.4 节只是装饰，不得充当可搜索名称；命令徽标由已被搜索的 `text` 派生 |
| 大小写 | `toLowerCase()` | Unicode 默认映射、与 locale 无关。**不用** `toLocaleLowerCase()`——它会让同一查询在土耳其语 `i` 上表现不同，随 UI 语言漂移的筛选无法用测试固定 |
| Unicode | NFKC | 折叠 CJK 输入法实际会产出的兼容形式（全角拉丁与全角标点），全角查询仍能命中半角文本 |
| 空白 | 每段连续空白折叠为一个空格，两侧同样处理 | 单行查询可以命中多行动作文本；空白定义用正则 `\s`，与 spec 第 4.3 节 `trim()` 的口径一致 |
| 匹配方式 | 逐字段子串匹配 | 不先拼接字段，否则查询会命中一个并不存在的边界 |
| 空查询 | 按原数组**身份**返回；是否为空查询由 `hasQuickActionQuery` 显式回答 | 未搜索不等于已筛选；返回副本会让每一行白白重挂 |

匹配项保持 `actionOrder` 的相对顺序，不按相关度重排（测试
「keeps the actionOrder relative order rather than ranking by relevance」固定）。刻意不用
`Intl.Collator`：collator 回答「是否相等」，而筛选框问的是「是否包含」。

### 2. 共享可搜索面板取代布局自带列表

`manager/ActionPanel.tsx` 同时服务 `bar` 的「更多」与 `launcher` 入口；票据 15 的
`QuickActionsSurface.tsx` 内部 `ActionList` **已删除**。两个入口共用同一组件、同一搜索行为与
同一键盘处理，测试「is the very same panel behind the bar layout's "more"」通过桩掉
`ResizeObserver` / `clientWidth` / `offsetWidth` 让 bar 真正溢出后断言。面板除 Esc、遮罩与入口
自身外另有可见的「关闭」控件——前三条都看不见，spec 第 8.4 节要求控件保留可见文本标签。

「暂不可用」的原因判定与动作的可见外观都不再各写一份：`session/availability.ts` 的
`unavailableReasonFor` 与 `surfaces/ActionFace.tsx`（图标 + 标签 + 命令徽标）由布局、面板与管理
列表共用，同一动作不可能在两处给出不同解释或不同标记。

### 3. 管理 overlay 的独立注册与单实例

spec 第 8.1 节要求「集中式管理 overlay 必须独立注册」，而首版没有 Session 之外的 Slot
（取证见 `research/composer-extension-seams.md` 第 2.4 节：`conversation.composer` chain 之外
没有可叠加 Slot）。因此 overlay 注册为 `conversation.input.dock` 的**第二个 cell**
（`id: 'composer-quick-actions-manager'`、`order: 101`），与布局条目分属两个 cell、两个错误边界；
一次 `ctx.slots.inject` 返回**两个 disposer 的 iterable**（`SlotInjectionEffect` 的公开形状），
两个 cell 共享同一声明生命周期。

overlay 是全局状态却由 session 作用域的 Slot 渲染，因此 `residency.ts` 新增
`primarySessionId()`：marks 是插入有序 Map，第一个仍在挂载的 Session 即为主会话，只有它渲染
overlay。两个常驻 Composer 同屏时不会叠出两个模态（测试「draws one overlay, not one per
Resident Composer」）。

### 4. 只有持续性只读用 `disabled`

自查发现一个真实键盘缺陷：写入进行中 `client.writing` 会禁用刚被按下的那个按钮，焦点掉回
`document.body`——键盘用户每移动一行都要从头 Tab 回来。规则因此收敛为一句话
（`manager/press.ts` 的 `pressProps` 与 `ManagerWriteGate`）：

- **`disabled`** 只用于持续、外部施加的不可用（命名空间不可写、连接无法为快照背书）——面板确实
  惰性，本就不该可 Tab；
- **`aria-disabled` + 守卫处理器** 用于其余一切，因为其余一切都可能**因这次按下本身**而成立：
  刚发起的写入、行到达列表两端、刚选中的布局变成当前布局、刚克隆填满最后一个名额。

例外是表单的「取消」：它不写入任何东西，因此永不禁用——否则离线时打开的草稿会无路可退。
测试「keeps the caret on the move control after a reorder lands」「offers no move beyond the ends
of the list, without dropping focus there」「lets an open form be backed out of while read-only」
固定该行为，并断言被阻断的控件按下后确实不写入。

### 5. 其余交付

- **管理面板范围（spec 第 8.3 节）**：预置排序/隐藏/恢复/克隆；自定义新建/编辑/启停/排序/删除；
  `ribbon`/`bar`/`launcher` 切换；标签、静态文本、可选 emoji、发送确认；表单校验、50 项上限、
  被动超限警告；只读 / 写入失败 / 断线 / revision 冲突状态；命令发送动作的识别标记与集中说明。
- **表单无动作类型选择器**（spec 第 4.1、16.1 节）：`kind` 不是配置项，测试
  「offers no action-type selector」断言表单内没有 `select`、只有两个文本输入与一个 checkbox。
- **命令发送动作只警示不锁定**：文本首个非空白字符变为 `/` 时即时给出三点警示（按命令进入官方
  裁决路径、确认面板不展示原生候选菜单、关闭确认后一键提交且无预览），并断言表单内所有
  `input/textarea/button` 的 `disabled` 仍为 `false`。**集中说明常驻**，不以「已经存在命令动作」
  为条件——它解释的是徽标的含义，用户写下第一条命令文本之前就需要它。
- **表单绝不改写 `confirm`**：默认只在 `newQuickActionDraft()` 与克隆计划里初始化。测试
  「never rewrites a confirmation the user has already set」先关闭确认、再把文本改成命令、
  最后落库断言 `confirm: false`。
- **校验一律复用共享模型**：`ActionForm` 直接调用 `validateQuickActionDraft`，唯一的表现层决定是
  「空白字段在用户首次保存前保持安静」。字段错误与限额提示并存显示——限额数字来自模型常量，
  错误句子不复述数字，避免出现第二份可漂移的副本。
- **数量上限与被动超限**：`counts.canAdd` 关闭新增与克隆，`counts.overflow` 显示保留全部数据的
  超限警告。测试覆盖 50 项恰好达限、隐藏/停用计入合计、50 预置 + 3 自定义 = 53 的无损被动超限，
  以及超限期间编辑/删除/隐藏/停用/排序仍然允许。
- **写入结果的分类 UX 与明确重试（spec 第 10 节）**：`rejected` 按 mutation 拒绝原因取键，
  `refused` / `conflict` / `failed` / `read-only` / `not-ready` 各有一句话；`conflict` 明确要求
  用户核对刷新后的权威状态并**重新确认**，表单内容原样保留。失败横幅带「重试」，经同一写入漏斗
  **重新制定计划**而非重放：控制器每次都基于当时持有的快照建计划，create 每次尝试重新生成
  Custom Action ID。表单重试按**当前**表单内容执行——用户在失败后改好字段，不能把旧草稿偷偷提交
  回去（测试「retries a form save with whatever the form holds now, not the failed draft」）。
  任何路径都不自动重试。
- **只读归因只讲只读**：目录尚未就绪时 `readOnly` 也为真（写入门禁返回 `not-ready`），若不加判别
  会在目录错误旁边再印一句「存储不可用」，把 spec 第 10 节刻意分开的两种首次读取失败混为一谈。
  `managerReadOnlyReason` 先按投影是否存在短路：没有目录就无所谓只读，目录提示本身就是全部信息。
- **顺序无需「恢复旧顺序」**：面板只渲染控制器发布的权威快照，UI 状态只在 Host 持久化后才前进，
  旧顺序从未被离开过。
- **成功不产生额外提示**（spec 第 9.5 节）：测试「reports no success of its own beyond the list
  itself」断言保存成功后既无 `role="alert"` 也无写入失败节点。
- **删除两步确认**：删除是这里唯一销毁用户数据的控件，因此在行内问一次，而不是再叠一个模态；
  「不删除」不写入，因此不受任何门禁限制。这是 spec 第 8.3 节「删除」之上的一点自定，取舍见下。
- **共享模态语义**：`client/modal.ts` 的 `useModalKeys` / `useFocusReturn` / `useInitialFocus`
  由动作面板、管理面板与确认面板共用。焦点集合每次按键重算（表单会长出来、Save 会在写入期间变化，
  缓存的边界会把焦点困在已经不存在的控件上），且**排除 disabled 控件**——票据 15 的确认面板原来
  用 `querySelectorAll('button')`，会把禁用按钮算进边界。`ConfirmPanel.tsx` 已改为复用同一实现。
  **Esc 只离开最内层**：表单拦截 Esc 关闭自己，面板保留；否则在字段里按 Esc 会连面板一起关掉。
- **可见文本标签**：每个控件都有可见文本标签；字段的 `<label htmlFor>` 只承载字段名，提示与错误
  经 `aria-describedby` 关联（包裹式 label 会把提示折进控件的可访问名称）。「管理」入口补了
  `title={t('manage.tooltip')}`——`title` 是可访问名称的兜底而非替代，可见标签仍然优先，因此不违反
  spec 第 8.4 节「`aria-label` 可补充但不得取代该可见标签」。
- **词典**：中英各补 60 余键；`issue.<field>.<reason>` 与 `write.<kind>` 两族由
  `quickActionsLocaleKey` 依据词典自身校验后取键，上游新增的原因会退回一句通用话而不是把
  `write.something-new` 漏到界面上。`tests/locales/dictionaries.spec.ts` 固定中英 key 集合相同、
  无空值、**插值参数一致**（丢掉 `{count}` / `{message}` 会静默丢掉句子里唯一承载状态的部分），
  并断言表单能产生的每个字段问题都有专属句子、不落到 `issue.invalid`。
- **确认面板与执行单飞**：完全复用票据 15 的每 Session 引擎（`activate` / `confirm` / `cancel`），
  **没有第二把锁**；本票据只统一了模态语义，未触碰执行契约。

### 已知边界与刻意的取舍

1. **沿用票据 15 的既有偏离**：仍未使用 `@deepseek-ai/dsh-client-ui-primitives`（Client bundle 只
   允许 `require` 构建适配器显式声明的 external），仍用 `dsh-cqa-` 前缀样式串 +
   `<style data-plugin-css>` 而非 CSS Modules（单文件 browser CJS 没有 CSS 管线）。理由与票据 15
   `## Answer` 第 3、4 条相同。
2. **管理 overlay 的遮罩不上色**：只用 DSH alias 主题 token，本轮取不到「模态遮罩」这一档 token，
   因此遮罩仅作点击捕获层、不绘制。若票据 18 在真实 GUI 中判定需要视觉遮罩，应先确认可用 token
   再补，不得自造颜色。
3. **`client/modal.ts` 是 spec 第 14 节源码边界之外的叶子模块**：确认面板（`session/`）、动作面板与
   管理面板（`manager/`）都需要同一套模态语义，放进其中任一目录都会让另一个目录为「既非动作也非
   执行」的东西反向依赖它。因此与 `client/dsh.ts` 同级放置，不归任何目录所有。
4. **删除的两步确认是 spec 第 8.3 节之外的自定**：spec 只列出「删除」。这里加一次行内确认，是因为
   它是本面板唯一不可撤销地销毁用户数据的控件；代价是两个额外词条与一段状态。若后续认为多余，
   删掉两个键与 `pendingDelete` 即可，不影响其余行为。
5. **管理 overlay 不随常驻判定失效而自动关闭**：`manager.open` 是全局状态，overlay 只是暂时无处
   渲染。这是刻意的——takeover 期间 renderer 会把两个 dock 一并隐藏，自动关闭会让一次审批提示
   吞掉用户正在填的表单。代价是离开会话再回来时面板仍然开着。
6. **真实 GUI 未验证**：本轮全部为受控 fake。三视口下 overlay 的实际观感、`base` 层读取、
   等宽 1 CSS px 与端到端发送仍归票据 18。
7. **`bar` 溢出测试依赖桩掉的测量环境**：jsdom 没有布局，`ResizeObserver` / `clientWidth` /
   `offsetWidth` 由测试临时提供并在结束时还原。真实宽度下的折叠点归票据 18。

### 独立审查

两轴独立审查（Standards / Spec）各出具报告，全部有效发现已在
`🐛 fix(client): 修正独立审查发现的管理面板缺陷` 中修复：只读归因、Esc 吞掉草稿、取消按钮被禁、
缺明确重试、集中说明的条件化、缺可见关闭控件；以及 `session/ConfirmPanel` 反向依赖 `manager/`
的边界违规、单一写入漏斗被绕过、术语丢失与三处重复。两轴均确认没有倒退任何「已闭合决策」。

### 新鲜验证（本轮）

- `pnpm typecheck`：通过（`tsc -b` + `tsc -p tsconfig.test.json` 两遍）。
- `pnpm lint`：0 warning / 0 error。
- `pnpm test`：20 个文件、394 个用例全部通过。
- `pnpm build`：通过；Host ESM 三个入口，Client `lib/client.js` 142.85 kB + sourcemap，
  模块表 `require` 仍只有 `react` 与 `react/jsx-runtime`。
