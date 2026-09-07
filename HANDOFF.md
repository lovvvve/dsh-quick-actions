# DSH Quick Actions：跨对话交接

> **⚠️ 本文件是 HEAD 为 `5c4b742` 时的时点快照，其后范围已变更。正文保留原样作为交接记录，不代表当前有效结论。**
>
> 当前有效结论以 [`spec.md` 第 16 节](.scratch/dsh-composer-quick-actions/spec.md)（优先级最高）与根目录 [`CLAUDE.md`](CLAUDE.md) 为准。相对本文件，以下已经改变：
>
> - **首版不新增任何 DSH 核心接口**：`insertText` 与「最小公共提交凭据」两侧都不做。本文件第 70 行把提交凭据列为待核对缺口，**已取消**（spec 第 16.4 节），单飞窗口改用既有公开状态实现。
> - **首版不提供插入动作**，因此不存在能力自适应、兼容性抑制投影或能力矩阵。本文件「关联对话：上游集成与能力自适应」一节描述的规则**已整体作废**——但其中「不要恢复旧版『缺少插入能力时显示禁用插入按钮』」的告诫仍然成立，只是首版连插入动作本身都没有。
> - **GUI 验收收敛为单通道**（现有 `http://127.0.0.1:3080`），不再需要隔离源码检出、补丁应用或第二个受管服务器。
> - `/` 开头文本改为**合法的命令发送动作**，确认默认开启但可关闭。
> - 第一步阅读顺序中的「spec 第 1、15 节」应改为**第 1、15、16 节**。
> - Git 现状：`origin` 已配置，HEAD 已前进；本文件的 Git 段落不再准确。

## 给新 Agent 的第一步

这是进行中的持久化 DSH 插件项目，不是已完成产品。请先保留工作树，再按顺序读取：

1. [仓库指令](AGENTS.md)与[本地议题跟踪约定](docs/agents/issue-tracker.md)。
2. [统一规格 baseline](.scratch/dsh-composer-quick-actions/spec.md)，尤其第 1、15 节：这些是另一对话在脚手架完成后收敛的新要求。
3. [Wayfinder 地图](.scratch/dsh-composer-quick-actions/map.md)与[领域词汇](CONTEXT.md)。
4. 本轮准备执行的票据及其引用，不必重新阅读所有历史讨论或重新设计已定方案。

用户要求默认中文沟通。Wayfinder 在本项目明确包含执行交付；每轮只领取和解决一张非研究票据，先检查 frontier/claim，避免与其他会话重复工作。界面讨论不用弹窗问答；产品自身的管理/确认模态框仍可使用。

## 信息覆盖与可信度

本交接综合了主对话的完整实施过程、已返回的子代理审查结果，以及本次实际读取的另一对话产物 `spec.md`、`upstream-integration-status.md`、最新地图和 CONTEXT。没有声称遍历或导出所有 DSH 顶层对话原文。

已取得可联系的 Side 对话只读摘要：该线程仅解释双面功能包与安装 bundle 的区别，没有新增用户决策、文件修改或后台任务。其摘要停留在较早架构讨论阶段，提到的未答问题及未完成核心接口已被后续票据与统一规格更新，不应倒退采用。其他独立顶层对话未直接读取原文，以下通过本次实际读取的工作树产物汇总。历史研究/翻译子代理的持久结果以研究文档和已关闭票据为准，不重新启动研究。

敏感信息不在这里复制；本文件不包含凭据、个人邮箱、真实会话内容或机器上的私人绝对目录。

## 当前 Git 与保存状态

交接检查时：

- 分支 `main`，HEAD 为 `5c4b742`。
- `origin` 已按用户要求配置为 GitHub 的 `dsh-quick-actions` 项目。精确地址使用 `git remote -v` 获取；本会话没有执行 push。
- 仓库目录名仍为 `dsh-plugins`，没有执行本地重命名。
- 产品展示名 **DSH Quick Actions** 只是主对话建议，用户尚未正式确认 npm 发布身份。远程仓库名称不等于包名或许可证决策。
- 地图仍有“没有远程仓库”的旧说明，现已不准确；下一次整理地图时应更新。

