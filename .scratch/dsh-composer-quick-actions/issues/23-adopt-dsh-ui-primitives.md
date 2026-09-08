# 采用 DSH UI primitives 的叶子控件

Type: task
Mode: AFK
Status: resolved
Blocked by: 17

## Question（问题）

把 Client 界面里的**叶子控件**换成 `@deepseek-ai/dsh-client-ui-primitives` 的官方 primitive，落实 spec 第 8.4 节「使用 DSH UI primitives」这条此前未满足的硬要求。**三个面板容器保持现状，不改用 `Modal`**（决策见下）。

取证基础：[`research/client-ui-primitives-availability.md`](../research/client-ui-primitives-availability.md)。该调研推翻了票据 15/16 沿用的「primitives 不可用」前提——它无条件可从浏览器模块表 require，机制是 web shell 构建期内联后播种进冻结 seed 表，代价是一行 `external` 加一条 devDependency，且已有 5 个第三方插件先例。

### 范围内

- 叶子控件替换：`Button`（全仓 34 处 `<button>`，Composer 工具行用 `variant: 'toolbar'`）、`Input`（`manager/ActionPanel.tsx` 搜索框配 `IconSearchOutline16`、`manager/ActionForm.tsx`）、`Pill`（`.dsh-cqa-badge` / `.dsh-cqa-tag`）、`Toast`（`surfaces/QuickActionsSurface.tsx` 与 `surfaces/entries.tsx` 的瞬态反馈，`anchor` 可对齐 composer 卡片）、`projectUserText`、以及官方 `Icon*` 图标。
- `Tooltip` 仅作**补充**：spec 第 8.4 节要求控件保留可见文本标签，Tooltip 不得取代标签。
- 构建与 manifest：`tsdown.config.ts` 的 `dshClientBundle({ external: [...] })` 与 `package.json` 的 `dsh.client.external` **必须同时**加入 `@deepseek-ai/dsh-client-ui-primitives`——票据 17 的 `tests/release/packaging.spec.ts` 对 manifest 的 `dsh.client.external` 与产物 `require` 集合做**严格相等**断言，只改一边会红。`BROWSER_SEEDS` 常量已含该包，无需更新。
- devDependency **精确锁 `0.1.2-rc.1`**，只为类型；运行时靠 seed 表。**不得用 range**：`latest` dist-tag 停在 2026-08-10 的 `0.0.1-rc.1`，少 17 个导出（含 `Toast`、`projectUserText`、`useDismissOnOutsidePointer`、`useAnchoredPosition`）、多一个已删名 `ConnectionBanner`，且不发布任何 CSS。
- 无障碍不得退化：spec 第 8.4 节的可见文本标签、清晰焦点样式、键盘遍历、焦点返回与 WCAG AA 对比度全部保持。

### 范围外（已决策，不得在本票据重开）

- **三个面板容器不改用 `Modal`**。`Modal` 是 `createPortal(..., document.body)` 的居中对话框，而 `ConfirmPanel` 与 `ActionPanel`（bar 的「更多」、launcher 入口）是**锚定 popover** 语义——换成居中对话框是 UX 回退，不只是视觉基线刷新；且 `Modal` 强制 `title`，锚定小面板只能上 `headless: true`，等于几乎不使用它。`ManagerPanel` 是三者中唯一有收益的（它现在被 composer stack 的宽度约束着，语义上本该是 body portal），但票据 16 刚交付并通过独立审查，现在改容器会让那次审查作废，且 spec 第 13.3 节的三布局 × 桌面/768/360 视觉基线要重做——**记为票据 18 拿到实机基线之后的候选**。
- **`src/client/modal.ts` 的三个 hook 必须保留**，与是否采用 `Modal` 无关：`Modal` 不做焦点陷阱、初始焦点、关闭后焦点返回，也不 `stopPropagation` Escape，而 spec 第 8.4 节把焦点返回写成硬门槛。primitives 里**没有任何焦点陷阱导出**。
- **CSS Modules 不在本票据**。`src/styles/index.ts` 仍是带前缀的样式字符串，这是与 primitives **独立**的第二处 spec 第 8.4 节偏离；要真做需给构建适配器装 `@tsdown/css` 并改动 `tests/bundle.spec.ts` 固定的契约。该项与票据 22 争用 `tools/dsh-client-bundle/{src/index.ts,tests/bundle.spec.ts}`，须由用户决定是单开票据、并入票据 22，还是明确接受该偏离。
- primitives 的 CSS 由 shell 构建期编入 `dist/assets/index-*.css`，运行时不注入 `<style>`，因此本票据**不动任何 CSS 管线**。

