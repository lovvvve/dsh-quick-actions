# DSH 消息编辑器快捷动作规格

- Status: baseline（发布身份仍由票据 20 决定；实施边界已收敛）
- Map: [`map.md`](./map.md)
- Domain language: [`CONTEXT.md`](../../CONTEXT.md)
- Publishing decision: [`issues/20-choose-publishing-identity-and-license.md`](./issues/20-choose-publishing-identity-and-license.md)

## 1. 目的与规范解释

本规格定义首版 Composer Quick Actions（消息编辑器快捷动作）的产品行为、数据契约、Host/Client 边界、兼容策略、打包方式与发布门槛。实现、测试、安装包和中英文文档必须共同满足本规格。

文中的“必须”“不得”是发布硬要求。决策票据保留研究和取舍过程；本文件汇总其当前有效结论。较早票据中与后续评论或[票据 19](./issues/19-upstream-insert-text-and-record-release.md)冲突的“旧版插入动作显示为禁用”“首版等待正式上游版本”等内容均已被本规格中的能力自适应契约替代。第 15 节记录了规格收尾时的最终决定与票据映射；正文其余部分不得重新打开已关闭决策。

## 2. 目标与范围

### 2.1 目标

交付一个可安装、可升级、可卸载的持久化 DSH 插件，并在每个常规、由会话支持的 Resident Composer（常驻消息编辑器）附近提供全局快捷动作。首版必须支持：

- 作者拥有、用户只读的 Preset Quick Action（预置快捷动作）；
- 用户拥有的 Custom Quick Action（自定义快捷动作）；
- 在公共插入能力可用时执行 Insert Action（插入动作）；
- 始终通过公共 Composer 路径执行 Send Action（发送动作）；
- 每个发送动作独立的确认策略；
- 三种全局快捷动作布局；
- 用户动作、顺序、预置差异和布局跨 DSH 重启持久化；
- 管理、错误恢复、兼容性降级、测试、打包和双语文档。

### 2.2 首版范围

- 快捷动作、动作顺序、可见性和布局均为全局状态。
- 只在 Resident Composer 中渲染；恢复到常驻消息编辑器后自然重新出现。
- 动作内容是静态纯文本，不解释变量、模板或脚本。
- 插件属于全局 Host composition，不进入 Agent preset。

### 2.3 范围外

- 当前 DSH 进程结束后即消失的临时动态插件；
- no-session、hero 或 takeover 消息编辑器，以及为它们新增外层通用 Slot；
- 按 Agent、Preset 或会话设置可见性；
- 跨设备同步、导入或导出；
- 运行时变量、模板、任意脚本或生成内容；
- 命令面板、纯键盘宏或斜杠命令型发送动作；
- 把 `inputActions.insertText` 补丁合并进 DSH 官方发布并记录正式首发版本；该工作未来另建独立 effort。

## 3. 领域行为

领域词汇以根目录 [`CONTEXT.md`](../../CONTEXT.md) 为准。以下三种投影状态必须严格区分：

| 状态 | Composer 中 | 管理界面中 | 形成原因 |
|---|---|---|---|
| Hidden Quick Action（隐藏快捷动作） | 不显示 | 显示且可恢复 | 用户隐藏预置或停用自定义动作 |
| Unavailable Quick Action（暂不可用快捷动作） | 显示为禁用并说明原因 | 显示 | 当前草稿、原生 guard 或临时编辑器状态不允许执行 |
| Compatibility-Suppressed Insert Action（兼容性抑制插入动作） | 不显示，也不进入可搜索执行面板 | 完整显示、可配置 | 当前 `InputActions` 缺少公共 `insertText` 能力 |

兼容性抑制不是用户可见性偏好，不得写回 Settings；能力恢复后，相同动作必须按原顺序自动恢复。

## 4. 数据契约

### 4.1 动作类型

规范化后的领域类型为：

```ts
type PresetActionId = string
type CustomActionId = string

type PresetQuickAction =
  | {
      id: PresetActionId
      kind: 'insert'
      label: string
      text: string
      icon?: string
    }
  | {
      id: PresetActionId
      kind: 'send'
      label: string
      text: string
      icon?: string
      confirm: boolean
    }

type CustomQuickActionValue =
  | {
      kind: 'insert'
      label: string
      text: string
      icon?: string
      enabled: boolean
      clonedFromPresetId?: PresetActionId
    }
  | {
      kind: 'send'
      label: string
      text: string
      icon?: string
      confirm: boolean
      enabled: boolean
      clonedFromPresetId?: PresetActionId
    }

type QuickActionRef =
  | { source: 'preset'; id: PresetActionId }
  | { source: 'custom'; id: CustomActionId }
```

