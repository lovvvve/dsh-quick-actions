# 独立下方操作栏：插件验证与交付边界

**后续更新**：下文记录的核心生成物缺失与包构建解析警告已由[构建诊断](./footer-build.md)解除，并已准备两个本地 tarball。历史验证记录保留；当前 GUI 仍未部署。

关联：[将下方操作栏放到独立且与输入框左对齐的一行](../issues/40-place-bar-on-a-separate-left-aligned-row.md)。

## 实现

- 可选 `conversation.composer.footer` 经 `slots.inject` 等待声明；只有实际挂载的会话迁到 footer，旧核心保留 composer dock 回退。
- FooterDock 用计数式每会话挂载标记，layout effect 交接，先撤旧表面再挂新表面；composer dock 仍保留常驻信标。
- footer 行与核心给出的卡片宽度一致，按钮组左起紧凑排列。折叠时内部行占满可用宽度，窗口加宽能重新展开。旧 dock 样式不改。
- Settings、发送路径与单飞引擎不改。热交接取消未提交确认，保留已经进入 `adjudicating` / `submitting` 的单飞。

## TDD 与新鲜验证

| 验证 | 结果 |
|---|---|
| 首次新增 footer/注册测试 | 7 项预期失败（FooterDock 不存在、缺 footer 注册、注册数量仍 3），其他 40 项通过 |
| 实现后聚焦测试 | 47 项通过 |
| 新增 CSS-only 浏览器用例（实现 CSS 前） | 三档宽度均失败，管理入口与末动作距离为 143 / 536 / 600px，而非 8px |
| 实现 CSS 后 | 三档均通过 |
| 最终 `pnpm typecheck` | 两遍均 exit 0，包括新增浏览器测试与 TSX 夹具 |
| 最终 `pnpm lint` | 99 文件，0 warnings / 0 errors |
| 最终 `pnpm test` | **23 文件，506 项通过**；包含 42 项 surface、30 项真实打包契约、16 项构建适配器契约 |
| `pnpm build` | 插件 Host/Client 构建均通过，exit 0 |
| `pnpm exec playwright test --config tests/browser/playwright.config.ts` | **4 项通过**：3 项静态 CSS 几何测试 + 1 项真实 React/官方 primitives/ResizeObserver 测试 |
| 核心 patch 反向校验（Lead 独立复核） | 在修改后的精确基线归档上 `git apply --reverse --check`，exit 0 |
| 核心行为测试（Lead 独立重跑） | `vitest run packages/client/ui-conversation packages/client/ui-renderer packages/client/ui-slots`，55 文件、706 项通过，exit 0 |
| `git diff --check` | exit 0 |

测试输出包含已发布 primitives 引用不存在 sourcemap 的 Vite 警告，以及既有错误边界用例主动抛出的 `surface exploded` 日志；没有未处理的测试失败。Playwright 打印环境 `NO_COLOR` / `FORCE_COLOR` 冲突警告，不影响结果。

## 独立审查补强

只读审查未确认实现缺陷，指出两项覆盖不足；均已补齐：

1. **真实测量循环**：`tests/browser/footer-component.spec.ts` 在内存中用 Vite 打包实际 QuickActionsSurface 与官方 primitives/CSS，不启动服务器。真实 Chrome 下依次 1440→320→375→1440→320→1440，验证「更多」出现/消失、显示与隐藏动作互斥且合计 6、20 个连续动画帧数量稳定、恢复全部动作、左右边界不越出卡片。不是通过手动设置 overflow 伪造实测。Vite 直接开发依赖仅显式声明已有锁定版本，lockfile 没有升级现有依赖。
2. **官方单飞跨热交接**：surface 测试双向覆盖无 footer→有 footer、有 footer→无 footer，进入 adjudicating 和 submitting 后分别切换，再点击另一个动作，原草稿与单飞保持且只有一次提交；官方完成后可再次发送。

夹具初次失败是浏览器没有 Node `process`（Vite library 模式保留 NODE_ENV），添加构建期定义后解决；后续一次失败是 ResizeObserver 尚未稳定时预采集 shown 数量，改为检查实时分区总量、唯一性及逐帧稳定性，没有为测试修改生产算法。

## 核心证据与尚未完成的上线步骤

核心补丁与报告分别在 [patch](../core/bar-footer/conversation-composer-footer.patch)、[core verification](../core/bar-footer/verification.md)。核心 706 项测试、静态浏览器几何检查、patch 前向/反向应用验证通过；**完整核心类型构建没有通过**：归档缺 Typert 生成的 Remote 声明。隔离包 bundler 虽 exit 0，仍有缺 workspace 产物警告，不能作为可直接部署的完整核心产物。

**当前 GUI 未改动、未部署、未刷新验收。** 没有修改 GUI 安装目录、用户 profile 或 Settings，没有启动替代服务器、重启 DSH、调用真实模型或发布 npm。离线浏览器用的是独立临时 Chrome profile，不是用户活动页。下一步须在完整 DSH 构建环境补齐生成物并完成干净构建，再通过正式部署入口更新核心和插件，最后在当前 GUI 验收独立行、左对齐、原统计行与窄屏折叠。不能用本报告冒充这一步已完成。
