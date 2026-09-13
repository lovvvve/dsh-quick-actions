# 交付 DSH 消息编辑器快捷动作

Label: `wayfinder:map`

## Destination（目标）

实现、验证并记录一个可安装的持久化 DSH 插件，在每个常规、由会话支持的常驻消息编辑器附近提供全局快捷动作。交付的插件支持作者拥有的预置快捷动作和用户拥有的自定义快捷动作。首版只提供发送动作：草稿未被占用时经公共 `setDraft` 写入静态文本，再由官方 `submit` 提交，可为每个动作单独设置发送确认；`/` 开头的命令发送动作确认默认开启但可关闭。所有用户数据通过 DSH 本地持久化跨重启保留。

## Notes（备注）

- 领域：DSH 消息编辑器交互与持久化 Cordis 插件交付。请使用 [`CONTEXT.md`](../../CONTEXT.md) 中的词汇。
- 本项工作明确涵盖执行、测试、打包和使用文档，并将其推进至全部完成；不会止步于可供实施的规格说明。
- 地图目标的收尾必须由用户本人明确回复“生产验收通过”，Agent 不得代为判定。
- 预置快捷动作为只读，但用户可以将其隐藏，或克隆为可编辑的自定义快捷动作。
- 首个版本中的所有快捷动作均为全局生效。
- 布局也是全局持久化设置：默认 `ribbon`（A，上方动作带），并可选择 `bar`（B，下方操作栏）或 `launcher`（C，单入口面板）。
- 正常状态下预置与自定义动作合计最多 50 个；升级导致既有状态被动超限时保留全部数据，但禁止新增和克隆，直到恢复到上限以内。
- **首版只交付发送动作，不提供插入动作，不新增任何 DSH 核心接口**；`/` 开头文本是合法的命令发送动作。完整契约与已知取舍见 [spec 第 16 节](./spec.md)——该节优先级最高，实施前必读，本地图不复述其细节。
- 在依赖 Cordis 的 Services、Events、Builtins、Slots 或 token 之前，请查阅 `cordis-plugin-development`；Inspect 结果是运行时契约的事实来源。
- Client `cordis_inspect_query` 调用只能由拥有活动 GUI 页面的前台父会话运行，然后再将结果传给研究代理。如果没有页面响应该子 Agent，后台子代理的查询可能会无限期保持等待；Host Inspect 和已打包源码的读取可在子代理中安全进行。
- GUI 验证只有一个通道：现有 `http://127.0.0.1:3080` 官方 DSH GUI。首版不依赖 `insertText`，因此不再需要隔离源码检出、补丁应用或第二个受管服务器。不得修改已安装 `node_modules`。
- 视觉交互工作请查阅 `prototype` 和 `frontend-design`，词汇发生变化时请查阅 `domain-modeling`，实施期间请查阅 `test-driven-development`，宣布交付完成之前请查阅 `verification-before-completion`。
- 工作区是位于 `main` 分支的 Git 仓库，`origin` 已配置为 GitHub 的 `dsh-quick-actions`（精确地址用 `git remote -v` 获取）。本目录下的本地 Markdown 是议题跟踪器，研究证据则隔离在 `research/<topic>` 分支上。
- 统一规格已汇总于 [`spec.md`](./spec.md)（baseline）；实现与验证工作以 spec 为准，正文与决策票据冲突时由 spec 第 1、15、16、17 节评估，其中**第 17 节优先级最高**，不再重开已关闭决策。

## Decisions so far（已有决策）

<!-- 这里只列出已关闭票据的索引，每项决策记录在对应票据中。
     少数决策由用户在会话中直接拍板、未经票据，其唯一归属是 spec 的对应章节，链接直接指向 spec。 -->

