# 让 bar 布局在 DSH 0.1.7 上重新与输入框等宽

Type: task
Mode: AFK
Status: open
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
