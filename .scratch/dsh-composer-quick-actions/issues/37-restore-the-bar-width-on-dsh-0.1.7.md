# 让 bar 布局在 DSH 0.1.7 上重新与输入框等宽

Type: task
Mode: AFK
Status: resolved
Blocked by: none

## Question（问题）

票据 34 在 DSH `0.1.7-rc.2` 上重跑 `screenshots-round.sh` 时发现：**bar 布局（B，`conversation.composer.dock`）不再撑满整行**，而 ribbon 与 launcher 仍与输入框等宽。

| 视口 | 基线宽度（票据 18 录制） | `0.1.7-rc.2` 实拍 |
|---|---|---|
| desktop | 776 px | 367 px |
| tablet-768 | 672 px | 367 px |
| narrow-360 | 264 px | 240–241 px |

实拍里操作栏只有内容宽，「管理」紧挨着最后一个预置，而不是贴在右缘；三个视口下都没有溢出、控件都可点。插件的布局规则自录基线以来未改（`git diff 70c1c7f HEAD -- src/styles/` 只有样式标签 id 改名与层叠注释），而它的前提写在注释里：`.dsh-cqa-bar` 「renders as the InputBar's last child, inside that padding, so it is simply `100%` wide」。所以变的是 DSH 这一侧——录基线之后的某个版本（至少 `0.1.7-rc.2` 已如此；票据 32 在 rc.1 上没跑截图，无法再往前定位）的 InputBar（或 composer dock 的 Slot 包装）不再给最后一个子元素整行宽度，`width: 100%` 解析到了一个收缩到内容的容器上。

同一窗口里 `acceptance-round.sh` 的浏览段也因此失败：`acceptance.spec.ts:235` 的等宽检查报 `bar@1440 left`，左缘偏离输入框 **159.2 px**（容许 1 px）。spec 8.2 的等宽规则因此在 bar 布局上不再成立。`surface.spec.ts` 的等宽断言只测 ribbon，常规套件没有覆盖到；截图基线是唯一抓到它的闸门。

要做：

1. 在真机上查 `0.1.7` 的 InputBar 与 composer dock 包装的 DOM / 计算样式（`display`、`flex`、`width`），确定是哪一层收缩。Client `cordis_inspect_query` 只能由有活动 GUI 页面的前台会话执行。
2. 只改插件侧样式让 bar 重新撑满（例如让单元格自己成为能伸展的 flex 项），**不改 DSH 核心**（「首版不新增任何 DSH 核心接口」）。修法要在 `0.1.7-alpha.2` 下界到当前基线之间都成立。
3. 给 `surface.spec.ts` 补 bar 布局的等宽断言，别再只靠截图。
4. 重录 bar 的三张基线：`tests/gui/screenshots.spec.ts-snapshots/bar-*-linux.png` 被票据 34 **有意保留为旧图**，在修好之前 bar 截图应保持红色。

另注意：tablet 与 narrow 下 ribbon 截图首次尝试偶尔高 33 px、重试为 32 px（元素高度是小数像素），票据 34 更新的基线取 32 px，重试可吸收；若修 bar 时顺带让高度取整，可一并消除这处抖动。

## Comments

### 2026-09-28：认领，源码取证（只读，未实跑）

**根因：DSH `0.1.6-alpha.2` 给 composer dock 加了一层 `.dock` 行容器**，从此 `conversation.composer.dock` 不再是 InputBar 的直接子元素。

