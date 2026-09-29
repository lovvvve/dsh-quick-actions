# 将下方操作栏放到独立且与输入框左对齐的一行

Type: task
Status: resolved
Labels: ready-for-human
Blocked by: none

## Question

如何让 bar 布局位于统计行下方、独占新行，并使其左边缘与输入框左边缘对齐，同时保持统计信息与用量指示器原位、保留窄屏折叠与其他布局行为？

## Comments

- 用户提供当前 bar 与统计信息并排的截图，明确要求更下面新启一行；最终纠正为「左对齐输入框」，并同意立票据实施。
- 该新决定替代原 spec 22.9 中接受居中且随内容收缩的 dock 行放置决定；不授权发布 npm、重启 GUI 或修改已安装依赖。
- 先检查现有公开扩展点。如独立行需要新增核心接口或私有 DOM 改写，将先报告边界，不擅自扩展范围。

## Investigation

当前 DSH 安装目录只有已构建的软件包，并非包含 `packages/` 的源码树。只读检查 `@deepseek-ai/dsh-client-ui-conversation/lib/client.js`：

- 16224–16234：`conversation.input.dock` 在 composerStack 中位于整个 inputBar 之前。
- 17536–17542：`conversation.composer.dock` 与 ContextMeter 同处 InputBar 的 dock 行，后面没有独立 footer Slot。
- 18216–18255：composer bar 声明的子 Slot 也没有下方独立行出口。
- 插件当前 `src/client/surfaces/entries.tsx` 用 composer dock 同时承担常驻信标与 bar 渲染；input dock 渲染 ribbon/launcher。

因此这不是给当前 bar 增加 margin 就能完成的局部修复。可选路线需要明确：DSH 提供独立下方 Slot（保持 DOM 与视觉顺序一致），或者插件依赖宿主布局结构重新排序/搬移 DOM。后者增加私有结构耦合；仅用 CSS order 把 input dock 移到下方还会使键盘顺序与视觉顺序不一致。用户随后回复「继续」，已允许把范围扩展到 DSH 核心扩展点。仍不修改已安装依赖。

### 继续调查：源码前置条件

- 配置给出的 DSH 路径仅有 `node_modules`、`package.json`、`package-lock.json`；manifest 名为 `deepseek-harness-pkg`，依赖 `@deepseek-ai/dsh@0.1.7-rc.2`。它是部署目录，不是可构建源码检出。
- `/Users/lovvvve/src/` 直接子目录中未找到 DSH 源码；用户目录全局文件检索超时，不能据此断言本机没有其他源码。
- 上游 Git HEAD 查询持续无响应，已取消；raw.githubusercontent.com 的 InputBar 源文件读取也超时。没有取得可修改、测试的核心源码，未尝试改写打包产物。
- 此阶段需要 DSH 源码，尚未实现，也未更新线上 GUI。

### 源码阻塞已解除

- 找到本机 `/Users/lovvvve/deepseek-harness`，工作区干净但 HEAD 为旧的 `0.1.2-alpha.2`，未切换或修改其工作区。
- 系统代理为 `http://127.0.0.1:9999`。通过代理成功查询当前安装版本对应的 tag `dsh-v0.1.7-rc.2`，提交 `477b4f420553e8a52c2fbccc464d7561b239c443`。
- git fetch 因 partial transfer / early EOF 失败，改从 GitHub codeload 下载同一提交的源代码归档成功（exit 0），解压到 `/tmp/dsh-footer-source.gZQq0j/deepseek-harness-477b4f420553e8a52c2fbccc464d7561b239c443`。
- 该版本 `packages/client/ui-conversation/src/client/skeleton/InputBar.tsx:499–505` 确认统计 dock 是根容器最后一个子项，可在其后增加独立 footer；当前没有改源码。
- 新接口跨越核心与插件，提升为架构契约变更，设计见 [下方操作栏独立行设计](../bar-footer-design.md)。用户再回复「继续」，确认旧核心保留原位置的兼容处置。

## Answer

**源码实施与可重复应用的核心补丁已完成；未上线、未进行当前 GUI 验收。** 本票据按实现交付结项，`ready-for-human` 表示下方部署边界仍需处理，不表示页面已经改变。

- 核心新增 `conversation.composer.footer`（session list / no owner props），放在原统计 dock 后并与输入卡片等宽；原 dock 与 ContextMeter 不变。精确基线、测试和应用方式见[核心补丁验证报告](../core/bar-footer/verification.md)，产物是[核心 patch](../core/bar-footer/conversation-composer-footer.patch)。
- 插件注册可选 footer，每会话实际挂载后抑制原 dock 的 bar，无 footer 的旧核心保持原位置。新行按钮组从输入框左边缘开始，窄屏折叠、加宽恢复，ribbon/launcher 不产生空 footer。没有数据迁移或版本号/peer 变更。
- 核心 706 项聚焦回归通过；插件 506 项全套测试、两遍 typecheck、lint、build 通过；4 项离线浏览器检查通过，其中一项用真实 React 表面、官方 primitives 与 ResizeObserver 检查反复缩放和逐帧稳定。
- 独立只读审查未确认实现缺陷，提出的真实测量循环、发送中热交接两项测试缺口已补齐。细节见[插件验证记录](../verification/footer-plugin.md)。规范更新为 spec 第 23 节。

### 部署前的明确剩余工作

**后续更新**：[打通独立操作栏核心补丁的构建前置条件](./41-unblock-footer-core-build.md) 已解决下述生成物与包构建问题，并准备了本地 tarball。当前 GUI 部署与验收仍未完成；下段是本票据结项时的历史状态。

核心归档缺少 Typert 生成的 Remote 声明，完整类型构建未通过；孤立包 bundle 仍有 workspace 产物缺失警告。须先在完整核心构建环境补齐生成物并完成干净构建，再经正式部署入口安装核心与本插件，最后在当前 GUI 验收。未修改已安装依赖、profile、Settings，未重启/另起服务器，也未发布 npm。**仅装本插件会继续显示旧位置，不会自动安装核心补丁。**
