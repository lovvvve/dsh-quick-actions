# 采用 DSH UI primitives 的叶子控件

Type: task
Mode: AFK
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

### 验收

`pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm build` 全绿；票据 17 的打包契约测试仍绿；产物 `require` 恰为 `["react", "@deepseek-ai/dsh-client-ui-primitives", "react/jsx-runtime"]`；构建/安装证据按票据 17 建立的**追加式**约定写入 `verification/release-evidence.md`，不重写既有节。