- `0.1.7-rc.2`（`dsh-client-ui-conversation/lib/client.js:17095,17536-17541`）：`.uV2eYG_root`（`display:flex; flex-direction:column; align-items:center`）→ `.uV2eYG_dock`（`display:flex` 横向、`justify-content:center; gap:12px; max-width:100%`，**无 width**）→ `div[data-slot="conversation.composer.dock"]`（`display:contents`，`dsh-client-ui-renderer/lib/client.js:1094-1103`）→ 各 cell。同一行里还有 ui-chat 的 StatsPills（order 0，`dsh-client-ui-chat/lib/client.js:12401-12407`）、插件的 `.dsh-cqa-bar`（order 100），以及末尾 DSH 自己的 ContextMeter（`flex:none`，活动中不渲染）。Slot cell 不加包装 DOM，`.dsh-cqa-bar` 就是 `.dock` 的直接 flex item。
- `.dock` 在 `align-items:center` 的列容器里取 fit-content 宽；bar 的 `width:100%` 在算 `.dock` 内在宽时是循环百分比、按 `auto` 处理，于是两者一起缩到内容宽。实测左缘偏 159 px 而 (776−367)/2 = 204.5，差出的约 91 px 就是 bar 右侧的 ContextMeter 加 gap（推断）。
- 版本定位：`0.1.2-rc.1`、`0.1.5-rc.1`–`rc.3`、`0.1.6-alpha.1` 里 dock Slot 是 root 的直接子元素（`width:100%` 按 root 内容盒解析，整行宽）；`0.1.6-alpha.2` 首次出现 `.dock`，`0.1.7-alpha.1` 到 `rc.2` 结构与 CSS 逐字相同。**插件支持的整个区间（下界 `0.1.7-alpha.2`）都是新结构**，不存在要兼顾两种结构的问题。
- ribbon 不受影响：`conversation.input.dock` 新旧都在 `.wSkVaW_composerStack`（列 flex、默认 stretch、宽度确定）里。

**纯插件 CSS 修不干净。**

- 最接近的写法是 `.dsh-cqa-bar { width: var(--dsh-composer-card-max-width); max-width: 100%; min-width: 0 }`：主会话里该变量是纯 px（`calc(var(--dsh-chat-content-width) + 32px)`，`:15721`），能撑开 fit-content 的 `.dock`，bar 恢复卡片宽。但同一行有 StatsPills / ContextMeter 时整行居中，bar 会偏 (前兄弟宽 − 后兄弟宽)/2，只有 meter 时约左偏 45 px，1 px 闸门仍不过；还会把 DSH 自己的 meter 推到宽行的另一端。embedded 变体里该变量含百分比，这个写法会退回内容宽（未证实 bar 在那里是否渲染）。
- `flex:1 1 100%`、`align-self:stretch`、`grid-column`、`justify-self`、`min-width:0` 在这个结构下都无效（伸展空间属于 fit-content 的 `.dock`，插件碰不到）。
- 精确两侧对齐只剩三条路：用 `:has(> [data-slot="conversation.composer.dock"] > .dsh-cqa-bar)` 从外部改 DSH 的 `.dock`（让它换行、bar 独占一行）；用 JS 测量卡片位置；或提给上游。

所以这已不是修一个 bug，而是 spec 8.2 等宽规则（spec 13.3 硬闸门）在 bar 上还要不要成立的产品决策，等用户拍板。取证中间产物在任务临时目录 `dock-src/`（`0.1.5-rc.2` 至 `0.1.7-alpha.1` 的解包）。

### 2026-09-28：用户选 C

用户回复「选 C，我停掉服务你来测」——接受 DSH 的新设计：bar 做 dock 行里的紧凑成员，spec 8.2 的等宽只约束 ribbon。

## Answer（结论）

**bar 跟随 DSH 的 composer dock 行（spec 22.9）：宽度随内容、最多与卡片同宽，需要折叠时撑到卡片宽再折叠；真机上三视口、六档规模与验收全部成立。**

### 改了什么

