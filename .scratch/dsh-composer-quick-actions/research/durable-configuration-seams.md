# 快捷动作的持久化配置与预置扩展点

## 决策

将由 `@deepseek-ai/dsh-settings-file` 支撑的 **Host `settings` Service** 用作用户自有快捷动作的持久化边界。将作者自有的预置快捷动作保留在可安装包（或其 Host 组合配置）中，并使用不可变、稳定的预置 ID；仅持久化用户创建的操作，以及以这些预置 ID 为键的用户增量。在浏览器端，使用随附的 **`ctx.settingsScope` / 生成的 `ctx.remote.settings`** 集成。不要持久化到浏览器内存、仅 Client 的存储、Agent 预置或动态 Cordis 包中。

这是一个受支持的公共接缝，对于常规 JSON 形态的快捷动作状态，无需更改 DSH 核心。实质性缺口是**一等 schema 迁移能力**：Settings 具备验证、分层、修订号和重置能力，但没有迁移钩子。如果兼容 schema 加重写的方案不足，最小的核心前置条件是一个原子的、验证前的 settings 迁移钩子，并按命名空间和已存储的 schema 版本确定迁移逻辑。

`ctx.storageDomain` 也是一个受支持的持久 Host 接缝，但它是更重型的记录存储，没有通用的 Client 持久化 API，并且明确没有数据迁移设施。只有当快捷动作超出配置语义的适用范围（大型/高频集合或需要点写入）时，才有理由使用它。

## 证据范围与 Inspect 限制

仅使用了主要来源：

1. 此运行中 DSH 进程内的实时 Cordis Inspect Provider。
2. 以下位置中已安装的 DSH 实现与第一方包参考资料：
   `/Users/lovvvve/Library/Application Support/io.github.hairyf.deepseek-harness-desktop/dependencies/dsh/`。

实时 Host `Service.listService` 目录及精确的 Service 查询验证了 `settings`、`settingsController`、`storage`、`storageDomain` 和 `agentPresets`。第一次 Client `Service.listService` 请求被页面取消，因此下文的 Client 细节取自随附的 Client 实现及其第一方包参考资料。上级调查中可用的 Client 目录不包含通用的 Client 存储/持久化 Service；受支持的 Client settings 表面是 Host 持久化的代理，而不是浏览器自有的存储。

在第一方 `@deepseek-ai` 包下未找到与 `Quick Action`、`quickAction` 或 `quick-action` 匹配的 DSH 源码。因此，DSH 提供的是原语，而不是快捷动作注册表或记录 schema。

## 受支持的设施与缺口

| 设施 | 分类 | 为快捷动作提供的能力 | 重要限制 |
|---|---|---|---|
| Host `settings` + 文件 provider | **受支持的公共接缝；推荐** | 带命名空间的 JSON 配置、schema/默认值、组合 `base` + 用户层、持久写入、观察、重置、乐观修订号 | 没有迁移回调；只有一个用户层；数组整体替换 |
| Client `ctx.settingsScope` + `ctx.remote.settings` | **受支持的公共 Client 集成** | 命名空间镜像视图和受修订号栅栏保护的 `set`/`unset`/`mutate`；规范的 settings UI slot | Host 仍是权威来源；在非回环页面上禁用 |
| JSON/SQLite backend 上的 Host `ctx.storageDomain` | **受支持的公共 Host 数据接缝；备选方案** | 类型化且带版本戳的 KV 表、稳定的记录键、持久点写入、变更事件 | 没有通用 Client API；没有自动数据迁移；显式的 open/close 所有权 |
| `ctx.storage.backend` / 原始 `KvUnit` | **基础设施/内部消费者细节** | Backend 实现契约 | 产品包被明确要求不要直接操作 backend；应使用 `storageDomain` |
| 动态 `harness.handle` / `host.call` | **仅动态 Cordis Package 受支持；此处生命周期不合适** | 用于动态 Host/Client 对的包私有 JSON RPC | DSH 重启后动态定义会消失；它不是可安装包的持久化接缝 |
| Agent 预置文件 / `agentPresets` | **受支持的组合设施，而非快捷动作存储** | 选择每个会话的插件/工具/技能 | Agent 预置插件不能拥有 Host settings 命名空间；预置创作只能通过复制进行 |
| Client 本地持久化 | **缺失的受支持能力** | 未发现 | 没有通用 Client 存储 Service；浏览器状态不是权威来源 |
| 快捷动作 schema/注册表/ID/迁移 API | **缺失的能力** | DSH 未提供 | 可安装包必须拥有这些领域规则 |

