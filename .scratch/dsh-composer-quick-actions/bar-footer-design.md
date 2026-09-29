# 下方操作栏独立行设计

状态：源码契约已核对；用户已确认核心扩展与旧核心回退策略。关联：[将下方操作栏放到独立且与输入框左对齐的一行](./issues/40-place-bar-on-a-separate-left-aligned-row.md)。

## 已确认目标

bar 位于输入框和统计行之下，独占新行，动作组从输入框左边缘开始。保留统计行布局、ribbon、launcher、发送与管理行为。用户已允许扩展 DSH 核心挂载点。

## 方案

1. 在 DSH 的 InputBar 统计 dock 后增加 session-scoped list Slot，候选名 `conversation.composer.footer`。只在 Resident Composer 中渲染，与现有 composer dock 采用相同的挂载条件。
2. DSH 提供与输入卡片相同宽度及最大宽度的行容器；容器内从左开始排列。无插件内容时不留下额外空白。DOM 顺序就是输入框、统计行、快捷动作行，不用 CSS order 或绝对定位伪造顺序。
3. 插件保留 composer dock 的常驻信标，将 bar 渲染移到新 footer；ribbon、launcher 和管理 overlay 不搬动。新行提供稳定可用宽度，折叠测量继续使用小数像素和 0.5px 容差。
4. 不改用户数据与 Settings schema，不发布 npm，不改已安装 node_modules，不启动替代服务器。

## 取舍与兼容

不选择私有 DOM portal 或修改宿主 CSS：它们耦合内部结构，可能破坏视觉/键盘顺序。新 Slot 属于本地核心补丁，不宣称是官方已发布能力；发布与部署前必须明确支持该 Slot 的 DSH 构建，不能沿用旧兼容声明而假装旧核心能呈现新布局。旧核心的回退策略已经用户确认：旧核心保留现有 bar，新核心使用 footer，且两处不可重复显示。按每会话 footer 的实际挂载判定，不依赖版本字符串。

## 验证

- 核心：footer Slot 声明、session props、Resident/hero/takeover 条件、空 footer 无额外高度、与原统计行的 DOM 顺序。
- 插件：bar 只出现一次，卸载清理、切换布局、常驻信标与发送守卫不变。
- 真实 GUI：三档视口下 bar 位于统计行下方，左边缘与输入框误差不超过 1 CSS px；窄屏不越界、折叠稳定、加宽恢复、Tab 顺序与视觉一致。
- 当前 GUI 不自动改变。必须先确定源码构建的部署方式，避免把源码测试成功误报为线上已生效。
