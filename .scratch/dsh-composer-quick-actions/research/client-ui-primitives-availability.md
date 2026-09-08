# `@deepseek-ai/dsh-client-ui-primitives` 的可 require 性与导出面核实

本文件回答 [spec 第 8.4 节](../spec.md)的硬性要求「使用 DSH UI primitives、主题 token、CSS Modules 和 `locale`」在当前已发布 DSH 上究竟**能不能满足**，以及票据 15/16 交付的 Client 界面全部手写控件这一偏离是**可永久接受**还是**必须在票据 18 验收前重构**。

## 范围与来源依据

只使用一手来源，全部为本机可核实的产物：

| 来源 | 位置 | 用途 |
|---|---|---|
| 已发布 tarball `0.1.2-rc.1` | `npm pack` 取回，解包到 `$CLAUDE_JOB_DIR/tmp/prim/package/`（79 文件，156 KB） | 导出面、`.d.ts`、`files`/`exports`/`peerDependencies`、CSS |
| 已发布 tarball `0.0.1-rc.1` | 同上，`$CLAUDE_JOB_DIR/tmp/old/package/` | `latest` dist-tag 指向物的对比 |
| 本机 DSH `0.1.2-rc.1` 安装 | `/home/yulong/.npm/_npx/b86ed90107c62dab/node_modules/@deepseek-ai/` | 模块系统实现、第一方 bundle 的 `require`、web 前端 shell 产物 |
| 实机 web profile | `~/.dsh/profiles/web/`（`package.json#dsh.profile.bundles`） | 第三方插件的既有用法 |
| 本仓库构建适配器 | `/home/yulong/dsh-quick-actions/tools/dsh-client-bundle/src/index.ts` | AST 边界门禁影响面 |
| 隔离实测 harness | `$CLAUDE_JOB_DIR/tmp/tc`（tsc）、`$CLAUDE_JOB_DIR/tmp/bundle`、`$CLAUDE_JOB_DIR/tmp/bundle-inline`（tsdown） | 类型解析与构建可行性的正/反向实测 |

未使用 Web 检索、二手文章或运行时 Client Inspect。本机 GUI（`http://127.0.0.1:3080`）未访问。

术语标注：**已核实** = 本地产物或本地实测直接证明；**推断** = 从已核实事实做的确定性推理，未直接观测；**待票据 18** = 只能在有活动 GUI 页面的前台会话确证。

## 核心结论

| 子问题 | 结论 |
|---|---|
| **1. 可 require 性** | **可以 require，但机制不是自注册 bundle。** 已发布 tarball 的 `lib/index.js` 是裸 ESM（`import css from "./StateDot.module.css"`），**没有** `window.__ModuleLoader__.load(...)` 包装。模块表条目由 web 前端 shell 以 **staticModule / seed 表**（`PLATFORM_MODULES`）形式提供，键名 `"@deepseek-ai/dsh-client-ui-primitives"` 与包名逐字一致。**已核实** |
| **2. 它自己的 external** | **零个。** seed 表条目是 shell 构建期就求值完成的冻结命名空间对象（`Object.freeze(...)`），运行时不发起任何 `require`；React 与它共享 shell 的同一实例。**已核实** |
| **3. 导出清单** | **114 个导出**，与模块表命名空间**逐键完全一致**（差集为空）。含 `Modal`、`Button`、`Tooltip`、`Toast`、`Menu`、`RiskConfirmation`、`Input`、`Pill`、`HoverCard`、`DisclosureRow`、`StateDot`、`projectUserText`、`useDismissOnOutsidePointer`、`useAnchoredPosition`、`useAnchoredMaxHeight`、`writeClipboard`、`relativeTime`、76 个 `Icon*` 图标，以及 markdown/JSON/工具卡片一族。**没有任何焦点陷阱（focus trap）primitive**，`Modal` 自身也不做焦点陷阱、初始焦点或焦点返回。**已核实** |
| **4. 是否真在 web profile 模块图里** | **是，且是无条件的。** 它不是「某个第一方 bundle 恰好带进来」的可选行，而是 shell 自身烘进的 seed 表键 —— 只要 web 前端在跑就一定存在。本 profile 里已有 **5 个第三方插件**在用它。**已核实** |
| **5. 类型可用性** | tarball 发布 `lib/types/**/*.d.ts`（`files` 明确列出）。**只加 devDependency 用于类型、运行时靠模块表，正是第一方与第三方的既有做法**（5/5 第三方插件都只放 devDependency 或 peerDependency）。仓库 tsconfig 原样配置下隔离实测 `tsc` 退出码 0，负向测试确认类型是真类型而非 `any`。**已核实** |
| **6. 样式** | **不需要动任何 CSS 管线。** primitives 的 CSS Modules 在 shell 构建期就编译进 `dist/assets/index-b24khbeK.css`，由 `index.html` 以 `<link rel="stylesheet">` 加载。它**不**在运行时注入 `<style data-plugin-css>`。**已核实** |
| **7. 构建适配器影响** | **加入 `external` 即可，无障碍。** 隔离实测：AST 门禁四条（间接 require / 计算型 require / 动态 import / 未声明 external）全部通过，产出的 `require("@deepseek-ai/dsh-client-ui-primitives")` 与第一方 bundle 形状逐字相同，假 ModuleLoader 验证 requires 恰为 `["react","@deepseek-ai/dsh-client-ui-primitives","react/jsx-runtime"]`。反向实测：**不**加入 external（即尝试内联）会因 tsdown CSS guard 报 24 个错误直接失败。**已核实** |
| **8. 版本一致性** | `latest` = `0.0.1-rc.1` 是 **2026-08-10 的首次发布，此后 dist-tag 从未推进**（后续 17 个版本全部走 `next` / `alpha`），既非占位也非抢注，而是一个陈旧但完整的真实构建。它比 `0.1.2-rc.1` 少 17 个导出（`Toast`、`projectUserText`、`useDismissOnOutsidePointer`、`useAnchoredPosition`、`ReferenceIcon`、`ConnectionIndicator` 等）、多一个已删名 `ConnectionBanner`，且不发布任何 CSS。**必须精确锁 `0.1.2-rc.1`**。**已核实** |

