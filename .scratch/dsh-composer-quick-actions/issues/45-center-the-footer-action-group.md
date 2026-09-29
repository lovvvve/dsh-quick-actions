# 将独立下方操作栏的动作组改为居中

Type: task
Status: resolved
Labels: ready-for-agent
Blocked by: 44

## Question

在保留独立行、上下顺序和窄屏折叠的前提下，如何将 footer 的整组快捷动作改为居中，与统计栏的视觉效果一致？

## Authorization

用户明确将之前的左对齐决定改为居中，并确认「保持独占一行与顺序，仅改插件样式、补回归、打包更新本机」。不改 DSH 核心，不重启、不发布，不修改用户动作配置。只修改插件自己的 footer 行，旧核心 fallback、ribbon、launcher 不变。

## Answer

已实现、安装并在当前 `http://127.0.0.1:3080/` 实测通过。唯一运行时改动为插件 footer 控件行添加 `margin-inline: auto`，继续保留 fit-content / 溢出占满宽度与原折叠算法。

- TDD：4 个浏览器用例先因居中偏差失败（静态夹具 67.5 / 264 / 296px，真实 React 组件 192.953125px），改动后全部通过；包含真实 ResizeObserver 的反复缩放/动作分区/逐帧稳定检查。
- `pnpm typecheck` 两遍、`pnpm lint`（0 warnings/errors）、`pnpm test`（23 文件、506 项）通过；pnpm pack 的 prepack Host/Client 构建通过。
- 安装前完整备份当前 profile，32,671 项三方清单一致。经现有 DSH CLI 安装新本地 tarball exit 0，仍为 `0.2.0-rc.2` 本地修复版，不是 npm 发布。
- 核心 JS、Settings patch、workspace 策略、其他直接依赖和 bundle 列表均不变。服务实际提供的插件代码与新 tarball 匹配，rev=`c178b19e6973`。
- 真实 GUI 验证：仅打开本仓库既有会话、不发送、不改设置。在 1440→768→375→1440 下，动作组一直在统计行下方、仅一份、不越界；居中误差分别 0.0078125 / 0 / 0 / 0.0078125 CSS px。可见动作数 5→5→3→5，最后 10 帧稳定，证明缩窄折叠后加宽恢复。

备份路径、包 hash 和状态见[居中安装 receipt](../verification/footer-center-receipt.json)；真实 DOM 几何记录见[现场验证数据](../verification/center-live.json)，可复现脚本为[只读 GUI 检查](../verification/check-centered-live.mjs)。规范水平对齐以 spec 23.1 为准。