**重要：当前工作树包含另一对话尚未提交的规格、范围修订和补丁。不要 reset、clean、全量覆盖或直接 `git add .`。** 这些文件比 HEAD 更新，是切换 Agent 时必须带走的工作成果。

受影响范围由 `git status --short` 实时核验，交接时包括：

- `CONTEXT.md`、地图、运行时/架构/验收/核心接口及后续实施票据；
- 未跟踪的 [统一规格](.scratch/dsh-composer-quick-actions/spec.md)；
- 未跟踪的 [当前上游状态](.scratch/dsh-composer-quick-actions/core/upstream-integration-status.md)；
- 未跟踪的 [当前基线核心补丁](.scratch/dsh-composer-quick-actions/core/0001-expose-public-text-insertion-dsh-v0.1.3-alpha.1.patch)。

新 Agent 如果仅 clone 远程，不会自动得到这些未提交文件。移交应保留整个当前工作目录，或先经用户确认逐项提交/归档这些成果。本次交接不代替它们提交，也不推送。

## 不同对话的工作索引

### 主对话：研究、交互决策、核心补丁与脚手架

研究与决策集中在[地图](.scratch/dsh-composer-quick-actions/map.md)的已解决票据及 `research/` 目录。不要重复原型迭代或重新讨论默认布局、动作数量等已关闭决策。

- [核心 insertText 任务](.scratch/dsh-composer-quick-actions/issues/10-publish-dsh-composer-insert-text-api.md)：完成源码补丁、TDD、构建和审查；[原始验证记录](.scratch/dsh-composer-quick-actions/core/insert-text-verification.md)保存复现依据。
- [工作区与构建适配器任务](.scratch/dsh-composer-quick-actions/issues/11-scaffold-workspace-and-client-build-adapter.md)：已解决，源码位于 `packages/` 和 `tools/dsh-client-bundle/`。
- 实施提交索引：`9f3dcf7` → `34c5072` → `23c0334` → `621195d` → `5a62944`；票据收尾为 `5c4b742`。

实际产品仍只有无业务行为的 Host/Client 骨架。空 `apply`、types/remote 占位入口不是已经实现的领域模型、Settings、Remote、控制器或界面。

### 关联对话：上游集成与能力自适应

事实、精确版本、补丁哈希与执行记录见[上游状态](.scratch/dsh-composer-quick-actions/core/upstream-integration-status.md)，范围处置见[上游集成票据](.scratch/dsh-composer-quick-actions/issues/19-upstream-insert-text-and-record-release.md)。

该对话把核心补丁重放到较新官方基线并记录验证；官方合并不再阻塞首版，已列为当前地图范围外。没有已合并 PR 或正式首发版本可宣称。不要用旧交接中“等待官方发布”的说法重新阻塞产品。

最新能力自适应规则应直接遵循 spec，而不是历史票据最早的答案；尤其不要恢复旧版“缺少插入能力时显示禁用插入按钮”的行为。

### 关联对话：统一规格收尾

[spec 第 15 节](.scratch/dsh-composer-quick-actions/spec.md)记录新增核心依赖和尚待落地的票据缺口。虽然脚手架任务已经关闭，**不能据此宣称满足了后来新增的全部发布要求**。

继续前重点核对以下工作是否已有实施票据，不要默默跳过：

- SettingsScope 的结构化写入 outcome；
- 支撑既定发送单飞窗口的最小公共提交凭据；
- Resident Composer 的公开判定与第三方 Catalog Remote 实际装配方式；
- 构建产物 JS/map 跨代一致性及 watch 退出后的 staging 清理；
- 最终用户验收的 HITL 归属。

这些是规格新要求/实施责任，不是本会话已经完成的功能。详细边界与映射以 spec 第 15 节为唯一参照。

### 子代理审查