- Preset Action ID 由作者分配，是永久、包作用域且不随标签、文本或顺序变化的身份。
- Custom Action ID 在创建时生成 UUID，此后保持稳定；不得从标签或数组位置推导。
- 标签允许重复，标签不参与身份判断。
- 创建新自定义动作时若生成的 UUID 已存在，必须重新生成后再持久化；规范化不得随机改写既有合法 Custom Action ID。
- `clonedFromPresetId` 只记录 Clone Provenance（克隆来源），不建立继承、同步或共享所有权。

### 4.2 Settings V1

唯一持久化命名空间为 `composer-quick-actions`，其规范化用户状态为：

```ts
interface QuickActionSettingsV1 {
  schemaVersion: 1
  layout: 'ribbon' | 'bar' | 'launcher'
  userActionsById: Record<CustomActionId, CustomQuickActionValue>
  actionOrder: QuickActionRef[]
  presetStateById: Record<PresetActionId, { hidden?: boolean }>
}
```

Settings 只保存：

- 自定义动作；
- 预置与自定义动作共用的顺序；
- 预置的用户差异；
- 全局布局。

不得把预置定义复制进用户状态，也不得增加首版未定义的时间戳、颜色、分组或快捷键字段。

默认值为：

- `layout: 'ribbon'`；
- 自定义动作 `enabled: true`；
- 预置动作 `hidden: false`；
- 发送动作 `confirm: true`。

### 4.3 校验

所有配置入口、表单、迁移和 Settings mutation 必须复用共享领域模块中的同一组规则：

- 标签去除首尾空白后保存，长度为 1–40 个 Unicode code point；
- 文本保留原始换行和首尾空白，但必须至少包含一个非空白字符，最长 4000 个 Unicode code point；
- 空白定义采用 ECMAScript `trim()` 语义，所有校验与 UI 显示必须使用同一实现；
- 可选图标必须由 1–4 个 emoji 字素簇组成；
- 发送文本的首个非空白字符不得为 `/`；这类配置无效且不得执行；
- 动作文本不得包含由目标 DSH 公开保留、会在 `insertText`/`setDraft` 中被移除的引用占位符 code point；包含时配置无效，按字段错误处理。
- ID 不得重复；预置标签和自定义标签可以重复；
- 规范化后的发送动作必须显式包含 `confirm`，自定义动作必须显式包含 `enabled`。

本校验在源文本上拒绝保留占位符，因此源文本通过校验即等同于清理后的有效文本；实现仍不得依赖或伪造这些占位符。

## 5. 预置目录、合并与顺序

### 5.1 权威目录

Preset Catalog（预置目录）由以下内容按顺序组成：

1. 软件包内置清单；
2. Host composition 的 `Config.presets` 附加项。

Host 是目录的权威所有者。任何无效预置、重复 Preset Action ID 或超过 50 项的目录都必须使插件配置加载失败，不得静默截断或择一覆盖。Host 配置变化在 DSH 重启后生效。

同一预置 ID：

- 可以在升级时更新标签、图标和文本；
- 不得改变 `kind`；
- 对发送动作不得改变 `confirm`；
- 需要改变上述安全行为签名时必须使用新的 Preset Action ID。

用户只能对预置执行排序、隐藏和克隆，不得编辑或删除其作者定义。

### 5.2 自定义动作和克隆

用户可以新建、编辑、启停、排序和删除自定义动作。克隆预置时必须：

1. 复制克隆时刻的标签、文本、图标、动作类型和确认策略；
2. 生成新的 Custom Action ID；
3. 将 `enabled` 设为 `true`；
4. 可选记录 `clonedFromPresetId`；
5. 此后不再跟随源预置变化。

### 5.3 统一顺序与规范化

`actionOrder` 允许两种来源混排。初始顺序为内置预置声明顺序，随后为 Host 配置预置声明顺序。新建自定义动作和目录升级中新出现的预置追加到现有顺序末尾。

规范化必须确定且幂等：

- 重复引用只保留第一次；
- 指向不存在自定义动作的引用被删除；
- 指向当前目录中未知预置的引用和 `presetStateById` 被保留，但不显示且不计入当前动作总量；
- 未列入顺序的已知动作按各自的声明顺序追加；
- 同一输入和目录必须产生字节语义等价的规范结果；再次规范化不得产生新变化。

预置从目录移除时，其顺序引用和用户状态仍保留；同 ID 在降级或后续版本重新出现时恢复原有偏好。首版不支持预置 ID 重命名或别名推断。

### 5.4 数量上限与被动超限