## 1. 推荐的 Host 接缝：`settings`

### 精确的实时契约

实时 Host Inspect 将 `settings` 描述为抽象 settings Service：其 provider 负责原始文档的 `load`/`persist`，而基类负责命名空间注册、解析、验证、变更检测和提交事件。

```ts
readonly writable: boolean
prepareDocument(): Promise<string | undefined>

register<const Namespace extends string, T>(
  ns: Namespace & SettingsNamespaceInput<Namespace>,
  schema: z<T>,
  options?: SettingsRegisterOptions<T>,
): SettingsScope<T>

installSection<const Namespace extends string, T>(
  owner: Context,
  ns: Namespace & SettingsNamespaceInput<Namespace>,
  schema: z<T>,
  entry: T,
  hooks: SettingsSectionHooks<T>,
): void

describe(options?: { redactSecrets?: boolean }): SettingsDescriptor[]
get<const Namespace extends string>(ns: Namespace): unknown
update(ns: Namespace, patch: object, expectedRevision?: number): Promise<void>
replace(ns: Namespace, section: object, expectedRevision?: number): Promise<void>
mutate(ns: Namespace, ops: readonly SettingsPathOp[], expectedRevision?: number): Promise<void>
```

```ts
interface SettingsRegisterOptions<T> {
  base?: Partial<T>
  applies?: 'live' | 'restart'
  validate?: (value: T) => void
}

type SettingsPathOp =
  | { op: 'set'; path: readonly string[]; value: unknown }
  | { op: 'unset'; path: readonly string[] }

interface SettingsDescriptor {
  ns: SettingsNamespace
  schema: unknown
  value: unknown
  revision: number
  base?: unknown
  user?: unknown
  applies: 'live' | 'restart'
  secrets?: { path: string[]; set: boolean }[]
}
```

命名空间是唯一的小写连字符标识符；重复注册会失败。返回的所有者作用域公开 `get`、`watch`、`update` 和 `replace`；其注册和观察器与发起调用的 Cordis fiber 绑定。实现见 `node_modules/@deepseek-ai/dsh-settings/lib/index.js:271-315`。可选的消费者辅助工具将插件组合条目映射到 `base`，并在该 Service 脱离时回退到该条目（`.../dsh-settings/lib/index.js:317-343`）。

### 持久化与分层

第一方契约说明，解析后的 settings 按 **schema 默认值、组合 `base`、用户文档 section** 的顺序分层叠加，写入只会改动用户层（`.../dsh-settings/README.md:10-12`、`46-58`、`88-94`）。这直接支持重置为作者/部署方设定的行为：`replace({})` 会重新继承 base 和默认值（`.../dsh-settings/README.md:64-68`；实现位于 `.../dsh-settings/lib/index.js:392-440`）。

写入仅接受无损的 JSON 形态值；系统会验证解析后的候选值，先持久化，然后提交。每个命名空间的写入都会串行执行，可选的 `expectedRevision` 会拒绝过期的写入者（`.../dsh-settings/lib/index.js:443-471`；`.../dsh-settings/README.md:64-68`、`105-107`）。数组是替换值，而不会递归合并（`.../dsh-settings/lib/index.js:203-215`）；因此，操作应存储在以 ID 为键的映射中，并另设一个顺序数组，而不应将记录数组直接合并。

随附的文件 provider 默认将每个命名空间持久化到 `<DSH_HOME>/settings.yaml`，监视该文件，并保留属于当前未加载插件的 section（`.../dsh-settings-file/README.md:10-12`、`34-47`）。它执行读取—修改—写入合并和原子替换；直接编辑会热重载（`.../dsh-settings-file/README.md:51-59`、`78-97`）。必须挂载一个 provider：该 Service 本身不存储任何内容（`.../dsh-settings/README.md:34-44`）。

### 生命周期约束

* 注册是一项 fiber effect。卸载所有者会移除命名空间和观察器，但**不会**删除由文件支撑的用户 section（`.../dsh-settings/lib/index.js:271-297`；文件 provider 的保留行为见 `.../dsh-settings-file/README.md:10-12`）。后续的进程/插件注册会从同一个持久化 section 解析。
* 拆卸会拒绝新的写入，并排空排队中的写入/watcher（`.../dsh-settings/lib/index.js:223-252`）。已经开始的写入可能会在其注册者释放后到达存储，但此后不会提交，也不会通知任何对象（`.../dsh-settings/README.md:105-107`）。调用方应等待写入完成，并让 Cordis 拥有注册释放的生命周期。
* 使用 Host 平面的所有者。随附的 plugin-settings UI 明确指出，由 Agent 预置挂载的插件会把配置内联携带在 `agent.cordis.yml` 中，并且**不能注册 settings 命名空间**（`.../dsh-client-ui-settings-plugins/README.md:88-97`）。
* `applies: 'live' | 'restart'` 是元数据。快捷动作通常应设为 `live`。