构建适配器经历多轮独立审查，问题及修复均保存在提交和真实产物测试中。最后针对 `5a62944` 的审查无 Standards/Spec findings；它验证的是当时脚手架票据范围，**不是后来完整 spec 的整体验收**。

一次审查子代理误在主工作区运行 install/typecheck，可能刷新 gitignored 产物。后来重新执行了本会话验证。后续审查需明确禁止修改主工作区，使用隔离临时归档，不要让审查代理操作并发票据。

## 已验证与尚未验证

本会话最终脚手架验证结果（历史证据，不替代下一轮新鲜验证）：

- `pnpm test`：12/12，通过真实 tsdown 构建、fake ModuleLoader、sourcemap 和 watch 路径。
- `pnpm typecheck`：通过，含生产、测试及构建配置。
- `pnpm lint`：0 warning / 0 error。
- 清理功能包输出后 `pnpm build`：通过。
- 两个 tarball 解包 smoke：exports 存在、Host 可导入、Client factory 可执行、bundle dependency 和 patch 正确。

没有完成真实插件安装/重启 GUI 联动、业务功能集成或最终生产验收。当前 GUI 未因本项目构建自动更新。本会话没有保留正在运行的服务器或 build watcher；其他会话的后台任务应另行检查。

## 推荐继续路线

1. 先确认其他会话已停止写入，保存当前未提交成果；核验最新规格与票据的一致性。
2. 按地图重新查询 frontier。上次正常的下一项 AFK 是[实现快捷动作共享领域模型](.scratch/dsh-composer-quick-actions/issues/12-implement-shared-quick-action-model.md)。
3. [确定发布身份与许可证](.scratch/dsh-composer-quick-actions/issues/20-choose-publishing-identity-and-license.md)可由用户并行决定；不要代填许可证或把 `0.0.0` 当正式版本。
4. 对 spec 第 15 节明确提出但未落入独立任务的核心能力/验证缺口，按 Wayfinder create-then-wire 方式补齐，避免仅修改 prose 就宣布实现。
5. 后续领域行为用 TDD 实施；只提交自己负责的文件或 hunks。

## 运行环境与常见陷阱

- 用 `pwd` 定位项目。DSH 部署目录和官方源码临时检出都不是本项目。
- 不修改安装版 `node_modules`；核心补丁在隔离官方源码检出验证。
- 现有 GUI 为 `http://127.0.0.1:3080`。新测试服务器不是现有 GUI；启动前遵守当前用户授权和运行环境要求。
- 不把项目 `watch:client` 等同于 DSH GUI HMR；同一 DSH checkout 的 watcher 与页面加载关系必须验证。
- Client Inspect 只能由有活动 GUI 的前台父会话调用。历史后台子代理因没有页面响应曾无限等待。
- 持久化功能包不是 dynamic Cordis Plugin；不得改成仅当前进程存在的插件来替代交付。
- 插件构建适配器是受控依赖的构建约束，不是恶意代码沙箱；不要无边界扩张安全模型。

## Suggested skills（建议技能）

按新 Agent 当前实际可用目录调用 Skill 工具；名字缺失时读取项目文档或请用户提供对应流程，不要虚构可用工具。

- `test-driven-development`：所有后续实现与 bug 修复。
- `domain-modeling`：领域术语、模型与 CONTEXT。
- `executing-plans`：依据现有票据实施。
- `requesting-code-review` / `receiving-code-review`：独立审查与实证修复。
- `verification-before-completion`：关闭票据前新鲜验证。
- `systematic-debugging`：构建、测试或运行时失败。
- `editing-cordis-compositions`：写 composition / bundle patch 前。
- `cordis-plugin-development`：需要查运行时契约时，仍以持久化包交付。
- `grilling` + `domain-modeling`：发布身份等 HITL 决策。
- `frontend-design`：后续正式 UI；已有原型决策不重开。

用户可再次调用 Wayfinder 并提供地图；此流程在本项目有明确的执行范围覆盖。