### 开工后据真实签名修正的三点

读 `0.1.2-rc.1` 的 `lib/types/*.d.ts` 后，票据草稿里的两项被排除、一项做法被改：

1. **`Toast` 排除**。真实签名是 `{ text, icon?, anchor?, holdMs?, onDone }` 的**自动淡出 body portal 顶部横幅**，不是控件。我们的 `.dsh-cqa-note role="status"` 是**持续显示到用户关闭或被下一次覆盖**（执行引擎的 `feedback` + `dismissFeedback` 契约），而且目录错误那条还**带重试按钮**——横幅装不下动作。换成 Toast 是行为变更而非叶子替换，属票据 23 范围外的容器决策。DSH 自己的 `InputBar` 用 Toast 承载 notice，若日后要对齐，另开票据。
2. **`projectUserText` 排除**。它把用户文本投影成带 session 标签 chip 的节点。确认面板必须**逐字**展示待发送文本（spec 第 9.3 节：「你看到的就是最终提交内容」），投影会改变外观，与该承诺冲突。
3. **primitives 全库没有 `forwardRef`**（`lib/index.js` 零命中），所以 `Button` / `Input` / `Pill` 都不能接 `ref`。本项目有 6 处 ref 站点，全部是焦点管理或宽度测量。做法改为：这些站点加 `data-*` 标记，由已有的容器 ref 用 `querySelector` 取到。**不保留原生控件混用**——`Button size: 'sm'` 是 28px 胶囊、`.dsh-cqa-entry` 是 26px，两者并排会有可见差异。宽度测量顺带简化：由父容器一次读取全部子按钮的 `offsetWidth`，不再把 `measure` 回调逐层传下去。

### 验收

`pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm build` 全绿；票据 17 的打包契约测试仍绿；产物 `require` 恰为 `["react", "@deepseek-ai/dsh-client-ui-primitives", "react/jsx-runtime"]`；构建/安装证据按票据 17 建立的**追加式**约定写入 `verification/release-evidence.md`，不重写既有节。

## Answer（答案）

已把 Client 界面的叶子控件换成官方 primitive，spec 第 8.4 节「使用 DSH UI primitives」这条此前未满足的要求现在由实际依赖满足。三个面板容器按决策保持原样。

### 落地内容

| 项 | 换成 | 站点 |
|---|---|---|
| 胶囊按钮 | `Button variant="toolbar" size="sm"` | 共 19 处：`surfaces/QuickActionsSurface.tsx`（动作控件、管理入口、launcher/更多 入口）、`session/ConfirmPanel.tsx`（取消/发送）、`manager/ActionForm.tsx`（取消/保存）、`manager/ManagedRow.tsx`（9 个行内操作）、`manager/ManagerPanel.tsx`（3 个） |
| 信息 chip | `Pill` | `surfaces/ActionFace.tsx` 的命令标记、`manager/ManagedRow.tsx` 的来源/状态/克隆三个标签（隐藏态改用 `Pill` 自己的 `active`，替掉一个从未被查询的 `data-quick-actions-state` 死属性；行级 `data-quick-action-hidden` 仍是查询钩子） |
| 搜索框 | `Input` + `IconSearchOutline16` | `manager/ActionPanel.tsx` |
| 构建与 manifest | `tsdown.config.ts` 的 `external` 与 `package.json` 的 `dsh.client.external` **同时**加入该包 | 产物 `require` 集合现为 `["react", "@deepseek-ai/dsh-client-ui-primitives", "react/jsx-runtime"]`，与 manifest 严格相等（票据 17 的 `tests/release/packaging.spec.ts` 断言） |
| 依赖 | devDependency **精确锁** `0.1.2-rc.1`（无 `^`） | 只为类型；运行时靠 web shell 的冻结 seed 表 |