- **spec 22.9**（新增，覆盖 8.2 与 13.3 关于 B 等宽的表述）：B 的硬门槛是「自身不比输入卡片宽、不越出视口、折叠稳定、每个动作恰有一个去处」。**不以卡片左右边缘为界**：DSH 的这一行只受对话列约束，DSH 自己的统计小药丸较宽时整行本就会超出卡片（第一次验收实测 1440 下 bar 右缘 1417 px、卡片右缘 1244.7 px），要压回卡片内只能 JS 测量 DSH 的兄弟元素，即方案 D。
- **样式**：`.dsh-cqa-bar` 去掉在新结构里失效的 `width: 100%`（循环百分比，且会让 bar 的 flex 基准等于整行宽、挤压 DSH 的小药丸）与 `margin: 0 auto`，加 `min-width: 0`；新增 `.dsh-cqa-bar[data-quick-actions-overflow] { width: var(--dsh-composer-card-max-width) }`。头部「宽度规则」注释重写。
- **折叠修复**（`QuickActionsSurface.tsx`、`layout.ts`）：真机发现内容宽的 bar 在窄屏需要折叠时**振荡**——它量的区域就是自己显示的内容，整数取整让「刚好放下」判为放不下，一路折到 0 又退回「全部显示」（本票据第一轮、只改了样式的包上，窄屏「管理」按钮 90 秒 `element is not stable`；旧样式下的 bar 同样是内容宽，推断同样会振荡，票据 34 的截图只种 3 个动作、没有触发折叠）；且只量自己的 bar 永远发现不了变宽后多出的空间。修法：需要折叠时根元素带 `data-quick-actions-overflow`，样式把它撑到卡片宽、由行的 `max-width: 100%` 封顶，折叠所量的区域不再随自身收缩；测量改为小数像素（`getBoundingClientRect`）；`fitActionCount` 允许 0.5 px 的溢出（`FIT_TOLERANCE`）。
- **测试**（TDD，先红后绿）：`layout.spec.ts` 的宽度公式改为 ribbon 等宽 + bar 可收缩、封顶、带折叠规则，新增亚像素容差用例；`surfaces.spec.tsx` 新增「需要折叠时带占满标记」「全部放得下时不带」两条（桩掉 `ResizeObserver` 与 `getBoundingClientRect`）；`manager.spec.tsx` 的测量桩改为 `getBoundingClientRect`。GUI 侧 `surface.spec.ts` 新增 bar 不比卡片宽、不越出视口；`scale.spec.ts` 新增 bar 折叠稳定（1.5 秒内不变、显示数 + 「更多」数 = 总数、有动作时至少显示一个）；`acceptance.spec.ts` 的 bar 检查改为不比卡片宽。bar 三张截图基线按新外观重录。
- README（中英）的 bar 描述改为「输入框下方一行，与 DSH 自己的用量信息并排，宽度随内容、最多与输入卡片同宽」。

### 真机验证（DSH `0.1.7-rc.2`，用户停服后自起 3080，开窗前另存 profile 四文件为 `profile-backup2`）

| round | 结果 |
|---|---|
| `reinstall`（开窗） | 通过 |
| 只改样式、未修折叠的包 `surface` / `scale`（对照） | 窄屏 bar 折叠振荡：`manage` 按钮 90 秒不稳定，用例两次都失败；桌面 6 / 25 个动作能稳定 |
| 新包 `surface.spec`（三视口） | 18 条全过（15 条靠重试，见票据 38），窄屏不再振荡 |
| 新包 `scale`（0/1/6/25/50/53） | 全过，含 bar 折叠稳定检查 |
| bar 基线重录 + 截图完整对比 | 9 张全部与基线一致；desktop / tablet 全部放下（内容宽），narrow「确认 / 更多 2 / 管理」 |
| 新包 `acceptance`（浏览 + 重启 + 卸载 + 重装） | 四段全过；bar 在 1440 下 6 个 + 「更多 2」、360 下 1 个 + 「更多 7」，稳定 |

每轮之后用户 patch 都与 `profile-backup2` 逐字节一致（`acceptance` 本就不还原，其后由独立备份还原）；收尾 `close-window.sh` 指纹与独立备份两次核对一致。全量 `pnpm test` 496 条通过（有一次因与 GUI 打包并行而撞上 `packing isolation`，单独重跑通过）。

### 过程中的操作记录

- 覆盖安装同路径同版本的 tarball 时 pnpm 视为无变化、不重新解包（`INSTALLED BUILD IS STALE`），改为先 `qa_uninstall` 再 `qa_install`。
- 截图轮的 `afterAll`（换回 ribbon）与大多数用例的首次尝试都败在进入会话，是另立的[票据 38](./38-make-session-entry-survive-collapsed-workspaces.md)，不影响断言本身。
