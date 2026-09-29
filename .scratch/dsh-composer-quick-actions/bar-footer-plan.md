# 下方操作栏独立行 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** 在带补丁的 DSH 中将 bar 放到统计行下方并左对齐输入框，旧核心继续在原 dock 显示一次。

**Architecture:** 核心新增 session list Slot `conversation.composer.footer`，插件通过 `slots.inject` 等待声明。Footer entry 的实际挂载作为每会话可用信号，composer dock 仍承担常驻信标，只有没有 footer 的会话渲染原 bar。footer 的宽度由核心保证，插件只设置自己的按钮行布局。

**Tech Stack:** TypeScript、React、Cordis Slots、Vitest、CSS。

**Spec:** [下方操作栏独立行设计](./bar-footer-design.md)。用户已同意核心扩展与旧核心回退。

## Global Constraints

- 核心补丁基线 `477b4f420553e8a52c2fbccc464d7561b239c443`（`dsh-v0.1.7-rc.2`）。
- 不改已安装依赖、不另起服务器、不重启当前 GUI、不发布 npm。
- 不迁移 Settings、不改 ribbon/launcher，不以 CSS order 或私有 DOM 搬移实现新位置。
- 折叠保留小数像素和 0.5px 容差。

## Task 1: 核心 footer（独立子代理，限定 core/bar-footer 输出）

- [x] 先给 InputBar 组件测试增加 footer 在 dock 之后、resident-only、无内容无额外行的断言；运行确认缺失行为导致失败。
- [x] 修改核心 `packages/client/ui-conversation/src/client/{contract/slots.ts,apply.ts,skeleton/InputBar.tsx,skeleton/InputBar.module.css}` 中 SlotMap、children、派生 props 与渲染：

```tsx
{variant === 'composer' && input !== undefined && sessionId !== undefined
  ? <div className={css.footer}>{renderSlot('conversation.composer.footer', {})}</div>
  : null}
```

- [x] footer 使用卡片相同宽度约束；依据真实 renderer 输出处理空内容，不改原 dock。
- [x] 运行聚焦测试，持久化 exact-base patch、应用说明和验证记录到 `core/bar-footer/`。

## Task 2: 插件挂载和回退

Files: `packages/composer-quick-actions/src/client/{index.tsx,dsh.ts,surfaces/entries.tsx}`，`tests/client/{surfaces.spec.tsx,plugin.spec.ts}`（测试路径均相对包目录）。

- [x] 增加行为测试，render 两种 host 结构；核心断言：

```tsx
expect(container.querySelector('[data-dock] [data-quick-actions-layout="bar"]')).toBeNull()
expect(container.querySelectorAll('[data-quick-actions-layout="bar"]')).toHaveLength(1)
expect(container.querySelector('[data-footer] [data-quick-actions-layout="bar"]')).not.toBeNull()
```

- [x] 运行 `pnpm vitest run packages/composer-quick-actions/tests/client/{surfaces.spec.tsx,plugin.spec.ts}`，确认新 footer 尚未实现而失败。
- [x] 增加 `FooterDock`，使用专属的计数式挂载 registry（复用 `createResidentComposerRegistry`），每个会话独立。footer 在 layout effect 标记，标记后才渲染 bar；composer dock 订阅同一标记，存在则不渲染回退。实际卸载后恢复回退。
- [x] index 用 `slots.inject('conversation.composer.footer', ...)` 注册，旧核心没有声明时不得直接 register。
- [x] 测试覆盖 footer 迟到/移除、多会话、重复挂载计数、切换其他布局无空 wrapper、一次发送、卸载。

## Task 3: 插件行布局与验证

Files: `packages/composer-quick-actions/src/styles/index.ts`，`tests/gui/` 与规格/票据文档。

- [x] footer bar 使用专有 wrapper，不影响旧 dock 样式；bar 占满宿主给定宽度，内部行按内容宽度收缩且不超过 100%，溢出时行占满 100% 以稳定测量。

```css
.dsh-cqa-footer > .dsh-cqa-bar { width: 100%; }
.dsh-cqa-footer .dsh-cqa-row { width: fit-content; max-width: 100%; }
.dsh-cqa-footer [data-quick-actions-overflow] .dsh-cqa-row { width: 100%; }
```

- [x] 补充浏览器几何回归：独立行、左缘误差 ≤1px、窄屏折叠/加宽恢复；如果实时 GUI 未装补丁，明确区分离线浏览器夹具与实时 GUI 证据。
- [x] 执行插件聚焦测试、完整 typecheck、lint 和 build；按变更面执行打包测试。
- [x] 检查核心补丁可重复应用，独立审查兼容与 cleanup；同步 spec、地图、README 与票据。未经过真实 GUI 验证不得标成线上修复或人工验收通过。