## 2. 不对作者预置进行修改

DSH 没有内置的“预置快捷动作”声明。可安装包必须在以下两个由包拥有的位置之一声明该清单：

1. **最强的所有权边界：**一个编译进 Host 和 Client 包产物的导出/静态清单。
2. **可由部署配置的所有权：**Host 插件的 Schemastery `Config` 中的 `presets` 字段，由安装程序的 `cordis.yml` 行提供。插件会将其作为组合配置接收。

不要将该清单复制到用户存储中。只注册用户状态命名空间，例如：

```ts
{
  schemaVersion: 1,
  userActionsById: Record<UserActionId, UserQuickAction>,
  userActionOrder: UserActionId[],
  presetStateById: Record<PresetId, {
    hidden?: boolean,
    shortcut?: string,
    order?: number
  }>
}
```

运行时，将包清单与 `presetStateById` 合并，并追加/排序 `userActionsById`。这意味着：

* 包升级可以添加或编辑预置，而无需重写用户记录；
* 删除预置后，至多留下一个被忽略的增量/墓碑；
* 重置预置会移除其增量（`unset`），从而显露包定义；
* 用户自有记录绝不会修改或遮蔽源预置对象。

也可以把作者设定的默认值放入 `settings.register(..., { base })`，Settings 会正确显示/重置 base 与 user 的来源。不过，由于用户文档可以覆盖任意路径，且数组会整体替换，所以将实际预置清单放在用户命名空间之外，可以形成更稳固的作者所有边界。将 `base` 用于**用户状态字段**的默认值，而不要将其用作不可变预置定义的唯一副本。

### 稳定标识的预期

DSH 仅强制执行 settings 命名空间标识；它不提供快捷动作 ID 生成器或重命名语义。包必须自行确立这些规则：

* 保持一个稳定的命名空间，例如 `composer-quick-actions`；重命名会使旧 section 失去关联。
* 为每个作者预置分配永久的包作用域 ID（例如 `com.example.plugin:explain-selection`），且该 ID 独立于标签、顺序或本地化文本。
* 用户操作 ID 只生成一次并持久化；绝不能从数组位置或可变标题推导 ID。
* 将语义不兼容的替换视为新的预置 ID。若有意重命名 ID，则随包提供别名/迁移映射。
* 用稳定 ID 存储顺序。应以确定性方式保留或忽略未知 ID，而不能让整个命名空间因此失败。

对于可安装的 Client 代码，浏览器模块标识是解析后的 manifest 包名。包声明 `dsh.client` 且使用 `platform: 'web'`，导出 `./client`，并且必须随附已构建的 `lib/client.js`；重复的包标识和缺失的 bundle 都会导致激活失败（`.../dsh-client-modules/README.md:28-44`、`64-68`）。

## 3. 受支持的 Client 到 Host 边界

### 静态/可安装包：settings Client Service

`@deepseek-ai/dsh-client-ui-settings` 是规范的 Client 集成。它维护一份 Host settings 镜像，并公开 `ctx.settingsScope.bind(spec)`。绑定后的作用域包含解析后的 `value`、`base`、原始 `user`、`revision`、可写性/模式，以及受修订号栅栏保护的 `set`、`unset` 和 `mutate`；绑定与释放归发起调用的 Client fiber 所有（`.../dsh-client-ui-settings/README.md:25-40`、`50-62`）。

底层生成的 Host controller 具有实时 Inspect 验证过的以下契约：

```ts
describe(): SettingsDescribeValue
canOpenAgentPresetDirectory(): boolean
update(
  ns: string,
  patch: Record<string, JsonValue>,
  expectedRevision: number | undefined,
): Promise<SettingsNamespaceView>
replace(
  ns: string,
  section: Record<string, JsonValue>,
  expectedRevision: number | undefined,
): Promise<SettingsNamespaceView>
mutate(
  ns: string,
  ops: SettingsPathOpView[],
  expectedRevision: number | undefined,
): Promise<SettingsNamespaceView>
```