**综合判断**：spec 第 8.4 节的 primitives 要求**在当前已发布 DSH 上完全可满足**，代价极小（一行 `external` + 一条 devDependency），且已有 5 个第三方插件先例。因此「继续手写控件」不能以「primitives 不可用」为理由；见[第 9 节](#9-可执行建议)的分项建议。

---

## 1. 可 require 性：机制不是自注册，而是 seed 表

### 1.1 已发布 tarball 不是 DSH client bundle

`0.1.2-rc.1` 的 `lib/index.js` 开头是裸 ESM import：

```js
// $CLAUDE_JOB_DIR/tmp/prim/package/lib/index.js:1-8
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import clsx from "clsx";
import css from "./StateDot.module.css";
import css$1 from "./DisclosureRow.module.css";
...
import { createPortal } from "react-dom";
```

结尾是裸 ESM `export { ... }`（114 个名字），全文**没有** `window.__ModuleLoader__` 字样。`package.json` 也**没有** `dsh.client` 声明，`exports` 只有 `.` / `./src/*` / `./package.json`，**没有** `./client` 子路径：

```json
// $CLAUDE_JOB_DIR/tmp/prim/package/package.json
"type": "module",
"main": "lib/index.js",
"types": "lib/types/index.d.ts",
"exports": { ".": { "types": "./lib/types/index.d.ts", "default": "./lib/index.js" },
             "./src/*": "./src/*", "./package.json": "./package.json" },
"files": ["lib/index.js", "lib/**/*.css", "lib/types/**/*.d.ts"]
```

按 `@deepseek-ai/dsh-client-modules` 的 Host 侧扫描规则，**没有 `dsh.client` 声明的包一律被跳过**，不会成为 boot graph 的一行（`dsh-client-modules/lib/index.js:629-633`：`decl === undefined || decl.platform !== 'web'` → `pkgMeta.set(sourceKey, null)`）。所以它**不可能**、也**不需要**成为一个动态 bundle 行。

> 附注：`exports["./src/*"]` 在已发布 tarball 里是坏的 —— `files` 不含 `src/`。`lib/index.js` 末尾的 `//# sourceMappingURL=index.js.map` 同样指向未发布的文件。二者都无实害（我们不消费源码，也不消费它的 map）。**已核实**

### 1.2 模块表条目由 shell 的 staticModules 提供

`@deepseek-ai/dsh-client-modules/README.md:40` 逐字给出契约：

> The shell seeds a frozen module table (`PLATFORM_MODULES`: React, Cordis, and static UI libraries); every dynamic bundle resolves its externals against exactly that baseline. `dsh.client.external` adds only exact non-baseline requests, each answered by the dynamic package row it names or **an exact static-table key**.

那张表在 web 前端 shell 产物里，逐字如下（`@deepseek-ai/dsh-web-frontend/dist/assets/index-Df-65__b.js:107`）：

```js
function zp(){return{
  react:q5, "react/jsx-runtime":Y5, "react-dom":n6, "react-dom/client":o6,
  "@deepseek-ai/cordis":M5, "@deepseek-ai/dsh-client-store":M6,
  "@deepseek-ai/dsh-client-ui-slots":T6,
  "@deepseek-ai/dsh-client-ui-primitives":Fp}}
```

同一行随后把它交给模块系统：

```js
this.modules = i.create({ boot: n.__DSH_BOOT__, staticModules: zp(), ... })
```

而 `Fp` 就是 primitives 的整个命名空间（同行）：

```js
const Fp=Object.freeze(Object.defineProperty({__proto__:null,
  BrandWordmark:Dd, Button:$l, CodeBlock:qu, ... projectUserText:$d,
  relativeTime:Zd, useAnchoredMaxHeight:Nd, useAnchoredPosition:Pd,
  useDismissOnOutsidePointer:bd, writeClipboard:_1}, Symbol.toStringTag,{value:"Module"}));
```

浏览器侧把这张表原样存为 `seed`，并在 `require` 时**第一优先**命中它：

```js
// dsh-client-modules/lib/client.js:205
this.seed = new Map(Object.entries(options.staticModules));

// dsh-client-modules/lib/client.js:300-309
makeRequire(edges) {
  return (spec) => {
    edges.add(spec);
    if (this.seed.has(spec)) return this.seed.get(spec);   // ← seed 优先
    const id = stripClientSuffix(spec);
    ...
    throw new Error(`client-modules: require("${spec}") missed the module table — ...`);
  };
}
```

**结论**：模块表 id 与包名逐字一致（`"@deepseek-ai/dsh-client-ui-primitives"`），`require(该字符串)` 在 seed 命中，**同步返回、无需等待任何 bundle 到达**。**已核实**

### 1.3 命名空间与 tarball 导出面逐键一致

为排除「shell 里烘的是另一个版本」的风险，程序化对比了三方：

| 集合 | 键数 | 差集 |
|---|---|---|
| shell 的 `Fp` 命名空间 | 114 | 与 `0.1.2-rc.1` 差集 **双向为空** |
| tarball `0.1.2-rc.1` 导出 | 114 | — |
| tarball `0.0.1-rc.1` 导出 | 98 | 见[第 8 节](#8-版本一致性latest-是陈旧-tag必须锁-012-rc1) |

即：**已发布 `0.1.2-rc.1` 的 `.d.ts` 精确描述了运行中模块表提供的东西**，不存在类型面比运行时宽或窄的风险。**已核实**

---

## 2. 它自己的 external：零

seed 表条目在 shell 构建期（Vite）就已完成求值与依赖内联 —— `clsx`、`shiki`、`katex`、`micromark-*`、`mdast-util-*` 全部进了 shell 的 `vendor-*.js` / `index-*.js`，`react` / `react-dom` 与 shell 共用同一实例（同一 bundle 内的 `q5` / `n6`）。因此运行时它**不发起任何 `require`**，也不可能引入第二份 React。**已核实**

对比而言，若我们把 tarball 内联进自己的 bundle，它的 external 面就是 tarball ESM 头部那一整串（`react`、`react/jsx-runtime`、`react-dom`、`clsx`、`shiki/core`、`shiki/engine/javascript`、`@shikijs/langs/*`、`katex`、`katex/dist/katex.min.css`、`mdast-util-*`、`micromark-*`，外加 25 个 `*.module.css`）。这条路已被实测否决，见[第 7 节](#7-对构建适配器的影响)。

---

## 3. 导出清单与对本项目手写控件的替代关系

类型入口 `lib/types/index.d.ts` 完整列出导出（含 `export * from './icons/index.tsx'` 的 76 个图标 + `IconProps`）。以下只摘录**本项目实际需要**的部分，签名逐字取自 tarball 的 `.d.ts`。

### 3.1 模态 / 对话框

```ts
// lib/types/Modal.d.ts
interface ModalBaseProps {
  open: boolean; onClose: () => void; title: string;
  description?: string; children?: ReactNode; footer?: ReactNode;
  className?: string; contentClassName?: string;
}
type ModalProps = ModalBaseProps
  & ({ headless: true; closeLabel?: never } | { headless?: false; closeLabel: string })
export declare function Modal(props: ModalProps): import("react").ReactPortal | null
```

实现（`lib/index.js` 的 `#region lib/types/Modal.js`）提供的**全部**语义是：

- `createPortal(..., document.body)`；
- 外层 `role="presentation"`，卡片 `role="dialog" aria-modal="true" aria-label={title}`；
- `document` 级 `keydown` 监听，`Escape` → `onClose()`；
- 遮罩 `aria-hidden="true"` + `onClick={onClose}`；
- 非 headless 时自带 header（`<h2>` 标题 + `aria-label={closeLabel}` 的关闭按钮，图标为 `IconCloseOutline16`）、可选 description、body、footer。

**它不做**：焦点陷阱、初始焦点、关闭后焦点返回、`Escape` 的 `stopPropagation`。

### 3.2 其余相关 primitive

| 导出 | 签名要点 | 可替代本项目的什么 |
|---|---|---|
| `Button` | `{ variant?: 'primary'\|'ghost'\|'outline'\|'toolbar'; size?: 'md'\|'sm'; icon?: ReactNode } & ButtonHTMLAttributes` | `surfaces/ActionFace.tsx`、`surfaces/QuickActionsSurface.tsx`、`manager/ManagedRow.tsx`、`manager/ManagerPanel.tsx`、`session/ConfirmPanel.tsx` 里所有 `<button className="dsh-cqa-entry">`（全仓共 34 处 `<button`）；`variant: 'toolbar'` 正是 Composer 工具行的官方变体 |
| `Pill` | `{ active?: boolean } & ButtonHTMLAttributes`；有 `onClick` 时渲染 `<button>`，否则 `<span>` | `.dsh-cqa-badge` / `.dsh-cqa-tag`（launcher 的动作计数、命令标记） |
| `Input` | `{ icon?: ReactNode } & InputHTMLAttributes` | `manager/ActionPanel.tsx` 的搜索框（配 `IconSearchOutline16`）、`manager/ActionForm.tsx` 的 `.dsh-cqa-input` |
| `Tooltip` | `{ label: string \| (() => string); side?: 'right'\|'bottom'\|'top'; delayMs?; disabled?; maxWidth?; children: ReactElement }` | 紧凑布局下按钮的补充说明（注意 spec 8.4 要求可见文本标签，Tooltip 只能是补充） |
| `Toast` | `{ text: string; icon?: ReactNode; anchor?: HTMLElement\|null; holdMs?: number; onDone: () => void }`；portal 到 body，`role="alert"`；`anchor` 可让横幅对齐 composer 卡片中心 | `surfaces/QuickActionsSurface.tsx:275` 与 `surfaces/entries.tsx:178` 的 `.dsh-cqa-note role="status"` 瞬态反馈 |
| `Menu` | `{ open; anchor; items: readonly MenuEntry[]; footer?; selectedId?; selectedIds?; onSelect; onClose; align?; side?; portal?; closeOnPointerLeave?; dense?; compact?; getAnchorRect?; className? }`；`role="menu"`/`menuitem`，`Escape` 关闭，支持 `submenu`、分隔线、标题行 | spec 8.1 布局 B 的「更多」溢出菜单；`portal` + `getAnchorRect` 正是为「祖先 overflow 裁剪」设计的。**注意**：`Menu` 只有 `Escape`，**没有**方向键 roving focus（仓内唯一有 roving 的是 `JsonTree`），键盘遍历靠原生 tab order |
| `RiskConfirmation` | `{ open; title; description; acknowledgeLabel; cancelLabel; closeLabel; confirmLabel; acknowledged; disabled?; onAcknowledgedChange; onCancel; onConfirm }` | **不适合**直接替代 `ConfirmPanel`：它是**页内**块（无 portal、无 `role="dialog"`、无 `Escape`），且强制一个「勾选确认框才解锁主操作」的 checkbox 门槛 —— spec 9.3 的发送确认没有该门槛 |
| `HoverCard` | `{ anchor; content; openDelayMs?; disabled?; copyText?; copyLabel; copiedLabel }` | 可用于「悬停预览完整发送文本」，非必需 |
| `DisclosureRow` / `StateDot` / `ConnectionIndicator` | 折叠行 / 四态点 / 连接态指示 | `ConnectionIndicator` 可用于第 10 节的断线只读态提示 |
| `useDismissOnOutsidePointer` | `(root: RefObject<HTMLElement\|null>, open: boolean, setOpen: (open: boolean) => void, portal?: RefObject<HTMLElement\|null>) => void` | `session/ConfirmPanel.tsx:38-43` 与 `.dsh-cqa-manager-backdrop` 的「点击外部取消」自制 backdrop |
| `useAnchoredPosition` | `({ open, anchorRef, panelRef, side?, gap, margin }) => CSSProperties \| null` | launcher 面板与溢出菜单的定位（滚动/resize 跟随、视口夹取） |
| `useAnchoredMaxHeight` | `(ref, cap, signal) => number` | `.dsh-cqa-scroll` 的高度夹取（随 composer 增高重新测量） |
| `projectUserText` | `(text: string, sessionLabels: readonly string[]) => ReactNode` | `session/ConfirmPanel.tsx:54` 的 `.dsh-cqa-confirm-text`：把 `@[label](dsh-session:...)` / `/name` / `@name` 折成与官方气泡**一致**的行内引用片；这是目前手写实现完全没有的能力 |
| `writeClipboard` / `relativeTime` | 剪贴板写入 / 相对时间 | 首版不需要 |
| 76 个 `Icon*`（`{ size?: number; className?: string }`，`fill="currentColor"`） | `IconSendOutline16`/`14`、`IconTrashOutline16`、`IconEditOutline16`、`IconPlusOutline16`、`IconSearchOutline16`、`IconSettingsOutline16`/`14`、`IconWarningOutline16`、`IconCloseOutline16`、`IconEllipsisOutline16`、`IconCheckOutline16`、`IconChevronUp/Down/Left/RightOutline14`、`IconLoadingOutline16`、`IconRefreshOutline16` … | 目前 `.dsh-cqa-icon` 只承载用户 emoji；管理面板的删除/编辑/新建/搜索/警示/关闭/溢出图标全部有官方对应物 |

### 3.3 明确缺失：焦点陷阱

**导出面里没有任何焦点陷阱 / 焦点管理 primitive**（`grep` 全产物：无 `inert`、无 `focus-trap`/`focusTrap`；`.focus()` 只出现在 `JsonTree` 的 `role="tree"` roving 与 `Menu`/`Tooltip` 的内部行为里）。因此：

- 本项目 `src/client/modal.ts` 的三个 hook（`useModalKeys` 的 Tab 边界 + `Escape` `stopPropagation`、`useFocusReturn`、`useInitialFocus`）**没有 primitive 替代品，改用 `Modal` 后仍必须保留**；
- spec 8.4「管理、动作和确认面板必须沿用 DSH primitive 的标准模态语义与焦点管理」在字面上只能理解为**沿用 `Modal` 提供的那一套**（portal + `role="dialog"`/`aria-modal`/`aria-label` + `Escape` + 遮罩点击），而同节另一条硬门槛「面板关闭后的焦点返回」仍归插件自己实现。**推断**（依据是 `Modal` 实现里确实没有这些代码）。

---

## 4. 它确实在 web profile 的模块图里 —— 且是无条件的

### 4.1 决定性证据：它是 shell 的构建期依赖，不是 profile 里的运行时包

`@deepseek-ai/dsh-client-ui-primitives`、`@deepseek-ai/dsh-client-ui-slots`、`@deepseek-ai/dsh-client-store` **三个包在本机 `node_modules` 里都不存在**（`ls` 均 `No such file or directory`），因为它们只作为 web 前端 shell 的 **devDependency** 在构建期被内联：

```json
// @deepseek-ai/dsh-web-frontend/package.json:41-45（devDependencies）
"@deepseek-ai/dsh-client-modules": "^0.1.2-rc.1",
"@deepseek-ai/dsh-client-web": "^0.1.2-rc.1",
"@deepseek-ai/dsh-client-ui-slots": "^0.1.2-rc.1",
"@deepseek-ai/dsh-client-store": "^0.1.2-rc.1",
"@deepseek-ai/dsh-client-ui-primitives": "^0.1.2-rc.1",
```

`dsh-web-frontend` 只发布 `dist`（`files: ["dist", "!dist/**/*.map", ...]`），且**没有 `dependencies` 字段**。

这正好解释了任务书里那个观察 —— 「本机 `node_modules/@deepseek-ai/` 下这个包没有安装，但很多第一方 bundle 都 `require` 它」：因为 `require` 命中的是 seed 表，不是磁盘。

因此判断不是「第一方 bundle 依赖它 ⇒ 它大概在表里」这种间接推理，而是：**只要 web 前端 shell 在跑，seed 表里就一定有这个键**。它不随任何 profile bundle 的增删而消失。**已核实**

### 4.2 第一方 `require` 的确切位置

全部形如同一行（下列均在 `/home/yulong/.npm/_npx/b86ed90107c62dab/node_modules/@deepseek-ai/`）：

```js
let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
```

| 包 | 位置 |
|---|---|
| `dsh-client-locale` | `lib/client.js:9` |
| `dsh-client-ui-conversation` | `lib/client.js:33` |
| `dsh-client-ui-chat` | `lib/client.js:9` |
| `dsh-client-ui-model-selection` | `lib/client.js:11` |
| `dsh-client-ui-subagent` | `lib/client.js:10` |
| `dsh-client-ui-agent-preset` | `lib/client.js:9` |
| 另 ~25 个 | `dsh-client-ui-{approval,attachment,brand-official,commands,cordis,deliverables,directory-picker-browse,goal,input-trigger,jobs,message-feedback,permission-presets,plan,reference,schedule,settings-general,settings-models,settings-plugin-inventory,settings-plugins,sidebar,skill,theme,tool,trajectory,user-questions,workflow-run,workspace}/lib/client.js`、`dsh-session-log-export/lib/client.js:9` |

值得注意：这些包的 `dsh.client` 声明里**都没有**把 primitives 写进 `external`（只写 `inject`）。抽查 `dsh-client-ui-subagent/package.json:34` 与 `dsh-client-ui-jobs/package.json:25` 出现该名字，是在其它字段（非 `dsh.client.external`）里。原因见 [4.4](#44-seed-表条目不需要声明-dshclientexternal)。

### 4.3 第三方先例：本 profile 已有 5 个

实机 `~/.dsh/profiles/web/package.json#dsh.profile.bundles` 装了 `dshmarket`、`@linxin666/dsh-client-ui-skill-explorer`、`dsh-context`、`dsh-codex-connect`、`@linxin666/dsh-remote-web-ui`、`dsh-better-sidebar`、`@xmanrui/dsh-im`。其中 5 个已经在用 primitives：

| 第三方包 | `require` 位置 | `dsh.client` 是否声明 external | 依赖声明方式 |
|---|---|---|---|
| `dsh-context@0.44.0` | `lib/client.js:6` | 否（只有 `inject`） | devDep `0.1.2-rc.1` + peerDep `>=0.1.2-rc.1` |
| `dsh-better-sidebar@0.18.0` | `lib/client.js:32`（另有 `CHUNK_EXTERNALS` 白名单 `lib/client.js:1883-1891`） | 否 | devDep `0.1.2-rc.1` + peerDep `^0.1.2-rc.1` |
| `dshmarket@1.44.0` | `client/client.js:30` | 否 | **仅** devDep `^0.1.0-rc.6` |
| `dsh-codex-connect@0.1.0-alpha.4.30` | `lib/client.js:9` | 否 | devDep + peerDep 均 `0.1.2-rc.1` |
| `@linxin666/dsh-remote-web-ui@0.3.17` | `lib/client.js:33` | 否 | **仅** devDep `^0.1.2-rc.1` |

`dsh-better-sidebar` 甚至把整张 seed 表抄成了自己的懒加载 chunk 白名单，其源码注释逐字记录了 seed 表的演进（`lib/client.js:1876-1891`）：

```js
const CHUNK_EXTERNALS = [
  "react", "react/jsx-runtime", "react-dom", "react-dom/client",
  "cordis", "@deepseek-ai/dsh-client-ui-slots",
  "@deepseek-ai/dsh-client-ui-primitives"
];
```

**结论**：第三方使用 primitives 是本机 web profile 上的既成事实，不是理论可能性。**已核实**

### 4.4 seed 表条目不需要声明 `dsh.client.external`

Host 侧对 `dsh.client.external` 只做「可选字符串数组」的形状校验（`dsh-client-modules/lib/index.js:146`），并不校验成员是否存在于静态表；`orderByModuleGraph` 明确把「不匹配任何动态包行的名字」当成「静态表名，不产生图边」（`lib/index.js:339-369`，注释逐字：*An `external` specifier is either the package row it names ... or a static-table name that adds no graph edge*）。浏览器侧 `arriveGraphRow` 对 `row.external` 的每一项先查 seed，命中就 `continue`（`lib/client.js:253-262`）。

而真正的解析发生在 `makeRequire`，它**无条件**先查 seed（`lib/client.js:300-309`），与该 specifier 是否出现在 `external` 声明里无关。这也解释了为什么本仓库 `packages/composer-quick-actions/package.json` 的 `dsh.client` 里只有 `{"platform":"web"}`、没有 `external`，而 Client 仍能 `require("react")`。

**结论**：加用 primitives **不需要**改 `packages/composer-quick-actions/package.json`。声明 `dsh.client.external: ["@deepseek-ai/dsh-client-ui-primitives"]` 是无害的自文档化，但既非必需，也不符合第一方/第三方的现行惯例（它们都不声明）。**已核实**

---

## 5. 类型可用性：devDependency 足够，已实测

### 5.1 tarball 发布了 `.d.ts`

`files: ["lib/index.js", "lib/**/*.css", "lib/types/**/*.d.ts"]`，实际内容 43 个 `.d.ts`（`lib/types/index.d.ts`、19 个组件、`icons/{index,props}.d.ts`、`markdown/` 一族、5 个 hook / 工具）。`.d.ts.map` 未发布（`sourceMappingURL` 悬空，无实害）。

`peerDependencies` 只有一项：

```json
"peerDependencies": { "@deepseek-ai/cordis": "^4.0.2" }
```

本仓库 `packages/composer-quick-actions/package.json` 已有 `@deepseek-ai/cordis: ^4.0.2`（peer + dev 都有），因此该 peer 直接满足。（`^4.0.2` 这条 peer 对一个自述 "zero cordis" 的包来说是多余的，但它已发布，无从更改。）

其 `dependencies` 含 `@types/mdast`、`clsx`、`katex`、`shiki`、`micromark-*` 等 —— 加为 devDependency 会把这些拉进 lockfile。它们**只影响本地 `node_modules`**，不进产物（primitives 是 external），也不进两个 tarball（`files` 不含 `node_modules`）。**推断**

### 5.2 隔离实测：仓库 tsconfig 原样通过

`.d.ts` 的再导出写成 `export { StateDot } from './StateDot.tsx'`，而 tarball 不发布 `.tsx`/`src/`。这是唯一的真实风险点，因此做了实测而非推理。

harness：`$CLAUDE_JOB_DIR/tmp/tc`，`package.json` 仅 `{"type":"module"}`，`node_modules` 只放解包后的 primitives + `@types/react@18.3.31`（从仓库 `node_modules` 只读复制），`tsconfig.json` 逐字抄 `/home/yulong/dsh-quick-actions/tsconfig.base.json` 的 `compilerOptions`（`module`/`moduleResolution: NodeNext`、`strict`、`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes`、`verbatimModuleSyntax`、`jsx: react-jsx`、`skipLibCheck: true`）加 `noEmit`。探针文件 import 并使用了 `Button`/`Modal`/`Tooltip`/`Toast`/`Menu`/`RiskConfirmation`/`Pill`/`Input`/`projectUserText`/`useDismissOnOutsidePointer`/`useAnchoredPosition` + 7 个图标，以及 `ButtonVariant`/`MenuEntry`/`TooltipSide` 三个类型。

编译器：仓库已安装的 `typescript@6.0.3`（`/home/yulong/dsh-quick-actions/node_modules/.bin/tsc`，只读调用，输出目录在 tmp）。

| 实测 | 结果 |
|---|---|
| 正向：探针编译 | **退出码 0，无诊断** |
| 负向：`const bad: ButtonVariant = 'nope'` 与 `<Button variant="nope">` | **两处 `TS2322: Type '"nope"' is not assignable to type 'ButtonVariant'`** —— 证明类型真实解析，不是被 `skipLibCheck` 降级成 `any` |
| `skipLibCheck: false` 下 | 只报三类**与本项目无关**的 ambient 缺失：`markdown/MarkdownText.d.ts:14` 的 `import 'katex/dist/katex.min.css'`（TS2882）、`markdown/{incremental,render}.d.ts` 的 `'mdast'`（TS2307，真实安装时由其 `@types/mdast` 依赖补齐）、以及 harness 自身缺 `csstype` |

本仓库 `tsconfig.base.json` 已设 `skipLibCheck: true`，所以那个 `katex.min.css` 侧效应 import 的瑕疵不会咬到我们。**已核实**

### 5.3 结论

「只加 devDependency 用于类型、运行时靠模块表」不仅可行，而且是**第一方与全部 5 个第三方插件的一致做法**（5/5 只放 devDependency，其中 3 个额外加 peerDependency 表达运行时版本约束）。是否额外加 peerDependency 是发布策略选择（票据 17 范围）：加了能让安装者看到 DSH 版本约束，但由于运行时来自 shell 而非 `node_modules`，它无法被真正满足，`dshmarket` 与 `@linxin666/dsh-remote-web-ui` 就没加。

---

## 6. 样式：primitives 不需要我们的 CSS 管线

primitives 的 CSS 是 CSS Modules 源文件（tarball 里 25 个 `lib/**/*.module.css`），**全部只用 DSH alias token**，例如：

```css
/* $CLAUDE_JOB_DIR/tmp/prim/package/lib/Modal.module.css:14-19 */
.mask { position: absolute; inset: 0;
  background: var(--dsw-alias-bg-mask-1);
  backdrop-filter: var(--dsw-mask-blur); }
```

```css
/* lib/Button.module.css:4-16 */
.button { ... border-radius: 18px; font-size: 14px; line-height: 22px;
  color: var(--dsw-alias-label-primary); background: transparent; padding: 0 14px; }
```

这与本项目 `src/styles/index.ts` 已采用的 token 家族（`--dsw-alias-label-tertiary` 等）一致。

**这些 CSS 在 shell 构建期就编译进了前端样式表**，不在运行时注入：

- `@deepseek-ai/dsh-web-frontend/dist/assets/index-b24khbeK.css` 里能找到编译后的 CSS Modules 类名 `_dialog_w1urq_22`、`._mask_w...`、`border-radius:18px`、`var(--dsw-mask-blur)`；
- `dist/index.html:11-12` 以 `<link rel="stylesheet">` 加载 `vendor-BNsW4eBh.css` 与 `index-b24khbeK.css`。

因此 primitives **不**走 `<style data-plugin-css>` 那条第一方插件惯例（那条惯例是给**动态 bundle 自己的** CSS 用的：`dsh-client-modules/lib/client.js:170-176` 的 `claimStyles(id)` 在 materialize 时把无主 `<style>` 标签认领给该模块 id，`data-plugin-css` 属性由各 bundle 自己写出）。

**结论**：使用 primitives **不需要**给 `tools/dsh-client-bundle` 增加任何 CSS 能力。**已核实**

> 与 spec 8.4「CSS Modules」的关系：primitives 自带的部分等于免费拿到 CSS Modules；但**我们自己的** 516 行 `src/styles/index.ts` 仍是手写字符串 + `dsh-cqa-` 前缀，仍不是 CSS Modules。这是与 primitives 相互独立的第二处偏离，见[第 9 节](#9-可执行建议)。

---

## 7. 对构建适配器的影响

### 7.1 现状

`packages/composer-quick-actions/tsdown.config.ts:31` 目前是：

```ts
external: ['react', 'react/jsx-runtime'],
```

适配器 `tools/dsh-client-bundle/src/index.ts` 用这份列表同时驱动两件事：`deps.neverBundle`/`alwaysBundle`（第 88-89 行），和 `renderChunk` 里的 AST 门禁（第 99-135 行）。门禁的四条判定与本次改动相关：

- 间接 `require` 引用（第 101-118 行）：只允许 `require` 出现在直接调用的 callee、箭头函数形参、非计算成员名、非计算属性名位置；
- `ImportExpression`（第 119-122 行）：任何动态 import 直接失败；
- 计算型 `require`（第 128-130 行）：参数不是字符串字面量则失败；
- 未声明 external（第 131-133 行）：`!external.has(specifier)` 则失败。

### 7.2 正向实测：加进 `external` 全部通过

harness：`$CLAUDE_JOB_DIR/tmp/bundle`，把 `tools/dsh-client-bundle/src/index.ts` **原样复制**过去（未改一字），`node_modules` symlink 到仓库的（其中**并不包含** primitives），配置为：

```ts
dshClientBundle({ id: 'dsh-composer-quick-actions', entry: 'src/client.tsx', outDir: 'lib',
  external: ['react', 'react/jsx-runtime', '@deepseek-ai/dsh-client-ui-primitives'] })
```

入口使用了 `Button`/`Modal`/`Tooltip`/`Toast`/`Menu`/`RiskConfirmation`/`Pill`/`Input`/`projectUserText`/`useDismissOnOutsidePointer`/`useAnchoredPosition`/`IconSendOutline16`。用仓库已装的 `tsdown@0.22.14` + `rolldown@1.2.7` 构建：

```
✔ [dsh-composer-quick-actions/client] Build complete in 19ms
```

产物的 require 行与第一方 bundle **形状逐字相同**：

```js
let react = require("react");
let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
let react_jsx_runtime = require("react/jsx-runtime");
```

假 ModuleLoader（`node:vm`）验证：

```
id: dsh-composer-quick-actions
exports: Panel, apply, inject
inject: ["slots"]
requires: ["react","@deepseek-ai/dsh-client-ui-primitives","react/jsx-runtime"]
```

即：**AST 门禁四条全过，模块表 id / factory / `apply` / `inject` / externals 契约不变**。另外一个附带结论：primitives **不在** harness 的 `node_modules` 里，构建照样成功 —— external 不被 rolldown 解析，因此**构建不要求它在磁盘上**，只有 `tsc` 需要它（呼应 [5.3](#53-结论)）。**已核实**

### 7.3 反向实测：不加 external（内联）必然失败

harness：`$CLAUDE_JOB_DIR/tmp/bundle-inline`，同一份适配器，`external` 仍只有 `react` 两项，`node_modules` 里放真实的 primitives。结果：

```
ERROR  Error: Build failed with 24 errors:
[plugin tsdown:css-guard] .../dsh-client-ui-primitives/lib/Pill.module.css
Error: CSS file "..." was encountered but `@tsdown/css` is not installed.
        Please install it: `npm install @tsdown/css`
```

24 个错误对应 24 个被触达的 `*.module.css`。这从构建期硬性证明了：**primitives 只能作为 external 消费，不能内联** —— 与 spec 11.2「Client 是单文件 lazy-CJS、无 CSS 管线」自洽。（顺带得到一个事实：若将来要给**我们自己的**样式引入 CSS Modules，缺的那个包叫 `@tsdown/css`。）**已核实**

### 7.4 已知障碍

无。需要提醒的两点都不是障碍：

1. `inputOptions.resolve.conditionNames` 以 `browser` 优先（第 91-96 行）—— primitives 的 `exports` 没有 `browser`/`node` 条件分支，只有 `types` + `default`，而作为 external 根本不参与解析。**已核实**
2. `failOnWarn: true`（第 85 行）—— 正向实测无 warning。**已核实**

---

## 8. 版本一致性：`latest` 是陈旧 tag，必须锁 `0.1.2-rc.1`

registry 事实（`npm view`）：

```json
dist-tags: { "latest": "0.0.1-rc.1", "alpha": "0.1.3-alpha.2", "next": "0.1.2-rc.1" }
```

时间线（`npm view ... time`）：`0.0.1-rc.1` 发布于 **2026-08-10T19:40:05Z**，是该包的**首次发布**；其后 16 个版本（至 `0.1.3-alpha.2`，2026-09-07）**全部**发布到 `next` / `alpha`，`latest` 从未推进。

所以 `0.0.1-rc.1` **不是占位包、不是抢注**，而是「首次发布后 dist-tag 被遗忘」的真实但陈旧构建。它与运行中 DSH 提供的东西差异是实质性的：

| 对比项 | `0.0.1-rc.1` | `0.1.2-rc.1`（= 运行中模块表） |
|---|---|---|
| 导出数 | 98 | **114** |
| 缺失的关键导出 | `Toast`、`projectUserText`、`ReferenceIcon`、`ConnectionIndicator`、`useAnchoredPosition`、`useDismissOnOutsidePointer`、`relativeTime`、`diffTotals`、`FISH_LOGO_PATH`、`FISH_LOGO_VIEWBOX`，以及 7 个图标（`IconAgentPresetOutline16`、`IconAlarmClockOutline16`、`IconClockOutline16`、`IconContextInjectionOutline16`、`IconCordisPluginOutline14`、`IconDatabaseOutline16`、`IconGlobeOutline14`） | 全部具备 |
| 已删名 | 有 `ConnectionBanner`（后被 `ConnectionIndicator` 取代） | 无 |
| CSS | **不发布**（`files` 无 `lib/**/*.css`） | 25 个 `*.module.css` |
| 额外产物 | `lib/invariant.js` + `exports["./invariant"]` | 已移除 |
| `peerDependencies` | `@deepseek-ai/dsh-invariants ^0.0.1-rc.1` + `@deepseek-ai/cordis ^4.0.1-rc.1` | 只有 `@deepseek-ai/cordis ^4.0.2` |

**风险具体化**：若在 `package.json` 里写成不带精确版本的形式（或跟 `latest`），装到的会是 8 月 10 日那份 —— `Toast`、`projectUserText`、两个 hook 直接不存在，类型面与运行时模块表**不一致**，且这类不一致**不会在构建期暴露**（primitives 是 external，不解析），只会在浏览器里 `undefined is not a function`。

**要求**：devDependency 精确写 `"@deepseek-ai/dsh-client-ui-primitives": "0.1.2-rc.1"`（不加 `^`/`~`，不用 `next` tag —— tag 会移动，`0.1.3-alpha.2` 已经在 `alpha` 上）。这与 `dsh-context` / `dsh-codex-connect` 的做法一致（两者都精确写 `0.1.2-rc.1`）。**已核实**

---

## 9. 可执行建议

### 9.1 证据支持哪一方

任务给出的两个选项中，证据**明确不支持**「继续手写控件并把偏离写进 README 的已知限制」这一整体方案，理由是三条**已核实**的事实：

1. primitives 在 web profile 里**无条件可用**，本 profile 已有 5 个第三方插件在用它 —— 不存在「不可用」这个前提；
2. 接入成本**极小**：一行 `external` + 一条精确版本 devDependency，构建适配器零改动、CSS 管线零改动（第 6、7 节实测）；
3. spec 8.4 的 primitives 要求是**首版硬门槛**，与本项目已闭合决策没有任何冲突 —— 它不新增任何 DSH 核心接口（第 16.4 节）、不涉及 `insertText`、不涉及 Remote、不改 `@deepseek-ai/dsh-client-ui-settings`。

但**不支持整体照搬 `Modal`**。有两项必须保留手写：

| 项 | 原因 |
|---|---|
| `src/client/modal.ts` 三个 hook | primitives **没有**焦点陷阱 / 初始焦点 / 焦点返回，`Modal` 也不做（[3.3](#33-明确缺失焦点陷阱)）。spec 8.4「面板关闭后的焦点返回」与「键盘遍历」只能自己实现 |
| `ConfirmPanel` 不用 `RiskConfirmation` | 它是页内块、无 `role="dialog"`、无 `Escape`，且强制一个 spec 9.3 未要求的 acknowledgement checkbox 门槛 |

另外 `Modal` **portal 到 `document.body`**，而 `src/client/modal.ts:1-20` 的设计注释明确记录了当前三个面板「不经 portal、在 composer 栈内就地渲染」这一取舍。改用 `Modal` 会把确认面板与管理面板变成**视口居中 + 全屏模糊遮罩**的对话框。这是**产品外观决策，不是技术障碍**：好处是与 DSH 原生对话框视觉/语义一致（spec 8.4 的字面要求），代价是确认面板离 composer 更远，且 spec 13.3 的视觉截图基线要重做。**这一条需要用户拍板，不应由实施方自行决定。**

### 9.2 建议的落点（分三档）

**A 档 —— 必做，风险最低、收益最直接（建议纳入票据 16 收尾或票据 18 前置）**

只替换**无布局/无焦点语义争议**的叶子控件，不动任何面板容器与焦点代码：

| 改动 | 文件 |
|---|---|
| `external` 加 `'@deepseek-ai/dsh-client-ui-primitives'` | `packages/composer-quick-actions/tsdown.config.ts:31` |
| devDependency 精确加 `"@deepseek-ai/dsh-client-ui-primitives": "0.1.2-rc.1"` | `packages/composer-quick-actions/package.json` |
| 34 处 `<button className="dsh-cqa-entry">` → `Button`（`variant: 'toolbar'` / `'ghost'`，`icon` 用官方图标） | `surfaces/ActionFace.tsx`、`surfaces/QuickActionsSurface.tsx`、`surfaces/entries.tsx`、`surfaces/ErrorBoundary.tsx`、`manager/ManagedRow.tsx`、`manager/ActionPanel.tsx`、`manager/ManagerPanel.tsx`、`manager/ActionForm.tsx`、`session/ConfirmPanel.tsx` |
| 搜索框 / 表单输入 → `Input`（`icon={<IconSearchOutline16 />}`） | `manager/ActionPanel.tsx`、`manager/ActionForm.tsx` |
| 计数 / 命令标记 → `Pill` | `surfaces/entries.tsx`（launcher）、`manager/ManagedRow.tsx` |
| 瞬态反馈 `role="status"` → `Toast`（`anchor` 传 composer 卡片元素） | `surfaces/QuickActionsSurface.tsx:275`、`surfaces/entries.tsx:178` |
| 确认面板正文改用 `projectUserText(text, [])` | `session/ConfirmPanel.tsx:54` |
| 删掉被 `Button`/`Input`/`Pill` 接管的规则，保留三条宽度规则与布局容器 | `src/styles/index.ts`（预计可减掉 `.dsh-cqa-entry` / `.dsh-cqa-input` / `.dsh-cqa-textarea` / `.dsh-cqa-badge` / `.dsh-cqa-tag` / `.dsh-cqa-icon` 一族） |

需要一并调整的测试：`tools/dsh-client-bundle/tests/bundle.spec.ts` 的 external 断言（若它固定了 external 列表）、以及任何按 `.dsh-cqa-entry` 选择器断言 DOM 的 Client 测试。**注意 spec 8.2 的 1 CSS px 边界要求**：`.dsh-cqa-ribbon` / `.dsh-cqa-bar` / `.dsh-cqa-launcher` 三条宽度规则**必须原样保留**，`Button` 只替换行内控件，不参与外边界计算。

**B 档 —— 需要用户拍板的外观决策**

| 选项 | 影响 |
|---|---|
| B1：`ManagerPanel` / `ActionPanel` / `ConfirmPanel` 改用 `Modal` 作容器（三个 hook 保留，装在 `Modal` 的卡片里） | 与 DSH 原生对话框语义/视觉一致，最贴合 spec 8.4 字面；但面板变成视口居中 body portal，需重做视觉基线，且 `useDismissOnOutsidePointer` 取代自制 backdrop |
| B2：容器维持就地渲染，只用 A 档叶子控件 | 保留 `src/client/modal.ts:1-20` 记录的就地渲染取舍与现有视觉基线；spec 8.4「沿用 DSH primitive 的标准模态语义」只能算部分满足，需在 README 已知限制里说明 |

若选 B1，额外可用：布局 B 的「更多」溢出改用 `Menu`（`portal: true` + `getAnchorRect`），launcher 面板定位改用 `useAnchoredPosition`，`.dsh-cqa-scroll` 高度改用 `useAnchoredMaxHeight`。

**C 档 —— 独立的第二处偏离：我们自己的 CSS Modules**

spec 8.4 的「CSS Modules」有两半：primitives 自带的那半靠 A 档免费拿到；**我们自己 516 行的 `src/styles/index.ts` 仍是手写字符串**。要真正满足需要给 `tools/dsh-client-bundle` 装 `@tsdown/css`（[7.3](#73-反向实测不加-external内联必然失败) 已确认这是缺失的那个包），并让产物注入 `<style data-plugin-css>`。这会改动 `tools/dsh-client-bundle/tests/bundle.spec.ts` 固定的契约（spec 11.2「单文件、无 CSS 管线」），属于**范围决策**，不建议塞进票据 16。建议要么单开票据，要么由用户明确接受「自有样式不用 CSS Modules、以 `dsh-cqa-` 前缀等价保证碰撞安全」这一偏离并写进 README 已知限制 —— 这正是 `src/styles/index.ts:1-10` 现有注释已经给出的理由。

### 9.3 本地可证 vs 待票据 18 确证

| 断言 | 状态 |
|---|---|
| tarball 形态、`files`/`exports`/`peerDependencies`、114 个导出、43 个 `.d.ts`、25 个 CSS | **本地可证**（tarball 本体） |
| seed 表含该键、键名与包名一致、命名空间与 tarball 逐键一致 | **本地可证**（shell 产物 + 程序化差集） |
| `Modal` 无焦点陷阱、`RiskConfirmation` 无 portal/无 dialog role | **本地可证**（读产物实现） |
| primitives CSS 已编译进 `index-*.css`、由 `index.html` link 加载 | **本地可证** |
| 仓库 tsconfig 下类型解析成功、类型非 `any` | **本地可证**（隔离 tsc 实测） |
| 加入 external 后 AST 门禁通过、require 形状正确、内联会失败 | **本地可证**（隔离 tsdown 实测） |
| `latest` 为陈旧首发、必须锁 `0.1.2-rc.1` | **本地可证**（registry 元数据 + 两个 tarball 对比） |
| 我们的 bundle 在**真实浏览器**里 `require` 该键确实拿到可用组件 | **待票据 18**（GUI 通道；只有有活动 GUI 页面的前台会话能确证） |
| 官方 `--dsw-*` token 在 Composer dock 上下文中的实际计算值、`Button variant='toolbar'` 与官方工具行的视觉对齐、`Toast` 的 `anchor` 对齐、三种视口下的 1 CSS px 边界 | **待票据 18**（含 spec 13.3 的视觉基线） |
| `Modal` 的 body portal 与 Slot 渲染上下文（Composer 栈的 transform/filter 祖先）无冲突 | **待票据 18**；`Toast` 的文档注释明确说它做 portal 正是为规避这种祖先，可作为间接支持，但不是本地证据 |