- 当前预置目录自身不得超过 50 项；该限制是绝对配置门槛。
- 正常状态下，当前已知预置与全部自定义动作合计不得超过 50 项。
- 隐藏、停用和兼容性抑制动作均计入合计；当前目录中未知的预置墓碑不计入。
- 新增或克隆不得主动使合计超过 50；达到上限时必须禁用这些入口。
- 编辑、删除、隐藏、停用和排序在达到上限后仍允许。
- 一个原本合法的既有 Settings 快照因软件包升级或 Host `Config.presets` 变化新增预置而被动超过 50 时，必须无损加载全部已有数据，不得自动删除、隐藏或拒载；管理界面显示超限警告，并持续禁止新增和克隆，直至合计恢复到 50 以内。
- 被动超限不改变动作原有投影：隐藏、停用和兼容性抑制规则仍然生效。

## 6. Host、Remote 与持久化

### 6.1 Host 职责

Host 必须：

- 合并并验证内置预置和 `Config.presets`；
- 注册唯一的 `composer-quick-actions` Settings namespace；
- 使用可向后读取的 schema 解码所有已发布旧状态；
- 执行确定、幂等且受 namespace revision fence 保护的规范重写；
- 发布权威、只读的预置目录 Remote；
- 将 namespace、Remote 和观察器全部绑定到 Host fiber。

Host 对 `settings` 是硬依赖，并使用 `@deepseek-ai/dsh-settings-file` 提供的持久化后端。服务或文件 provider 缺失时必须等待，不得建立内存、浏览器或私有文件替代存储。默认用户数据位于 `<DSH_HOME>/settings.yaml` 的 `composer-quick-actions` section。Host 卸载时移除运行时注册，但该用户 section 必须保留，以便重新安装后恢复。

### 6.2 Catalog Remote

插件唯一自有 Remote 为：

```ts
interface CatalogSnapshot {
  schemaVersion: 1
  revision: string
  presets: PresetQuickAction[]
}

interface ComposerQuickActionsRemote {
  describeCatalog(): Promise<CatalogSnapshot>
}
```

- Remote 名称为 `remote.composerQuickActions`。
- `revision` 从规范化目录确定；同一目录必须稳定，任何对目录投影有影响的变化都必须改变 revision。
- Remote 只返回可无损序列化的 JSON，不暴露 Settings CRUD。
- 不提供第三方运行时预置注册 API。
- 不引入只有一个实现的通用 Repository，也不使用 `storageDomain`。

### 6.3 Settings 写入与迁移

- Client 通过 `settingsScope` 和生成式 `remote.settings` 读取、`set`、`unset` 或 `mutate` Host 权威状态。
- 每次修改必须携带预期 revision；Host 先验证和持久化，再提交内存状态。
- Host 独占验证与迁移权威；Client 只防御性解码共享模型产生的已确认快照并提交 mutation，绝不拥有迁移权威，也不得做验证前改写。
- Client 不直接写文件，不把浏览器本地存储作为权威源，也不绕过 Settings 访问原始 provider/backend。
- Host 注册 schema 必须继续接受全部已发布旧版本；读取后再执行规范重写；Host 同样不得绕过 Settings 访问原始文件或 storage backend。
- 若未来旧数据连注册 schema 都无法读取，则应走 DSH 验证前迁移钩子；首版不绕过 Settings。
- 规范重写冲突时刷新权威快照并基于新 revision 重试或请求用户重做，不得覆盖并发写入。

## 7. Client 架构与生命周期

### 7.1 全局控制器

私有 `QuickActionsController` 深模块拥有：

- 当前目录及目录 revision；
- 最后一次 Host 确认的 Settings 快照；
- 串行 Settings 写入队列；
- 派生的动作投影与数量状态；
- 全局管理面板状态。

Client 每个连接 generation 至多调用一次 `describeCatalog()`；不得按 Session 或按动作发起目录 RPC。首次连接与重连都必须重新取得权威目录。

全局长期状态不得持有活动 Session、InputState、Slot props 或 `InputActions` 对象。

### 7.2 会话局部执行

每个会话的局部执行层拥有当前 `InputActions`、确认状态和发送单飞状态。无论当前使用哪个布局或 Slot，同一 Session 同时只能存在一个逻辑发送流程；布局切换不得产生第二把独立锁。其他 Session 不受影响。

会话切换、布局导致的组件卸载或 Slot 替换必须取消尚未进入官方提交状态机的确认和待执行操作；已经被官方状态机接收的发送继续归原 Session 完成，绝不迁移到新会话。

### 7.3 Fiber 和错误隔离