### 保留原生的四类，及理由

primitives 对这四类没有对应导出，强行替代会退化：

1. **文本链接** `.dsh-cqa-link`（`ErrorBoundary`、`entries` 的目录重试、`ManagerPanel` 的写入重试、`ActionPanel` 的关闭）——`Button` 是胶囊，链接不是。
2. **面板列表行** `.dsh-cqa-panel-item`——全宽左对齐行，胶囊化会破坏列表。
3. **表单的 `textarea` 与 checkbox**——primitives 只有 `Input`（文本框），没有 textarea 也没有 checkbox。若只把同组的两个文本框换成 `Input`，会与紧邻的原生 `textarea` 产生可见不一致，因此**整组保留自绘**；`Input` 只用在独立存在的搜索框上。
4. **`aria-disabled` 态**——`Button` 只认 `:disabled`，而写入进行中要保持可聚焦却读作 inert，这条 CSS 规则留下。

### 三处必须记住的技术事实

1. **primitives 全库没有 `forwardRef`**（`lib/index.js` 零命中），`Button` / `Input` / `Pill` 都不能接 `ref`。本项目原有 6 个 ref 站点全是焦点管理或宽度测量，处置：
   - `modal.ts` 新增 `useInitialFocusIn(container, selector)`，用标记属性寻址开场焦点——与 Tab 边界已有的 `querySelectorAll` 寻址方式一致，把这条限制**收在一个模块里**，而不是让每个面板退回原生控件；
   - `QuickActionsSurface` 的宽度测量改为父容器一次扫描 `[data-quick-action]` 读 `offsetWidth`，比原先逐层传 `measure` 回调更简单；焦点目标改由 `data-*` 标记从行容器取。
   - **静态 `Pill`（无 `onClick`）不透传 `...rest`**，只接 `className` + `children`，所以它承载不了 `data-*`。
2. **`Input` 把传入的 `className` 放在包裹 `<span>` 上**，不是 `<input>` 上。原先 `.dsh-cqa-input` 带 border/padding，套上去会与 primitive 自己的边框叠成两层；搜索框因此改用只管布局的 `.dsh-cqa-search`。
3. **测试侧也需要 CSS 处理**，与构建侧的 `@tsdown/css` 是两件独立的事。primitives 的裸 ESM 里 `import './X.module.css'`，vitest 默认外部化 `node_modules`，Node 的 ESM loader 直接拒绝 `.css` 扩展，4 个测试文件在 import 阶段就挂。`vitest.config.ts` 加 `test.server.deps.inline: ['@deepseek-ai/dsh-client-ui-primitives']` 让 Vite 接管该转换即可——这些用例断言 role / 名称 / 行为，不断言计算样式。

### 样式裁剪

`src/styles/index.ts` 删掉了与 primitive 重复的全部声明（胶囊的 height/radius/padding/背景/hover/`:disabled`/焦点环、chip 的 padding/radius/配色）。**插件的类名在 `clsx` 里排在 primitive 之后**，同特异度下会覆盖它——留着就等于白换。保留的只有 primitive 无法知道的部分：flex 行为、长标签的 `max-width: 240px` 截断、`aria-disabled` 态、以及仍为原生的列表行与链接的焦点环。已核验：无死选择器、无未定义类名。

已知取舍：命令标记与来源标签现在都是默认 `Pill`，失去了原先的配色区分，靠文案区分（「命令」vs「预置」/「自定义」）。

### 独立审查发现并已修的三条