- [建立用于研究的版本化工作区](./issues/01-establish-versioned-research-workspace.md) — 已提交的本地 `main` 基线现在支持隔离的研究分支；无需远程仓库。
- [识别受支持的 DSH 消息编辑器扩展点](./issues/02-identify-composer-extension-seams.md) — 支持持久化 Client Slots 和官方提交流程，而按选区插入以及覆盖所有消息编辑器的放置方式仍需就产品/核心边界作出决策。
- [识别持久化配置和预置扩展点](./issues/03-identify-durable-configuration-seams.md) — Host Settings 应持有用户自有快捷动作和预置差异；不可变的预置快捷动作仍归软件包所有，并通过可向后读取的数据模式重写来弥补当前的迁移能力缺口。
- [制定快捷动作的数据结构与预置合并规则](./issues/05-specify-action-schema-and-preset-merge.md) — 采用稳定双来源身份、插入/发送判别联合、不可变预置与用户增量、统一引用顺序，以及带确定性修复的版本化存储。（`kind` 首版固定为 `'send'`，见 spec 第 16 节）
- [选择所需的 DSH 消息编辑器核心扩展](./issues/09-choose-required-dsh-composer-core-extensions.md) — 选择最小公共 `inputActions.insertText` 接口并将首版放置范围限定为常驻消息编辑器；能力缺失时不使用私有回退，插入动作按后续范围决策从 Composer 省略。（插入部分已由 spec 第 16 节取代；Resident Composer 放置范围仍有效）
- [确定运行时与失败语义](./issues/06-decide-runtime-and-failure-semantics.md) — 插入动作保留编辑上下文；发送动作只处理未占用草稿，按能力选择公共写入操作后沿官方提交路径按会话单飞，所有失败均采用无内容丢失的保守行为。（插入动作与斜杠命令两项已由 spec 第 16 节取代；未占用草稿、单飞与保守失败语义仍有效）
- [选择快捷动作的放置方式和管理流程](./issues/04-choose-placement-and-management-flow.md) — 默认使用与输入框等宽的上方单行动作带，并提供下方操作栏和单入口面板作为全局持久化选项，三者共享管理与确认面板。
- [选择插件架构与软件包契约](./issues/07-select-plugin-architecture-and-package-contract.md) — 采用双面功能包加安装 bundle、Host Settings 与只读目录 Remote、共享领域深模块、局部会话执行，以及仓库自有的可测试 Client 构建适配器。
- [定义验证与发布验收标准](./issues/08-define-verification-and-release-acceptance.md) — 发布要求全部新鲜自动化、安装与人工验收通过并保存证据；官方 DSH 覆盖兼容性抑制路径，能力环境覆盖完整插入路径，动作上限与被动超限均须无损。（双通道已由 spec 第 16 节取代为单通道；证据要求与人工验收门槛仍有效）
- [公开 DSH 消息编辑器 insertText 接口](./issues/10-publish-dsh-composer-insert-text-api.md) — 已产出经 TDD、构建、GUI 测试和独立审查、并重放到当前官方主线的核心补丁；它只证明能力路径，不冒充正式 DSH 发布版本。（已移出首版关键路径，见 spec 第 16 节；补丁保留为未来 effort 资产）
- [搭建可发布工作区与 Client 构建适配器](./issues/11-scaffold-workspace-and-client-build-adapter.md) — 已建立双面功能包、安装 bundle 与经真实 tsdown/ModuleLoader/watch 测试的 browser-only 单文件 Client 构建链路，业务逻辑仍留给后续任务。
- [汇总统一规格](./spec.md)（spec 第 15 节，无票据） — 各项存留边界收敛为 baseline 并落入实施票据。
- [首版范围收缩与斜杠命令处置](./spec.md)（spec 第 16 节，无票据） — 移除插入动作、取消全部核心接口新增、`/` 开头文本改为合法的命令发送动作；该节优先级高于正文与第 15 节。
- [实现快捷动作共享领域模型](./issues/12-implement-shared-quick-action-model.md) — 已交付纯 JSON 领域深模块：校验、预置目录合并与确定性 revision、Settings V1 解码与幂等规范化、`kind: 'send'` 恒写与非 `'send'` 数据的无损墓碑保留、`confirm` 透传、命令发送动作判定、投影与 50 项上限/被动超限、revision-fenced mutation 计划。Host/Client 装配仍属票据 13/14。
- [实现 Host Settings 与预置目录 Remote](./issues/13-implement-host-settings-and-catalog-remote.md) — 已交付 Host 配置合并与响亮失败、`composer-quick-actions` namespace 与 revision-fenced 幂等规范重写、内置预置初稿；目录发布通道按用户决策由自有 Remote 改为只读 Settings 命名空间的 composition `base` 层（spec 第 17 节）。
- [实现 Client 快捷动作控制器](./issues/14-implement-client-quick-actions-controller.md) — 已交付 Client 全局控制器：目录改读 Settings 命名空间的 `base` 层且目录 RPC 为 0，共享模型防御性解码；串行 revision-fenced 写入队列与插件内部判定的结构化写入结果（成功/拒绝/conflict/失败），不新增任何 DSH 核心接口；第 10 节的首次读取失败、只读、断线与重连语义；disposer 释放 mirror/scope 订阅与连接监听。真实 GUI 下读取 `base` 的实测归票据 18。
- [实现三种 Composer 界面与动作执行](./issues/15-implement-composer-surfaces-and-action-execution.md) — 已交付 `ribbon`/`bar`/`launcher` 三种布局、共享动作控件与每会话执行层：Resident Composer 判定改用 `conversation.composer.dock` 挂载作为公开信标（hero 不渲染该 dock，取证与测试见票据），杜绝 hero 渲染且不复刻私有 hero 公式；单飞锁由插件自持，关闭时机由公开 Input snapshot 的 `phase` / `draft` / `draftRev` 判定，同一 tick 重复激活只发送一次；发送前置条件覆盖 `draft`（含纯空白）、`imageIds`、`occurrences`，`queue` 明确不计，`blocked` 经 `ctx.get('conversation')` 公开读取而 `inject` 仍为第 7.3 节四项；最终重验、两步 `setDraft`+`submit`、无内容丢失的失败语义、等宽公式与窄布局密度、空投影下的紧凑管理入口、每 Slot 错误边界均已实现并测试。管理面板与共享可搜索动作面板仍属票据 16。
- [实现管理、动作面板与发送确认](./issues/16-implement-management-and-confirmation-ui.md) — 已交付集中式管理面板（预置排序/隐藏/恢复/克隆、自定义 CRUD 与启停、三种布局切换、50 项上限与被动超限警告、只读/写入拒绝/revision 冲突的分类 UX 与明确重试）、B/C 共用的可搜索动作面板（搜索只匹配标签与文本，NFKC + 小写 + 空白折叠，保持 `actionOrder` 相对顺序，规则由测试固定；布局自带的无搜索列表已删除），以及无动作类型选择器的自定义动作表单（命令发送动作只警示不锁定，绝不改写用户已设定的 `confirm`）。管理 overlay 独立注册为 `conversation.input.dock` 的第二个 cell 并按主会话单实例渲染；只有持续性只读用 `disabled`，其余一律 `aria-disabled` + 守卫，保证键盘重排不丢焦点。确认面板沿用票据 15 的每会话单飞契约，未新增第二把锁。真实 GUI 实测归票据 18。
- [采用 DSH UI primitives 的叶子控件](./issues/23-adopt-dsh-ui-primitives.md) — spec 第 8.4 节的 primitives 要求此前因「不可用」而未满足，[调研](./research/client-ui-primitives-availability.md)证明它由 web shell 的冻结 seed 表无条件提供。已把 19 处胶囊按钮换成 `Button`、chip 换成 `Pill`、搜索框换成 `Input` + 官方图标，`external` 与 `dsh.client.external` 同步声明；文本链接、面板列表行、`textarea`/checkbox 与 `aria-disabled` 态按 primitives 无对应导出保留自绘。**三个面板容器不改用 `Modal`**（锚定 popover 语义 + spec 第 13.3 节视觉基线；`ManagerPanel` 的 portal 化列为票据 18 之后的候选）。primitives 无 `forwardRef`，焦点与测量改由 `data-*` 标记寻址，收在 `modal.ts` 的 `useInitialFocusIn` 一处。测试侧需 `vitest` 内联该包才能处理其 CSS Modules。
- [首版接受样式作者格式偏离](./spec.md)（spec 第 18 节，无票据） — 第 8.4 节的 CSS Modules 一项按**作者格式**接受偏离：投递机制（运行时注入 `<style data-plugin-css>` + 内联字符串）与第一方插件逐字相同，差距只有手写字符串 vs `.module.css` 与前缀 vs hash 类名，用户不可见；实质要求由票据 23 的官方 primitives 与只用 `--dsw-alias-*` token 满足。改造需动 109 处类名引用并先核实 `@tsdown/css` 的单文件内联能力（未核实）。
- [Catalog Remote 改走 Settings base 层](./spec.md)（spec 第 17 节，无票据） — 已发布的 typert 生成器无法为单仓外的包生成 strict Remote 产物，用户据此修订第 6.2 节；该节优先级高于正文与第 15、16 节。
- [确定插件发布身份与许可证](./issues/20-choose-publishing-identity-and-license.md) — 正式采纳无 scope 的 `dsh-composer-quick-actions` 与 `dsh-composer-quick-actions-bundle`、初始版本 `0.1.0`、MIT（copyright holder lovvvve）；**暂不发布**——只定身份不推包，试用走本地 tarball，票据 17/18/21 不再被发布决策阻塞。已排除 `@deepseek-ai`（DeepSeek 官方 scope）与 `@dsh-plugins`（第三方社区 org）。
- [完成安装 bundle 与发布文档](./issues/17-finish-install-bundle-and-release-docs.md) — 发布身份落进两个 `package.json`（`0.1.0`、MIT、不设 `publishConfig`）；`./remote` 入口按 spec 第 17 节删除，公开面收为 `.`/`./client`/`./types`/`./package.json`；`dsh.client` 补全 `platform`/`inject`/`external`（provider 与平台种子逐个取证）；DSH peer 一律 `>=0.1.2-rc.1`，不虚构首个正式支持版本。顺带修掉 spec 第 15 节留下的打包缺陷：`tsc -b` 曾把整包第二份 JS 与坏 sourcemap 发进 tarball，改为只发声明并显式列举 `files`，另加 `prepack`。隔离 `DSH_HOME` 实测确认：两个 tarball 的可复现解析方式是 profile 级 pnpm `overrides` 指向功能包 tarball + `dsh plugin add` 指向 bundle tarball（同时 `add` 两个或分两步都会 404），安装后 `--dump-config` 可见 row 即重启激活证据，`remove` 可完整回退。四份中英文 README 覆盖 spec 第 12 节全部条目（含兼容矩阵）并单列命令发送动作；证据按第 13.1 节建入 `verification/release-evidence.md`。第 15 节另一条前置项「watch 关闭清理 staging」经核查不成立，拆为票据 22。真实 GUI 实测仍归票据 18。
- [让打包验证不再改写工作树](./issues/24-isolate-pack-from-the-working-tree.md) — 打包契约改为在**仓库外的 workspace 副本**里执行 `pnpm pack`，`prepack` 的 `rmSync('lib')` 与整条构建链随之搬进副本（包目录列表从 `pnpm-workspace.yaml` 的 glob 推导，依赖用 symlink 指回已安装位置，副本不需要 install；副本仍是 pnpm workspace，`workspace:*` 替换与根 `LICENSE` 带入因此照旧成立）。工作树 `lib/` 在 `pnpm test` 前后内容与 mtime 均不变，并由 `packing isolation` 三条断言固定（指纹含 mtime、副本必须在仓库外、packed 产物必须是副本本次构建的）。刻意失败的测试不再让线上 bundle 消失，`pnpm watch:client` 与 `pnpm test` 可以并存（已实测）；票据 18 的最后一项 `Blocked by` 解除。
- [清理 watch 关闭后遗留的 Client staging 目录](./issues/22-clean-client-staging-on-watch-close.md) — spec 第 11.2 节的关闭清理前置项已补齐。清理点不挂关闭时机（tsdown 进程退出时没有关闭钩子，`Symbol.asyncDispose` 只在配置重载时跑，`q`/SIGINT/SIGTERM 直接终止 watcher），而是让 scratch 目录不再参与发布：产物由 `generateBundle` 捕获到内存，`onSuccess` 才原子写入 `lib/`，scratch 在每次构建开始与 `closeBundle` 时无条件删除。取证纠正了两个假设——失败构建是**先写盘后失败**（`failOnWarn` 事后升级，`buildEnd`/`renderError` 拿不到错误），而 `write: false` 在 watch 模式被忽略（坏产物会直接写进 `outDir`），故 `outDir` 仍指向同级 scratch。原子发布未被削弱：失败时 `lib/` 上一次完整成功产物原样保留，四条用例加两次变异校验固定，新增耗时约 0.4s。