- Client 依赖 `slots`、`settingsScope`、`remote.settings`、`remote.composerQuickActions` 和 `locale`。部署一个第三方功能 Remote 所需的实际装配机制必须以目标 DSH 的生成式/运行时契约为准并在实施中验证，不得抽象假设或硬编码应用级装配方式。
- Remote、Settings binding、连接监听、Slot 注入、样式和订阅都必须返回 disposer 并归 Client fiber 所有。
- 组件局部 effect 必须在卸载时清理。
- 每个 Slot 入口必须有局部错误边界；错误只替换快捷动作区域，允许重试，不得破坏 Composer。
- 管理、确认和会话执行错误彼此隔离；不得捕获、替换或重复显示 DSH 官方提交错误。

## 8. Composer 布局与管理体验

### 8.1 布局

Client 始终注册 `conversation.input.dock` 与 `conversation.composer.dock`，但只为当前全局布局渲染对应入口；集中式管理 overlay 必须独立注册。首版范围严格限定为 Resident Composer；no-session、hero 和 takeover 不渲染快捷动作，也不新增外层通用 Slot、placement variant 或其他核心扩展。实现只使用受支持的公开契约来满足这一范围；不得通过 DOM 或私有 Composer 状态猜测来规避。

| 值 | 名称 | Slot 与行为 |
|---|---|---|
| `ribbon` | A / 上方动作带 | 默认；使用 `conversation.input.dock`。标题、按统一顺序排列的动作和“管理”同处一行；动作横向溢出，“管理”保持可见。 |
| `bar` | B / 下方操作栏 | 使用 `conversation.composer.dock`。按统一顺序展示当前宽度可容纳的前部动作，其余进入“更多”；“管理”保持可见。 |
| `launcher` | C / 单入口面板 | 使用 `conversation.input.dock`。只显示紧凑单行入口及当前 Composer 动作投影数量；打开后使用共享可搜索动作面板。 |

B 的“更多”和 C 的入口必须复用同一可搜索动作面板。搜索必须实际筛选动作并保持匹配项的 `actionOrder` 相对顺序；搜索字段、大小写和 Unicode 归一化策略须由实现统一定义并以测试固定，不得沿用原型中“不筛选”的占位行为。

若隐藏、停用或兼容性过滤后没有 Composer 动作，三种布局仍必须显示紧凑管理入口，不得留下不可操作空区域。

### 8.2 宽度与响应式

- Ribbon 位于 InputBar 外部，宽度为 `100% - 2 × --dsh-composer-side-clearance`，并受 `--dsh-composer-card-max-width` 限制且居中。
- Bar 的父级已包含 clearance，因此宽度为 `100%`，使用相同 card max-width 并居中。
- 两者与输入框左右边界的可测误差不得超过 1 CSS px。
- 窄布局只能压缩或隐藏次要内部信息、调整溢出呈现，不得改变规定的外边界宽度。
- 必须覆盖桌面、约 768px 和约 360px 视口。

### 8.3 管理面板

集中式管理面板必须支持：

- 预置动作排序、隐藏、恢复和克隆；
- 自定义动作新建、编辑、启停、排序和删除；
- `ribbon`、`bar`、`launcher` 布局切换；
- 动作类型、标签、静态文本、可选 emoji、发送确认设置；
- 表单校验、50 项限制、被动超限警告；
- Settings 只读、写入失败、断线和 revision 冲突状态；
- 对兼容性抑制插入动作的集中说明。

缺少插入能力时，管理面板仍必须完整列出插入动作，并允许在数量规则内创建、克隆、编辑、排序、隐藏、启停或删除相应记录；只有 Composer 和可搜索执行面板省略它们。

### 8.4 无障碍、主题与本地化

- 使用 DSH UI primitives、主题 token、CSS Modules 和 `locale`；不得覆盖全局主题。
- 提供中文和英文词典。
- 所有控件必须保留可见文本标签和清晰焦点样式；`aria-label` 可补充但不得取代该可见标签。
- Emoji 仅作装饰，不得替代文本或其他无障碍名称。
- 键盘遍历、Enter/Space 激活、Esc 取消、清晰焦点样式、面板关闭后的焦点返回和适用的 WCAG AA 对比度是硬门槛。
- 管理、动作和确认面板必须沿用 DSH primitive 的标准模态语义与焦点管理。

## 9. 动作执行语义

### 9.1 能力投影

每个 Resident Composer 必须针对当前 `InputActions` 检测：

```ts
const hasInsertCapability =
  typeof (inputActions as { insertText?: unknown }).insertText === 'function'
```