每次读取都会脱敏，写入则映射到 Host `settings` 操作；provider 拒绝会被分类为 `settings/conflict` 或 `settings/rejected`（`.../dsh-api-settings-controller/lib/index.js:291-307`、`419-430`、`439-472`、`532-546`）。因此，浏览器不应写文件或拥有持久状态；它通过这一 Host 权威来源进行编辑。

对于 UI，包可以注册完整的 `settings.section`、单个 `settings.general.item`，或一个按命名空间设键的 `settings.plugin.item` 卡片。随附的插件标签页仅为 Host 提供的命名空间与已注册卡片的交集进行分派；命名空间不会自动获得表单（`.../dsh-client-ui-settings-plugins/README.md:28-36`、`52-60`）。外部包还必须生成预期的 lazy-CJS `dsh.client` bundle（`.../dsh-client-ui-settings-plugins/README.md:93-97`）。

**本地性约束：**随附的 Client 会在非回环页面上禁用由 Host 持久化的 settings（`.../dsh-client-ui-settings/README.md:90-97`）。本地 DSH GUI 使用回环地址，因此本工单的目标受支持；若要支持远程浏览器，则需要有意变更 DSH 策略。

### 动态包私有 RPC 不是可安装包接缝

动态 Cordis runner 提供以下精确签名：

```ts
harness.handle(
  method: string,
  handler: (args: JsonValue) => JsonValue | Promise<JsonValue>,
): () => void

host.call(method: string, args?: JsonValue): Promise<JsonValue>
```

Host 会验证 handler，并通过 JSON 边界克隆其结果（`.../dsh-cordis-host-runner/lib/index.js:515-532`）；省略的 Client 参数会变为 `null`（`.../dsh-cordis-client-runner/lib/client.js:165-184`）。这是包私有的 **Client → Host** JSON RPC。

它不应成为这个持久可安装项目的基础。负责它的第一方包明确指出，动态定义只存在于进程内存中，并会在重启后消失（`.../dsh-tool-cordis/README.md:10-12`）。使用 `settingsScope` 的静态可安装包已经拥有受支持的生成式 Settings Remote，无需自定义 RPC。如果改用 `storageDomain`，包就必须添加由 Host 拥有的 Remote/controller API；DSH 没有公开通用的 Client domain store。

## 4. 备选 Host 接缝：`storageDomain`

### 精确的实时契约

```ts
interface DomainSpec {
  readonly name: string
  readonly version: number
  readonly layout?: 'single' | 'per-record'
  readonly compatibleVersions?: readonly number[]
  readonly invalidRecords?: 'backup-and-skip'
  readonly global?: { schema: ZodType<unknown>; initial: unknown }
  readonly tables: Record<string, {
    readonly valueSchema: ZodType<unknown>
  }>
}

interface Domain<S extends DomainSpec> {
  readonly name: string
  readonly global: DomainGlobalHandleOf<S>
  table<N extends keyof S['tables'] & string>(name: N): KvTable<...>
  close(): Promise<void>
}

interface KvTable<K extends string, V> {
  get(key: K): V | undefined
  entries(): IterableIterator<[K, V]>
  keys(): IterableIterator<K>
  readonly size: number
  put(key: K, value: V): Promise<void>
  delete(key: K): Promise<boolean>
  update(key: K, fn: (current: V) => V): Promise<V>
}

ctx.storageDomain.open<S extends DomainSpec>(spec: S): Promise<Domain<S>>
ctx.storageDomain.get(name: string): DomainImpl | undefined
ctx.storageDomain.closeAll(): Promise<void>
```

`defineDomain` 会验证 domain 名称、版本、布局、兼容版本和无效记录策略（`.../dsh-storage-domain/lib/index.js:31-90`）。打开 domain 时会解析配置的 backend，加载每条记录并根据 schema 进行验证，还可以备份/跳过无效记录（`.../dsh-storage-domain/lib/index.js:317-398`）。写入先持久化，随后才发布内存中的变更/事件（`.../dsh-storage-domain/README.md:10-12`、`71-94`）。

### 生命周期与 backend 约束

调用方拥有 `Domain.close()`，通常通过 `ctx.effect` disposer 管理；该设施只会在自身卸载时关闭泄漏的 handle（`.../dsh-storage-domain/README.md:47-59`；实现位于 `.../dsh-storage-domain/lib/index.js:337-351`、`409-450`）。每个 domain 名称只允许一个打开的 handle。