- [执行集成与发布验证](./issues/18-run-integration-and-release-verification.md) — 自动化证据完整，第 13.2 节行为矩阵在模型 / Host / Client 三层加真实 GUI 全部有归属。分四轮在**用户自己的实时 DSH** 上开临时安装窗口（每轮收尾卸载并逐字还原）：① 安装形态按 README 离线流程逐条执行、Catalog `base` 端到端、常驻判定、三布局、等宽误差 0.0px、窄视口与无障碍；② 规模矩阵 0/1/6/25/50 与 53 项被动超限、跨 DSH 重启持久化；③ 发送路径六条（经用户许可的真实模型调用）——确认面板与取消零发送、命令动作两种确认设置、**同 tick 重复激活只发一次**、模型运行期由官方 queue 承接、占用草稿不覆盖、断线只读与失败草稿保留、Host `Config.presets` 变化到达 Client、生命周期无重复注册、9 张裁剪截图基线；④ 重装恢复（卸载保留命名空间、重装即回）、预置往返四段（新增 → 墓碑 → 重新加入恢复偏好与文案更新 → 行为签名换 ID）、revision **conflict** 分支（DSH 的 settings 镜像跨连接实时同步，故冲突以两连接同瞬写入的真实竞态取得；失败方刷新到权威值并可显式重试）、占位符拒绝与 Unicode code point / `trim()` 口径。安装窗口本身已脚本化（`tests/gui/install.sh` + `close-window.sh`，profile 两文件 sha256 逐条校验）。三处用户可见的边缘状态反馈缺口记录在案，其中两处立为票据 25，均不阻塞票据 21；唯一未逐字执行的是「override 与 `add` 指向另一个版本」——两个包按票据 20 暂不发布，本地只有 `0.1.0`。
- [补齐两处边缘状态的用户可见反馈](./issues/25-close-two-edge-state-ux-gaps.md) — 两处一并定案。**缺口 2 已修**：管理表单像其他三个面板一样接管开场焦点（光标进标签框）并把焦点还给打开它的控件，第一下 Escape 只退出表单、第二下才关面板；`useFocusReturn` 为嵌套面板加了「焦点已离开本面板则不抢回」的规则，`ActionForm` 按目标 `key` 重挂载。**缺口 1 不改运行时行为**：对 `dsh-client-ui-conversation@0.1.2-rc.1` 的源码取证推翻了票据 18 的成因记录——`submit()` 没有连接态检查，普通文本一律同步乐观清空，引擎据此按 spec 9.5 正常关闭单飞，文本由 DSH 自己的 `restoreFailedDrafts` 放回并伴随 DSH 的 error notice；超时判定不可达且被 9.5 禁止，连接态门禁违反第 10 节「允许执行」且比原生发送按钮（`disabled` 不含连接态）更严。行为以假 Composer 的 `holdSink`/`failHeldSinks()` 建模并用 4 条单元用例固定。`pnpm test` 496 通过；两条新增 GUI 断言留待票据 21 的安装窗口。