- 能力存在：Insert Action 进入正常 Composer 投影。
- 能力缺失：所有 Insert Action 成为兼容性抑制插入动作，从 ribbon、bar、launcher 和可搜索执行面板省略。
- 能力 false → true → false 变化不得写 Settings；同一快照中的插入动作必须按原顺序恢复并再次省略，管理数据、计数和顺序不变。
- 插件在全部路径中只能消费公共 `InputActions` 和其他已记录的公共契约；不得为插入、焦点、选区、状态判断或提交访问 DOM、Lexical、私有 shell、私有事件、私有 keyboard 或合成输入。
- `setDraft` 仅可按第 9.5 节用于已确认空草稿的 Send Action，不得成为 Insert Action 回退。

### 9.2 插入动作

能力存在且原生 Composer 可编辑时，Insert Action 必须：

1. 将已保存文本原样传给同步公共 `inputActions.insertText(text)`；
2. 不自动增加空格或换行；
3. 替换当前范围选区，仅有光标时在光标处插入，无有效选区时追加到文档末尾；
4. 保留未被替换的富内容；
5. 公共接口清理后文本非空时，每次有效激活恰好插入一次并形成独立撤销单元；清理后为空时必须 no-op，且不形成撤销单元；
6. 允许用户有意连续插入；
7. 完成后保持或恢复 Composer 焦点，并把光标置于插入文本之后；
8. 让鼠标与键盘激活产生一致结果。

能力存在但原生 guard 暂不允许编辑时，动作仍显示为暂不可用并说明具体原因。

### 9.3 发送前置条件

Send Action 只允许在草稿完全未占用时执行。Occupied Draft 包括：

- 任意文本，包括纯空白；
- 任意附件，包括图片；
- 任意富引用。

实现必须通过目标 DSH 在对应版本中公开的字段识别并计入全部附件；不得遗漏某类附件而使发送动作携带既有内容。

发送动作不得覆盖、拼接或携带已有草稿内容。`disabled`、`blocked`、`removed`、`adjudicating` 或 `submitting` 状态不得执行；原生 queue 允许时，模型流式输出期间可以发送。

### 9.4 确认和最终重验

需要确认的发送动作必须打开面板，显示动作标签和完整待发送文本。打开面板不得修改草稿。

以下操作必须无副作用取消：取消按钮、Esc、点击遮罩、动作在等待时被删除、会话切换、布局/组件卸载。

确认时，以及免确认动作真正执行前，必须重新读取并验证：

- 当前动作定义及其启用/可见状态；
- 当前 Session；
- 当前草稿占用状态；
- 当前原生 guard 和发送阶段；
- 当前公共输入能力，用于选择本次发送的文本装载路径。

动作、Session、草稿占用或原生 guard 任一条件变化时，不得修改草稿或发送，并提示“状态已变化，请重试”。确认期间只有插入能力发生变化时，不取消已经满足其他条件的 Send Action，而是按最终读取到的能力选择第 9.5 节的公共装载路径。

### 9.5 文本装载与官方提交

最终重验通过后，发送按当前能力使用公共 API 装载文本：

- `insertText` 存在：调用公共 `inputActions.insertText(text)`；
- `insertText` 缺失：仅为本次已确认空草稿发送调用公共 `inputActions.setDraft(text)`。

随后立即调用公共 `inputActions.submit()`，进入与 Composer 发送按钮相同的官方 queue、命令裁决、乐观提交和失败恢复流程。不得直接调用 Session controller、Host Remote 或私有 keyboard 提交路径。

`setDraft` 兼容路径只适用于发送动作，并以最终空草稿重验为安全前提；绝不能用于实现选区插入。

### 9.6 单飞、失败与反馈

- 同一 Session 从首次激活直到官方提交阶段结束，必须保持单飞；确认取消或入队失败后按既定语义结束单飞。除这些已批准边界外，不得把单飞提前释放到某一未经批准的时间点。
- 按第 15 节决定新增最小公共提交凭据；在凭据可用之前，不得声称单飞已按官方提交阶段结束实现，但实现必须保留该设计位置，不得先以更短窗口替代。
- `insertText`、`setDraft` 或 `submit` 任一调用在装载前后发生同步异常，或状态机未接收提交时，插件必须结束单飞且不得自动重试。若草稿已经包含本次装载文本，必须原样保留并提示“未发送，文本已保留”；若尚未写入，则保持原草稿并显示可重试执行错误。
- 消息已经进入官方提交路径后的失败完全交给 DSH 原生错误反馈和失败草稿恢复；插件不得自动重试、复制草稿或显示重复错误。
- 成功插入后的文本和焦点、成功发送后的本地消息回显就是成功反馈，不得产生额外成功 toast。
- 只有错误、状态变化和暂不可用原因需要额外提示。