产品包必须使用 `storageDomain`，而不是原始 backend `KvUnit`；domain 包被明确规定为 backend 契约的唯一消费者（`.../dsh-storage-domain/README.md:10-12`、`27-32`）。组合必须挂载 `dsh-storage`、一个 backend 和 `dsh-storage-domain`。JSON backend 要求显式 root，支持 `single` 和 `per-record`，并使每次完成的写入都持久化（`.../dsh-storage-json/README.md:25-56`、`68-88`）。

### 升级/迁移的现实情况

`compatibleVersions` 只会扩展可接受的已存储版本戳（`.../dsh-storage-json/lib/index.js:352-365`）；当前 schema 仍必须能验证已加载的记录。`invalidRecords: 'backup-and-skip'` 是抢救措施，而不是迁移。domain 自身的第一方限制非常明确：**“无数据迁移（No data migration）”**；不兼容的版本会被拒绝，schema 变更需要手工迁移（`.../dsh-storage-domain/README.md:144-154`）。

因此，`storageDomain` 并未解决迁移缺口；它只是提供了更清晰的记录/版本标识和持久点写入。

## 5. Agent 预置是另一个概念

DSH Agent 预置是包含 `agent.cordis.yml` 和可选资产/技能的目录。随附预置与用户副本位于不同的 root；用户创作只能通过复制进行，并且不能删除随附预置（`.../dsh-agent-presets/README.md:10-12`、`28-58`、`71-75`）。会话的预置选择工具、prompt section 和技能（`.../dsh-agent-presets/README.md:30-34`）；它不是 UI 快捷动作的记录存储。

由此产生以下结论：

* 不要编辑随附的 Agent 预置来添加用户操作。
* 不要把 `agentPresets.copy/remove` 解释为快捷动作 CRUD。
* 不要把持久 settings 所有者放入 Agent 预置中；settings UI 契约指出，这类插件不能注册 settings 命名空间（`.../dsh-client-ui-settings-plugins/README.md:93-96`）。
* 可安装的 Host 插件应位于 Host 组合中；只有在需要会话特定行为时，Agent 预置行才可以使用 Host Service。

## 6. Schema 升级与最小的缺失前置条件

### DSH 当前支持的能力

Settings 注册会立即验证已存储的 section；无效的已存储状态会导致注册被拒绝（`.../dsh-settings/lib/index.js:271-290`）。实时契约中完整的 `SettingsRegisterOptions` 只有 `base`、`applies` 和 `validate`；没有 `version` 或 `migrate`。Settings 写入提供具备命名空间级原子性的验证/持久化/提交和乐观修订号，但不提供验证前转换。

包目前可以实现有边界的迁移：

1. 在用户状态中包含 `schemaVersion`。
2. 让注册的 schema 可以向后读取每个受支持的旧版本。
3. 注册后读取旧变体，构建规范 JSON，然后使用 descriptor 的 `expectedRevision` 对其执行 `replace`。
4. 保持迁移幂等，并为已经发布的格式保留测试/fixture。

这只有在新的注册 schema 能解析旧文档时才有效。无法通过公开写入路径处理 schema 不兼容的旧文档，因为注册会先失败，而写入要求存在实时注册的命名空间（`.../dsh-settings/lib/index.js:271-290`、`443-460`）。

### 若需要更严格的迁移，DSH 核心所需的最小前置条件

在当前 schema 验证之前添加一个由所有者声明的、原子的 **settings 命名空间迁移钩子**，概念上如下：

```ts
register(ns, currentSchema, {
  version: N,
  migrations: {
    [oldVersion]: (oldJson) => nextJson
  },
  base,
})
```

Provider/Service 应读取原始用户 section，在命名空间写入队列（以及文件 provider 的 writer lock）下运行有序的纯 JSON 迁移，根据当前 schema 验证结果，完成持久化，递增修订号，然后发布。与向插件公开原始文件或 backend 访问相比，这一方案更小，也更契合现有设计。如果 DSH 不添加该能力，包就必须保留兼容 schema，或自行负责带外的、特定于 provider 的迁移——这是本报告不推荐的一种内部耦合。

## 一句话推荐边界

**静态可安装包拥有不可变的预置定义和稳定 ID；Host `settings` 只在一个稳定命名空间中拥有 JSON 用户操作和预置增量；本地 Client 通过 `settingsScope`/`remote.settings` 编辑该命名空间；生命周期继续由 Cordis fiber 所有，而版本升级使用可向后读取的 schema 加受修订号栅栏保护的重写，直到 DSH 获得验证前迁移钩子。**
