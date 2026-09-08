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
- [Catalog Remote 改走 Settings base 层](./spec.md)（spec 第 17 节，无票据） — 已发布的 typert 生成器无法为单仓外的包生成 strict Remote 产物，用户据此修订第 6.2 节；该节优先级高于正文与第 15、16 节。
- [确定插件发布身份与许可证](./issues/20-choose-publishing-identity-and-license.md) — 正式采纳无 scope 的 `dsh-composer-quick-actions` 与 `dsh-composer-quick-actions-bundle`、初始版本 `0.1.0`、MIT（copyright holder lovvvve）；**暂不发布**——只定身份不推包，试用走本地 tarball，票据 17/18/21 不再被发布决策阻塞。已排除 `@deepseek-ai`（DeepSeek 官方 scope）与 `@dsh-plugins`（第三方社区 org）。
- [完成安装 bundle 与发布文档](./issues/17-finish-install-bundle-and-release-docs.md) — 发布身份落进两个 `package.json`（`0.1.0`、MIT、不设 `publishConfig`）；`./remote` 入口按 spec 第 17 节删除，公开面收为 `.`/`./client`/`./types`/`./package.json`；`dsh.client` 补全 `platform`/`inject`/`external`（provider 与平台种子逐个取证）；DSH peer 一律 `>=0.1.2-rc.1`，不虚构首个正式支持版本。顺带修掉 spec 第 15 节留下的打包缺陷：`tsc -b` 曾把整包第二份 JS 与坏 sourcemap 发进 tarball，改为只发声明并显式列举 `files`，另加 `prepack`。隔离 `DSH_HOME` 实测确认：两个 tarball 的可复现解析方式是 profile 级 pnpm `overrides` 指向功能包 tarball + `dsh plugin add` 指向 bundle tarball（同时 `add` 两个或分两步都会 404），安装后 `--dump-config` 可见 row 即重启激活证据，`remove` 可完整回退。四份中英文 README 覆盖 spec 第 12 节全部条目（含兼容矩阵）并单列命令发送动作；证据按第 13.1 节建入 `verification/release-evidence.md`。第 15 节另一条前置项「watch 关闭清理 staging」经核查不成立，拆为票据 22。真实 GUI 实测仍归票据 18。

## Not yet specified（尚未明确）

<!-- 当前没有仍处于迷雾中的范围；实施、验证、打包和文档均已毕业为正式票据。 -->

## Out of scope（范围外）

- 当前 DSH 进程重启后即消失的临时动态插件。
- 在 no-session、hero 或 takeover 消息编辑器周围显示快捷动作，或为此新增覆盖所有消息编辑器的外层通用 Slot。
- 首个版本中按 Agent、按 Preset 或按对话设置可见性规则。
- 首个版本中的跨设备同步、导入和导出。
- 快捷动作文本中的运行时变量、模板、任意脚本或其他生成内容。
- 命令面板或纯键盘宏系统等非按钮调用界面（`/` 开头的**命令发送动作**不属此列，首版支持）。
- 首版的插入动作、能力自适应投影与撤销/选区语义；待公共 `insertText` 可用后另建 effort，票据 10 的补丁保留为该 effort 的资产。
- [将 insertText 补丁集成到 DSH 官方发布](./issues/19-upstream-insert-text-and-record-release.md) — 官方当前不接受外部 PR。首版已整体不依赖该接口（spec 第 16 节），上游合并与插入动作一并留待未来独立 effort。