## 10. Settings、连接与错误状态

- 首次目录读取失败：不渲染动作，管理入口显示可重试目录错误。
- 目录读取成功但首次 Settings 读取失败：显示权威预置目录；管理界面只读并提示存储不可用。
- 成功加载后短暂断线：继续显示并允许执行最后一次 Host 确认的目录和用户动作快照；管理界面只读。
- 连接恢复：每个新 connection generation 重新读取一次目录并重新绑定 Settings。
- 新增、编辑、排序、隐藏、启停、删除或布局切换只有在 Host 持久化成功后才提交新 UI 状态。
- 写入失败：保留表单内容或恢复旧顺序，保持管理界面打开并提供明确重试。
- revision 冲突：刷新最新权威状态并要求用户重新确认，不维护第二套离线真相。

## 11. 软件包与构建契约

### 11.1 逻辑包

仓库使用 pnpm workspace，并交付两个逻辑包：

1. Host+Client 双面功能包，公开根入口、`./client`、`./types`、`./remote` 和 `./package.json`；
2. 安装 bundle，只负责 `dsh.bundle.patch`，依赖功能包并向全局 `web` profile 插入功能包 Host row。

当前工作区目录和无 scope 名称是脚手架身份，不自动成为正式发布身份。正式 npm 名称/scope、registry、访问级别、初始语义版本、许可证和 copyright holder 必须由[票据 20](./issues/20-choose-publishing-identity-and-license.md)确定；在此之前不得把 `0.0.0`、脚手架包名或 DSH 核心许可证写成发布结论。

最终 README、安装命令、bundle 依赖和兼容矩阵必须统一使用票据 20 的结果。规范安装形态为：

```sh
dsh plugin --profile web add <resolved-bundle-package-name>
```

随后重启 web profile。开发和离线安装必须支持本地 `pnpm pack` tarball。

### 11.2 构建产物

- Host 输出标准 ESM。
- Client 通过仓库私有 `tools/dsh-client-bundle` 构建为 browser-only、单文件 lazy-CJS `client.js`，再包装为 `window.__ModuleLoader__.load({ id, factory })`。
- 产物必须声明 `dsh.client`、正确的 web platform 和明确 externals，并附 sourcemap。
- 内部动态模块边界必须内联；未声明的 package/builtin 或计算型、间接 `require` 必须在构建期失败。
- 假 ModuleLoader 契约测试必须验证模块 ID、factory、`apply`/`inject`、externals 和 sourcemap。
- Watch 构建失败时必须保留最后一次完整成功产物，修复后继续发布；关闭时不得遗留子进程或临时 staging。
- 内部 controller、构建适配器实现和第三方预置注册不得成为公共导出。

## 12. 兼容与文档

- Peer range 应允许缺少 `insertText` 的受支持 DSH；安装不能因该能力缺失而整体失败。
- README 必须用能力矩阵而不是虚构版本号描述：
  - 无公共 `insertText`：兼容性抑制插入动作；管理、持久化、确认和发送可用；发送使用公共 `setDraft` + `submit`；
  - 有公共 `insertText`：插入完整可用；发送使用公共 `insertText` + `submit`。
- 已验证补丁基线可作为测试证据，但本地提交和 `dsh-v0.1.3-alpha.1` 均不得宣称为首个正式支持版本。
- README 必须覆盖：预置配置、三种布局、Settings 路径、兼容矩阵、开发 build/watch、现有 GUI HMR 前置、安装、升级、降级、卸载和手工彻底清理。
- README 中的安装、配置、升级、降级、卸载和手工彻底清理步骤必须在最终候选上逐条实际执行成功；验证开发 HMR 前必须确认同一 DSH checkout 的 Client build watcher 正在运行。
- 不得要求用户修改 Agent preset，也不得建议修改已安装的 `node_modules`。

## 13. 验证与发布门槛

### 13.1 新鲜证据

最终候选提交上的类型检查、lint、单元测试、集成测试、构建、pack、安装 smoke 和人工验收必须全部新鲜通过；不得跳过、只跑子集或引用历史结果。

证据统一保存到：

```text
.scratch/dsh-composer-quick-actions/verification/release-evidence.md
```

证据必须记录精确命令、时间、版本、通过/失败数量和退出码；浏览器检查链接截图，安装/重启记录一次性 profile。不得记录凭据、授权头、真实用户数据或真实对话内容。

任何内容丢失、重复发送、持久化损坏、Composer 崩溃或其他高严重度已知缺陷都阻止发布。只有明确列入范围外且写入 README 的限制可以保留。