- [执行最终人工验收](./issues/21-run-final-human-acceptance.md) — **地图目标已达成**：用户于 2026-09-09 明确回复「生产验收通过」。用户要求「你来验证」，故 spec 第 13.4 节步骤 1–8 由 Agent 在其实时 DSH 的一次性窗口里逐条驱动（新增 `tests/gui/acceptance.spec.ts` + `acceptance-round.sh`，19 张裁剪截图），第 9 步仍由用户本人说出。窗口内先在最终候选提交上重跑全部无模型调用的既有 round（13 次 profile 启动零失败零重试），票据 25 留下的两条断言首次在真实 GUI 成立。步骤 1–8 全过：三布局 × 三视口等宽误差**均为 0.00 px**、命令动作两种确认设置都由 DSH 裁决、占用草稿禁用且草稿逐字保留、刷新 / 重启 / 卸载 / 重装后配置逐项恢复、Escape 两级作用域与可访问名称符合 spec 8.3/8.4。**未花费真实模型调用**（三次真实提交都是交给 DSH 裁决的未知命令）。唯一新发现是 shell 侧栏把手压住管理表单的 13px 复选框（点开关文字与键盘均正常），按第 13.1 节不阻止发布，立为票据 26。收尾窗口已关闭，用户 profile 与开窗前字节一致。