1. **焦点环被误删**（spec 第 8.4 节硬门槛）。我在样式注释里断言「焦点环归官方 `Button`」，**这是错的**：`Button.module.css` 与 `Pill.module.css` 的 `focus` 规则数为 **0**——该库不集中管焦点，需要环的组件各自定义（`Input.module.css` 用 `:focus-within`，`HoverCard` / `JsonTree` / `ConnectionIndicator` / `RiskConfirmation` 各有自己的）。删掉后，确认面板打开时 `useInitialFocusIn` 把焦点移到「发送」，用户看不出哪个按钮已就位；整条动作行与约 20 个管理行控件同样失去指示。已恢复 `.dsh-cqa-action:focus-visible, .dsh-cqa-entry:focus-visible`，并改正注释。
2. **`.dsh-cqa-search { width: 100% }` 会溢出容器约 17px**。`Input` 把 `className` 放在包裹 `<span>` 上，而 `Input.module.css` 的 `.wrap` 有 `padding: 0 8px` + `border: 0.5px` 且**没有 `box-sizing`**；本样式表也没有全局 border-box reset（它在 6 处显式声明）。而且这条声明本就不必要：`.dsh-cqa-field` 是 `flex-direction: column`，默认 `align-items: stretch` 已经撑满。已删掉该类与该 className。同类小疏漏：`.dsh-cqa-action, .dsh-cqa-entry` 丢了 `box-sizing: border-box`，使 `max-width: 240px` 变成内容盒上限（实际约 260px），已补回。
3. **运行时 external 却只有 devDependency**。票据 17 已确立的策略是每个运行时 external 都进 `peerDependencies`（`@deepseek-ai/dsh-*` 一律 `>=0.1.2-rc.1`，react `^18.3.1`），而 primitives 现在是 external（产物 `require` 它）却没有 peer 条目——打出的 tarball 对自己 bundle 所 require 的模块不声明任何要求，装进 seed 不同的 shell 会在插件加载时抛无法解析的 `require`，解析期毫无警告。已加 `>=0.1.2-rc.1` peer（devDependency 仍精确锁 `0.1.2-rc.1` 供类型）。原有 peer 断言只覆盖 `SERVICE_PROVIDERS` / `CTX_GET_PROVIDERS` / `react`，抓不到它，故在 `tests/release/packaging.spec.ts` 补一条契约：`dsh.client.external` 里每个 `@deepseek-ai/*` 都必须是 peer（`react/jsx-runtime` 这类子路径经自身包解析，不计）。**已负向验证**：临时删掉该 peer，新断言变红。

### 交给后续票据的一条（不属本票据）

`prepack` → `build` → `rmSync('lib')`，而 `tests/release/packaging.spec.ts` 在**真实包目录**执行 `pnpm pack`，所以 `pnpm test` 会删掉并重建线上的 `lib/client.js`。票据 18 的验证回路要一边 `pnpm watch:client` 对着 `127.0.0.1:3080`、一边跑测试，届时页面可能载入缺失或写了一半的 bundle，还会与 watcher 的写入竞争。`rmSync` 本身是对的（票据 17 修的是孤立声明随包发布），只是不该在 watch/GUI 所服务的工作树里跑——打包到临时副本，或把破坏性清理拆成单独脚本。属票据 17 的发布契约，须另开票据或并入票据 22。

### 新鲜验证

- `pnpm typecheck` 通过（两遍）；`pnpm lint` 0 warning / 0 error。
- `pnpm test`：22 文件 / **477 用例全过**，含票据 17 的打包与文档契约。
- 清空 `lib/` 后 `pnpm build` 通过；`lib/client.js` 145 kB，模块表 `require` 恰为上述三项；`shiki` / `lexical` / `clsx` 等 primitives 的传递依赖**零泄漏**。
- 未做真实 GUI 实测：primitives 的样式由 web shell 的 `dist/assets/index-*.css` 提供，本地无从加载，实机外观归票据 18。