### 13.2 自动化行为矩阵

自动化不得调用真实 LLM 或外部网络；Session、Remote、queue 和失败恢复使用受控 fake。覆盖率以行为矩阵而非统一行覆盖率为门槛。每个 bug 修复必须先增加可复现原问题的回归测试。

必须覆盖：

- 0、1、6、25、50 个正常动作；
- 由软件包升级新增预置形成的 53 个既有动作无损被动超限；
- 隐藏、停用和兼容性抑制动作计数；
- 所有模型不变量、默认值、校验和迁移分支；
- 排序中的重复引用、失效自定义引用、未知预置保留、缺失已知动作追加；
- 预置新增、文案更新、移除、重新加入和行为签名换 ID；
- 幂等规范重写、目录 revision 稳定性及 revision 冲突；
- Host 等待 `@deepseek-ai/dsh-settings-file` 后端、注册/卸载、无效配置、重复 ID 和超限目录；
- 自有 Catalog Remote 契约、生成产物和卸载清理；
- Settings 持久化先于 UI 提交，刷新和重启后恢复；写入拒绝与 revision 冲突必须按第 10 节区分处理；
- 首次目录失败、首次 Settings 失败、只读、断线和重连；
- 每个连接 generation 最多一次目录读取；不得每动作一次 RPC；
- fiber dispose 后无监听器、Remote、namespace、样式或订阅泄漏；
- 三种布局、溢出、搜索、管理、确认、宽窄响应式和焦点；
- 核心 `insertText` 的选区替换、光标插入、无选区回退、引用占位符清理、空输入 no-op、同步 `void`、未替换富内容保留和独立撤销边界；
- 插件插入路径的焦点、鼠标/键盘一致性、连续插入及逐次撤销；
- 官方能力缺失与完整能力两种基线各自的公共附件字段下的占用草稿、最终重验、确认取消、动作删除、会话切换和按会话单飞；
- 模型运行期间官方 queue、装载后失败草稿保留及官方失败不重复报错；
- 能力 false → true → false 时无 Settings 写入地省略、恢复、再次省略；
- 两个包的 build、bundle、pack、正式安装和本地 tarball 安装；若采用本地/离线流程，必须明确解析功能包与 bundle 两个 tarball，而不得假设 bundle tarball 内嵌其依赖；
- README 中安装、配置、升级、降级、卸载和手工彻底清理步骤逐条执行成功；
- stop、update、unload、卸载、重装、重启激活和配置恢复。

不得出现无限重渲染、明显卡顿或按动作发起 Remote 调用。

### 13.3 GUI 双通道

两个通道都必须通过：

1. **当前官方 DSH 能力缺失通道**：使用现有 `http://127.0.0.1:3080` GUI，验证兼容性抑制、紧凑管理入口、集中兼容提示、插入动作管理/持久化、公共 `setDraft` + `submit` 发送路径及写入后失败恢复。
2. **完整能力通道**：从官方基线创建隔离源码检出，应用已验证核心补丁，由受管后台任务提供并记录独立 GUI URL，验证真实插件与编辑器联动中的选区插入、焦点、连续插入、撤销、公共 `insertText` + `submit` 发送路径，以及文本写入后的失败草稿保留。

不得修改已安装 `node_modules`，不得把隔离服务器冒充当前 GUI，也不得把补丁环境冒充正式 DSH 发布。首版自动化使用最终候选环境的当前 Node 版本和 Playwright Chromium；人工检查覆盖桌面、约 768px 和约 360px。首版不宣称覆盖其他浏览器引擎或操作系统。

A/B 与输入框左右边界误差不得超过 1 CSS px。视觉截图基线必须覆盖三种布局及桌面/窄布局组合；跨平台字体的轻微像素差异本身不阻断，但 DOM 结构、边界、状态、焦点、键盘操作、可访问名称和适用 WCAG AA 对比度是硬门槛。

### 13.4 最终人工验收

自动化全部通过后，用户必须在一次性测试会话中完成最终人工验收。除非用户另行明确同意，不得在该流程中触发真实模型调用：

1. 安装最终 tarball，重启并刷新 DSH GUI；
2. 创建插入与发送动作，验证编辑、排序、停用、隐藏和克隆；
3. 检查三种布局、输入框等宽和三种视口；
4. 在完整能力通道验证选区插入、焦点、撤销和连续插入；
5. 验证空草稿发送、占用草稿禁用、确认取消和确认发送；
6. 刷新页面并重启 DSH，确认 Settings 恢复；
7. 卸载并重启，确认 UI 消失；重新安装后确认配置恢复；
8. 检查错误信息、键盘流程和无障碍名称；
9. 明确回复“生产验收通过”。