## Not yet specified（尚未明确）

<!-- 当前没有仍处于迷雾中的范围；实施、验证、打包和文档均已毕业为正式票据。 -->

## Open after the destination（目标达成后新开）

<!-- 地图目标已于 2026-09-09 达成。以下是其后新开的项。 -->

- [合并为单包](./issues/28-merge-into-a-single-package.md) — **已 resolved**。推翻票据 07 的双包架构：本机 profile 里七个第三方 DSH 插件全是单包，同一个包兼载 `dsh.bundle.patch` 与 `dsh.client`、patch 行的 `name` 指向自己；票据 07 从未给出必须拆开的理由。安装 bundle 已并回功能包，`dsh-quick-actions` 成为唯一发布单元，离线安装由「两个 tarball 加一条 profile `overrides`」缩为一条命令。装载条目 id 与两个 Settings 命名空间按 spec 第 19.2 节不动，变更记在 [spec 第 20 节](./spec.md)。

- [发布到 npm 并在插件市场上架](./issues/27-publish-to-npm-and-list-in-market.md) — **开放中**。用户决定真正推包，本票据推翻票据 20 的「暂不发布」。发布前先把包名缩短为与仓库同名 **`dsh-quick-actions`**（[spec 第 19 节](./spec.md)；上面票据 20 那行记的是当时的旧名，原文保留），随后票据 28 又把安装 bundle 并了回来，**现在只有这一个包**。改的只是发布单元与名字，Cordis 装载条目 id 与两个 Settings 命名空间不动。安装走 npm、发现走策展仓库的 PR，两条通道分开：上架 PR 已提交（[awesome-dsh-plugin#4762](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/4762)，提交前用其自带 `check-submission.mjs --base` 预检通过）；npm 发布则被撤回冷却挡到本地 2026-09-11 00:45。本票据原本唯一的实质未知——从 registry 装能否收敛成一条命令——已由 `0.1.0-rc.1` 在全新 `DSH_HOME` 上验为「能」，但那验的是双包形态，单包下需复验。

- [跟进 DSH 0.1.5-rc.1 的 Input 契约变更](./issues/29-follow-dsh-input-contract-change.md) — **已 resolved**。DSH 在两个 rc 之间把 Input 契约的 image 词汇整体换成 attachment，被 spec 第 9.5 节钉为单飞唯一判据的 `imageIds` 改名为 `attachmentIds`，插件整个表面崩进错误边界。定案**只支持新契约**、不留回退，peer 下界提到 `>=0.1.5-rc.1`（[spec 第 21 节](./spec.md)）。改名清单以两版 `input.d.ts` 的逐行 diff 为准——原判断「其余字段不变」不成立。证伪了两条既有判断：rc 阶段不破坏公开契约，以及 `>=x-rc.n` 能覆盖后续预发布（node-semver 实测不能，形状按用户定案保留，只改文档措辞）。加两道闸门：`isOccupiedDraft` 改总读（下次改名降级为动作不可用而非崩溃）、`tests/client/contract.spec.ts` 用 `expectTypeOf` 把手写契约钉在已发布声明上（本次事故正因两侧同步移动而测试全绿）。开发树用 `overrides` 统一版本线，`dsh-client-ui-primitives` 是唯一例外（其 0.1.5-rc.1 是依赖声明被删空的坏包）。用户 2026-09-11 在实时 DSH 上确认通过。

- [让 npm 包与市场条目的仓库关联起来](./issues/30-link-the-npm-package-to-the-listed-repo.md) — **开放中**。上架 PR 合入后从市场点安装必定失败，报「构建脚本被 pnpm 默认拦截」，点「放行构建脚本并重试」又回 `no installed packages given`。三段链条都不在运行时代码里：线上目录里本条目 `npm` 为 null → `installTargetFor` 退回 `github:` 源 → git-hosted 依赖必须 prepare，pnpm 11 默认拦截；而 approve-builds 路由要按名字反查条目才能生成 allowBuilds key，本条目 `name` 带 `#composer-quick-actions` 后缀、`npm` 又为 null，两个分支都不命中，因此那个按钮对本条目结构上点不通。根因在我们自己：策展仓库的 npm 映射**不接受手写**，由 `probe-npm.mjs` 拿已发布 manifest 的 `repository` 字段反向核对仓库归属，而我们发布的包从来没有这个字段。已补 `repository`（含子包 `directory`）/`homepage`/`bugs` 并钉成打包契约断言（先验红再转绿）。顺带澄清：GitHub 源对本仓库**永远**装不成——`lib/` 是构建产物、devDep 有 `workspace:*`、构建挂在 `prepack` 而非 `prepare`，所以不值得去修那条路。用户已于 2026-09-13 发布 `0.1.0-rc.4`（先发 rc 不占 `0.1.0`，因为这条链路只能发布后才验证得了），registry 上 `dist-tags.latest` 指向它且 `repository` 就位，按 `probe-npm.mjs` 原样逻辑本地复跑得到 `linked`。**剩下只能等**：翻转发生在策展仓库 `build-site.yml` 的 nightly（cron `23 2 * * *` UTC = 本地 10:23，只有它设 `PROBE_ALL=1`），push 构建明确跳过 probe，dispatch 我们无权触发；该 workflow 自注警告这条 cron 常被延迟或被 merge 取消，可能要多等一晚。验收观测点是 `plugins.json` 里本条目的 `npm` 变成非空。

- [把管理面板 portal 到 body](./issues/26-portal-the-manager-panel.md) — **已 resolved**。`ManagerPanel` 与其 backdrop 经 `createPortal` 渲染到 `document.body`，`z-index: 31` 从此在页面自身的层叠上下文里排序；以 body 为目标而非自建容器，dispose 不泄漏由构造保证。`react-dom` 是 shell 冻结 seed 表条目，加进 `external` / `dsh.client.external` / peer 三处后不引入第二份渲染器。焦点与 Escape 两级作用域无回退（portal 只搬 DOM 不搬 React 树）。`pnpm test` 498 通过；新增机制无关的 `tests/gui/stacking.spec.ts`（遍历面板控件做 `elementFromPoint`），第二轮三视口全过，场景正是票据 21 失手的编辑表单。**按用户定案只做管理面板**：两个锚定 popover 仍在 dock 子树内、带着同一根因，未观察到用户可见症状，不得记成已解决。

## Out of scope（范围外）

- 当前 DSH 进程重启后即消失的临时动态插件。
- 在 no-session、hero 或 takeover 消息编辑器周围显示快捷动作，或为此新增覆盖所有消息编辑器的外层通用 Slot。
- 首个版本中按 Agent、按 Preset 或按对话设置可见性规则。
- 首个版本中的跨设备同步、导入和导出。
- 快捷动作文本中的运行时变量、模板、任意脚本或其他生成内容。
- 命令面板或纯键盘宏系统等非按钮调用界面（`/` 开头的**命令发送动作**不属此列，首版支持）。
- 首版的插入动作、能力自适应投影与撤销/选区语义；待公共 `insertText` 可用后另建 effort，票据 10 的补丁保留为该 effort 的资产。
- [将 insertText 补丁集成到 DSH 官方发布](./issues/19-upstream-insert-text-and-record-release.md) — 官方当前不接受外部 PR。首版已整体不依赖该接口（spec 第 16 节），上游合并与插入动作一并留待未来独立 effort。