没有完整证据和用户最终明确的“生产验收通过”，不得完成 Wayfinder 地图目标。

## 14. 源码边界与票据覆盖

规范源码边界：

- `src/model/`：纯 JSON 领域模型；
- `src/host/`：配置、Settings 与目录 Remote；
- `src/client/controller.ts`：全局快照、写入队列与管理状态；
- `src/client/surfaces/`：三种布局与共享动作控件；
- `src/client/manager/`：动作面板、管理面板与表单；
- `src/client/session/`：确认、单飞与执行；
- `src/client/index.tsx`：生命周期装配和 Slot 注册；
- `src/locales/`、`src/styles/`：词典和局部样式。

| 规格区域 | 实施票据 |
|---|---|
| 工作区和 Client 构建适配器 | [11](./issues/11-scaffold-workspace-and-client-build-adapter.md)（已解决） |
| 数据模型、校验、迁移、合并、数量和投影 | [12](./issues/12-implement-shared-quick-action-model.md) |
| Host Settings 与 Catalog Remote | [13](./issues/13-implement-host-settings-and-catalog-remote.md) |
| Client 权威快照、连接和写入控制器 | [14](./issues/14-implement-client-quick-actions-controller.md) |
| Composer 布局和会话动作执行 | [15](./issues/15-implement-composer-surfaces-and-action-execution.md) |
| 管理、搜索、表单和确认 UI | [16](./issues/16-implement-management-and-confirmation-ui.md) |
| 正式发布身份和许可证 | [20](./issues/20-choose-publishing-identity-and-license.md) |
| Bundle、exports、安装与 README | [17](./issues/17-finish-install-bundle-and-release-docs.md) |
| 集成与发布验证 | [18](./issues/18-run-integration-and-release-verification.md) |
| 核心能力测试基线 | [10](./issues/10-publish-dsh-composer-insert-text-api.md)（已解决） |
| 正式上游合并 | [19](./issues/19-upstream-insert-text-and-record-release.md)（已关闭为首版范围外） |

## 15. 已确认的收尾决策与票据缺口

用户回复（见本对话记录）已就此前存留边界做出以下决定，正文已同步落实：

1. **有效文本校验**：在共享模型源文本校验层拒绝 DSH 公开保留的引用占位符。
2. **Host 配置导致的超限**：与软件包升级一视同仁，采用无损被动超限。
3. **Unicode 校验口径**：标签/文本按 Unicode code point 计数，空白采用 ECMAScript `trim()` 语义。
4. **Settings 写入结果**：扩展 `SettingsScope`，新增可区分成功、拒绝与 revision conflict 的结构化 mutation outcome。
5. **Submit 接收凭据**：新增最小公共提交凭据，支撑既定单飞窗口，不得用私有状态兜底。
6. **Resident Composer 判定**：不重开范围、不新增外层或 placement 契约；实施必须对目标 DSH 公开契约进行可核验判定并用测试固定。

这些决定对应的核心改动与验证责任按如下方式落到票据：

- 票据 12/13/16：占位符拒绝校验、Unicode code point 与 `trim()` 口径、被动超限的 Config 通道及测试。
- 票据 15：最小公共提交凭据的消费与测试；Resident Composer 公开判定方案及其双通道验证。
- 票据 14/16：`SettingsScope` 结构化写入结果（成功/拒绝/conflict）及恢复重读语义。
- 票据 13/14 必须基于目标 DSH 的生成式/运行时契约明确自有 Catalog Remote 的生成、可用与卸载所有权；在关键装配契约未核实前，13/14 不能宣称 Remote 已可用。
- 票据 16 已把 `Blocked by` 改为 `14, 15`，确认流程共享票据 15 的每 Session 单飞/执行契约，不维护私有第二把锁。
- 票据 11 的现有实现需补充验证 JavaScript 与 sourcemap 不会跨代发布、watch 关闭清理 staging；否则应把该修复交给 17 前置票据。
- [票据 20](./issues/20-choose-publishing-identity-and-license.md)仍须确定正式包名/scope、registry、访问级别、初始版本和许可证。
- 票据 17 必须在发布身份确定后改用唯一正式名称，并定义两个本地 tarball 的可复现解析/安装流程。
- 票据 18 当前为 AFK，但最终门槛要求用户明确回复“生产验收通过”；应把最终阶段改为 HITL，或新增一个阻塞地图完成的 HITL 验收票据。

现有票据不应整体重生成；应按上述映射修订相应票据或新增最小票据。
