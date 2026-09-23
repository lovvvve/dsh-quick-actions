# DSH 0.1.7-alpha.2 Client 侧契约调研（票据 31）

调研日期 2026-09-23。只读调研：所有证据取自 `npm pack` 下来的已发布 tarball（解包在
`/home/yulong/.claude/jobs/63f1977f/tmp/`：`c-0.1.7-alpha.2/`、`c-rc3/`、`s-0.1.7-alpha.2/` 以及
`research-client/<pkg>@<ver>/package/`），外加本机 `node_modules` 里锁定的
`@deepseek-ai/dsh-client-ui-primitives@0.1.2-rc.1`。下文路径均相对各 tarball 的 `package/` 根。

**总览（先看这段）**

1. `ctx.settingsScope` 在 0.1.7 已不存在，服务改名为 **`ctx.configForms`**（类 `ConfigForms`）。插件现在的
   `inject = ['slots','settingsScope','connection','locale']` 在 0.1.7 shell 里**永远等不到依赖，Client 整个不启动**。
2. 按 entry id 取表单：`ctx.configForms.get<T>('composer-quick-actions')`，**没有 `decode` 参数**；读写语义与旧
   `SettingsScope` 基本同构，`mutate` 从 `Promise<void>` 变成 `Promise<boolean>`（false = 拒绝或冲突，二者不可区分）。
3. Host 只投影 Config 中的 **volatile** 字段：`value/base/user/schema` 都经 `projectForm(volatileForm(schema), …)`。
   非 volatile 的 `presets` **到不了浏览器**；旧的只读目录命名空间 `composer-quick-actions-catalog` 也不再存在。
4. Composer 侧有两处破坏：`InputState.queue` 元素类型变了（只影响类型闸门）；**`IconSearchOutline16` 已从
   primitives 删除**（运行时 seed 表里也没有），`ActionPanel` 一渲染就会炸。

---

## 1. `@deepseek-ai/dsh-client-ui-settings@0.1.7-alpha.2` 暴露给插件的服务

### 结论

- 服务名 **`configForms`**（`Service` 名，`super(ctx, "configForms")`）。另有 `settingsSchema`（`SettingsSchemaService`，
  schema 反序列化 / 校验 / path 工具）。**没有** `settingsScope`、**没有** `settingsDescribe`。
- 取表单：`ctx.configForms.get<T>(entryId): ConfigForm<T>`。entryId = Host 端 profile entry id，本插件是
  `composer-quick-actions`（`cordis.patch.yml` 的 `insert[0].id`）。实例按 entryId 缓存、由 ui-settings 持有，
  **调用方没有 dispose**；调用方只需用 `ctx.effect(() => form.subscribe(...))` 管好自己的订阅。
- `ConfigFormSnapshot<T>` 字段：`status: 'loading'|'ready'|'unavailable'`、`value: T|undefined`、`base: unknown`、
  `user: unknown`、`revision: number|undefined`、`writable: boolean`、`mode: 'host'|'memory'`。**没有 `error`，
  也没有 `loading` 布尔值**。与旧 `SettingsScopeSnapshot` 相比新增 `user`，其余同名同义。
- 写 API：`mutate(ops, expectedRevision?)`、`set(field, value)`、`unset(field)`，全部返回 `Promise<boolean>`：
  - `true` = Host 接受，写回答 `SettingsNamespaceView` 被 `mirror.acceptView` 折进镜像；
  - `false` = Host 拒绝（`settings/rejected` 或 `settings/conflict`，**两者合并为 false，不可区分**）、或 memory
    模式、或 form 已 dispose；拒绝时若是最新一次写，会先 `mirror.load()` 回读再 resolve；
  - 传输故障 **reject**（Remote 层把 carrier 故障折进 `ok:false`，只有装配故障才 reject）。
  - `expectedRevision` 省略时依次用 `pendingRevision`（被后继写抢先的上一笔回答）→ 快照 `revision`。
  - 所有写串行排队（`tail`），只有最新一代的写会发布。
- 订阅：`form.subscribe(listener)` / `form.getSnapshot()`（snapshot 引用稳定，变更才换）。
- 读失败的可观察性：`ConfigFormSnapshot` 里看不到。首读失败时 form 一直停在 `status: 'loading'`；要区分
  「还在读」和「读失败了」只能看 `ctx.configForms.describe().getSnapshot()` 返回的
  `SettingsMirrorSnapshot { status: 'idle'|'loading'|'ready'|'unavailable', view, error }`：首读失败 →
  `status` 回到 `'idle'`、`view === undefined`、`error` 为消息；已有 view 后再失败 → 保持 `'ready'`，只更新
  `error`。这与插件现在 `readCatalog()` 用 `view/error` 区分的做法一致，可以照搬。
- `describe()` 的类型是 `SettingsDescribeFace`（`getSnapshot/subscribe/ensure/acceptView`），**`load()` 刻意不在
  face 上**（d.ts 注释：“`load` stays off this face — invalidation refreshes belong to the mirror's owning plugin”）。
  运行时 `describe()` 直接 `return this.mirror`，所以 `load` 其实调得到，但**不在契约里**（0.1.5 时也是这样，
  插件手写类型里的 `load()` 本来就是越界的）。合规的替代：`ensure()`（只在 `idle` 时发起读，正好覆盖「首读失败后
  重试」）。
- 刷新：ui-settings 自己在 `ctx.remote.$on('settings/document-updated')` 与 `ctx.on('connection/reset')` 上调
  `mirror.load()`，form 从 mirror 派生，**插件不用自己处理 reset**。
- 非 loopback 页面：`persistence = ctx.remote.$host.isLoopback ? 'host' : 'memory'`；memory 模式下 form 恒为
  `status:'unavailable'`、`mode:'memory'`、写一律 `false`，mirror 不读（与 0.1.5 相同）。
- 默认解码：`get()` 不接受 `decode`，派生时用 `view.schema`（已是 volatile 子 schema）校验 `view.value`；
  **校验不过时 `value` 不更新、`status` 不变**（首次就不过则永远 `loading`）。插件需在读 `snapshot.value` 后自行做
  领域解码。
- `status: 'unavailable'` 的触发：namespace 不在 describe 结果里（Host 端条件见第 3 节：entry 未激活、没有
  volatile 字段、entry id 在 include 下不唯一等）或 memory 模式。
- 额外工具：`whileServed(namespaces, register)`——Host 提供该 namespace 时才注册、撤下时自动注销。

### 证据

- 服务注册与增强：`c-0.1.7-alpha.2/lib/types/client/config-form.d.ts:94-97`
  ```ts
  declare module '@deepseek-ai/cordis' {
      interface Context {
          configForms: ConfigForms;
  ```
  `config-form.d.ts:137` `describe(): SettingsDescribeFace;`，`:142` `get<T>(entryId: string): ConfigForm<T>;`
- 快照字段：`lib/types/client/config-form-types.d.ts:6-34`（`status: 'loading' | 'ready' | 'unavailable'` 在 `:12`）。
- 写返回值：`config-form-types.d.ts:50-55`
  “@returns true for Host acceptance, false for refusal or skipped writes, after any latest-write recovery. Transport failures reject.”
- 运行时 `mutate`：`lib/client.js:1177-1195`
  ```js
  const response = await this.ctx.remote.settings.mutate(this.spec.namespace, ownedOps, revision);
  if (!response.ok) { await this.recover(generation); return false; }
  ...
  if (generation === this.writeGeneration) { this.pendingRevision = void 0; this.mirror.acceptView(response.value); }
  else this.pendingRevision = response.value.revision;
  return true;
  ```
  对照 0.1.5-rc.3（`c-rc3/lib/client.js:1040-1056`）：同一段代码，只是 `return;` 而非 `return false/true`。
- memory 模式短路：`lib/client.js:1212-1213` `if (this.persistence === "memory" || this.disposed) return Promise.resolve(false);`
- 派生与默认解码：`lib/client.js:1221-1255`（`draft.status = "unavailable"` 在 `:1229`；`decode(view)` 在 `:1245`
  用 `this.schema.validate(this.schema.rehydrate(view.schema), view.value)`）。
- `get` 无 decode、实例缓存、触发 `ensure`：`lib/client.js:1309-1316`
  `new ConfigFormController(this.owner, { namespace: entryId }, this.mirror, this.persistence, this.schema)`
- `describe()` 返回整个 mirror：`lib/client.js:1302-1304` `describe() { return this.mirror; }`
- mirror 读失败回到 idle：`lib/client.js:1457-1490`，关键行 `:1483`
  `status: held.view === void 0 ? "idle" : "ready", view: held.view, error: outcome.failure`
- 刷新挂点与 persistence：`lib/client.js:1503-1527`
  ```js
  const inject = ["remote", "remote.settings"];
  const persistence = ctx.remote.$host.isLoopback ? "host" : "memory";
  ... ctx.remote.$on("settings/document-updated", () => { mirror.load(); }), ctx.on("connection/reset", () => { mirror.load(); })
  ```
- 0.1.6-alpha.2 仍是 `settingsScope`（`c-0.1.6-alpha.2/lib/types/client/settings-scope.d.ts` 存在），改名发生在 0.1.7 线。

---

## 2. `remote.settings` 的 wire 方法

### 结论

- wire 形状 0.1.5-rc.1 → 0.1.7-alpha.2 **没有变化**（只删了与本插件无关的 `canOpenAgentPresetDirectory` /
  `openAgentPresetDirectory`）：
  - `describe(): RemoteResult<SettingsDescribeValue>`
  - `mutate(ns, ops: SettingsPathOpView[], expectedRevision: number|undefined): RemoteResult<SettingsNamespaceView>`
  - `update(ns, patch, expectedRevision)` / `replace(ns, section, expectedRevision)`：同样回 `SettingsNamespaceView`
- 失败是结构化的：`error.code` 为 `'settings/conflict'`（details `{ns, expected, actual}`）或
  `'settings/rejected'`（details `{ns}`）。**只有直接走 wire 才拿得到这个区分**，`ConfigForm.mutate` 把两者都压成 `false`。
- 与 `ConfigForms` 的关系：`ConfigForms` 只是 wire 上的一层（mirror 独占 `settings.describe`；form 的写就是
  `remote.settings.mutate` + `acceptView`）。
- Client 插件**可以**直接用：第一方 `dsh-client-ui-settings-models` 就在自己的 `inject` 里写 `'remote'`、
  `'remote.settings'`，直接调 `ctx.remote.settings.mutate` 并按 `code` 区分冲突/拒绝（见第 4 节）。直接写之后，
  可用 `ctx.configForms.describe().acceptView(response.value)` 把回答折回共享镜像（该方法在公开 face 上），
  否则要等 Host 的 `settings/document-updated` 广播触发 mirror 重读。
- 注意 `SettingsPathOpView.value` 是 `JsonValue`（不是 `unknown`），`ns` 在 wire 上是 `string`。

### 证据

- `research-client/dsh-api-settings-controller@0.1.7-alpha.2/lib/typert.remote-client.d.ts:17-23`
  ```ts
  interface TypertRemoteNamespace$73657474696e6773 {
    describe: () => Promise<RemoteResult<SettingsDescribeValue>>
    mutate: (ns: string, ops: SettingsPathOpView[], expectedRevision: number | undefined) => Promise<RemoteResult<SettingsNamespaceView>>
    ...
    replace: (ns: string, section: Record<string, JsonValue>, expectedRevision: number | undefined) => Promise<RemoteResult<SettingsNamespaceView>>
    update: (ns: string, patch: Record<string, JsonValue>, expectedRevision: number | undefined) => Promise<RemoteResult<SettingsNamespaceView>>
  ```
  与 `@0.1.5-rc.1` 同文件 diff 仅少 `canOpenAgentPresetDirectory`、`openAgentPresetDirectory` 两行。
- 错误码：`dsh-api-settings-controller@0.1.7-alpha.2/lib/types/types.d.ts:9-33`（`'settings/rejected'`、`'settings/conflict': { ns; expected; actual }`）。
- `RemoteResult` 形状：`dsh-typert-protocol@0.1.5-rc.1/lib/types/types.d.ts:65-71`（`{ok:true,value}|{ok:false,error:RemoteFailure}`，
  注释 “only assembly faults … still reject”）。
- wire view 类型：`s-0.1.7-alpha.2/lib/types/types.d.ts:18-63`（`SettingsNamespaceView` 新增 `autoGenerate: boolean`，
  `applies` 收窄为 `'live'`，`revision` 注释改为 “raw entry configuration”）。

---

## 3. Client 能否看到 Config 的非 volatile 字段

### 结论

**不能。** Host `SettingsForms.describe()` 对每个 entry 先算 `form = volatileForm(schema)`（只保留最近祖先是
volatile 的字段），然后 `schema/value/base/user` 全部用 `projectForm(form, …)` 投影。非 volatile 字段（包括作者在
profile patch 里写的 `config.presets`，只要它不是 volatile）**不会出现在 describe 里**；entry 若没有任何 volatile
字段，干脆不出现在 describe 里（Client 侧 `status:'unavailable'`）。写入同样受限：路径不在 volatile 节点下会抛
`Config field "…" is not volatile`。

对设计的含义（供 Host 调研合并判断）：

- 「只读预置目录走 settings 通道」只剩一条路：把目录声明成 **volatile** 字段，然后 Client 读该字段的 `base`
  （= bundle 层 + profile patch 里除用户 override 行之外的合成值，已解析默认值）。但 volatile = 可经 form 写，
  它不再是只读的：任何 `mutate` 都能在 profile patch 里给它写 override。
- 旧方案里的第二个命名空间 `composer-quick-actions-catalog` 不存在了：ns 现在 = profile entry id，一个 entry 一个 ns。
- `user` 层 = profile patch（`<profile>/cordis.patch.yml`）里**最后一个**带 `config` 的同 id 行，写入也落在那里，
  不再是 `settings.yaml`。
- `revision` 是 Host 进程内存计数，基于 `JSON.stringify([fiber.uid, schema.toJSON(), entry.options.config])` 变化递增，
  entry 重挂载（uid 变）也会递增；Host 重启从 0 起。

### 证据

- `s-0.1.7-alpha.2/lib/index.js:118-131` `volatileForm(schema)`；`:137-147` `projectForm(schema, value)`
  （注释 “Project only schema-declared fields, excluding ordinary configuration.”）。
- `s-0.1.7-alpha.2/lib/index.js:413-460` `describe(options)`：
  ```js
  const form = volatileForm(schema);
  if (form === void 0) return [];
  ...
  const value = projectForm(form, plainConfig(entry.fiber.config));
  const base = projectForm(form, plainConfig(inheritedConfig(entry.fiber.runtime, resolved)));
  const user = projectForm(form, override);
  return [{ autoGenerate, ns: entry.options.id, schema: form.toJSON(), revision, applies: "live", value: …, base: …, user: … }]
  ```
  以及 `:418` 的激活条件 `entry.fiber.state !== 2` → 跳过；`:420-425` revision 计算。
- 写入限制：`s-0.1.7-alpha.2/lib/index.js:503-507`
  `if (form === void 0) throw new Error(\`Plugin entry "${ns}" has no volatile fields\`);`
  `… if (path.length && !isVolatilePath(schema, path)) throw new Error(\`Config field "${path.join(".")}" is not volatile\`);`
- 层的来源：`research-client/dsh-config-editor@0.1.7-alpha.2/lib/index.js:30-57`（`entries()` 只取 include 下
  id 唯一的行；`configuration()` 的 `override` = `loaded.patches.findLast(row => row.id === id && row.config !== void 0)?.config`；
  `inherited()` 去掉该 override 后合成）；`:24-26` `documentPath` = `profileContext.patchPath`。
- 第一方 Host Config 的写法示例：`c-0.1.7-alpha.2/lib/types/index.d.ts:4-8`
  `export interface Config { enabled: Volatile<boolean>; }`，`dsh-client-locale@0.1.7-alpha.2/lib/types/index.d.ts`
  `preference: Volatile<string | undefined>`。

---

## 4. 已适配 0.1.7 的第一方 Client 插件范例

### 结论

0.1.7-alpha.2 线里 `ctx.configForms` 的消费者：`dsh-client-locale`、`dsh-client-ui-conversation`、`dsh-client-ui-theme`、
`dsh-client-ui-settings-{general,agent-loop,subagent,shell,models,web-search}`、`dsh-cordis-client-runner`。
典型三种用法：

1. **简单偏好（theme / locale / conversation）**：`inject` 写 `'configForms'`，`ctx.configForms.get(NS)` 拿 form，
   `ctx.effect(() => form.subscribe(adopt))`，`adopt` 读 `getSnapshot().value`（`undefined` 时跳过），写用
   `form.set(field, value)`，不看返回值。
2. **带 revision 围栏的多字段保存（settings-subagent）**：`status==='ready' && writable` 才写；草稿 revision 与快照
   revision 不一致先判冲突；`await scope.mutate([...set ops], this.draftRevision)`，然后**用写后快照比对是否落地**
   （和本插件现有的「写后权威快照判定」同一思路）。
3. **需要区分 conflict / refused（settings-models）**：绕过 form，`inject` 加 `'remote'`、`'remote.settings'`，
   直接 `ctx.remote.settings.mutate(ns, ops, expectedRevision)`，按 `response.error.code === 'settings/conflict'` 分支。

### 证据（逐字）

- `research-client/dsh-client-ui-theme@0.1.7-alpha.2/lib/client.js:1554-1573`
  ```js
  * row. `remote` carries the forwarded settings invalidation that
  * `ctx.configForms.get(entryId)` subscribes to on this context.
  const inject = ["slots", "locale", "remote", "configForms"];
  ...
  const theme = new ThemeRuntime(ctx, ctx.configForms.get(THEME_SETTINGS_NAMESPACE));
  ```
  `:992` `const THEME_SETTINGS_NAMESPACE = "ui-theme";`；`:1370-1372`
  `ctx.effect(() => host.subscribe(() => { this.adopt(); }), "ui-theme: settings scope adoption");`；
  `:1425-1432` `adopt() { const section = this.host.getSnapshot().value; if (section === void 0) return; … }`；
  写：`:1405` `this.host.set(THEME_PREFERENCE_FIELD, id);`
- `dsh-client-ui-conversation@0.1.7-alpha.2/lib/client.js:17598-17606` inject 含 `"configForms"`；`:17665`
  `new ComposerSubmissionPolicy(ctx.configForms.get(CONVERSATION_SETTINGS_NAMESPACE))`；`:14340-14371` 同 theme 的 adopt 模式。
- `dsh-client-locale@0.1.7-alpha.2/lib/client.js:1489-1515` inject 含 `"configForms"`，
  `new LocaleRuntime(ctx, ctx.configForms.get(LOCALE_SETTINGS_NAMESPACE), bootstrap)`。
- `dsh-client-ui-settings-subagent@0.1.7-alpha.2/lib/client.js:696-727`
  ```js
  if (this.disposed || snapshot.status !== "ready" || !snapshot.writable || this.saving || …) return;
  if (this.draftRoutes !== void 0 && snapshot.revision !== this.draftRevision) { this.conflicted = true; this.publish(); return; }
  …
  await this.scope.mutate([{ op: "set", path: ["enabled"], value: desiredEnabled }, { op: "set", path: ["allowedModels"], value: … }], this.draftRevision);
  …
  const landed = this.currentEnabled() === desiredEnabled && sameRoutes(this.currentRoutes(), desired);
  ```
- `dsh-client-ui-settings-models@0.1.7-alpha.2/lib/client.js:3964-3973`
  `const inject = ["slots","locale","remote","remote.credentials","remote.llm","remote.settings","configForms","settingsSchema"];`；
  `:2770-2783`
  ```js
  writeSettings: async (ns, ops, expectedRevision) => {
      const response = await ctx.remote.settings.mutate(ns, ops, expectedRevision);
      if (response.ok) return { kind: "written", view: response.value };
      const { code, message } = response.error;
      return code === "settings/conflict" ? { kind: "conflict", message } : { kind: "refused", message };
  },
  ```
- `whileServed` 用法：`dsh-client-ui-settings-web-search@0.1.7-alpha.2/lib/client.js:307`
  `ctx.effect(() => ctx.configForms.whileServed([WEB_SEARCH_NS], () => ctx.slots.inject("plugins.item", () => ctx.slots.register({…`

---

## 5. 其余契约 0.1.5-rc.1 → 0.1.7-alpha.2 逐项 diff

### 结论表

| 契约项 | 0.1.5-rc.1 | 0.1.7-alpha.2 | 对插件影响 |
|---|---|---|---|
| settings 服务 | `ctx.settingsScope`（`bind({namespace, decode})` / `describe()`） | `ctx.configForms`（`get(entryId)` / `describe()` / `whileServed()`） | **破坏（运行时）**：`inject` 含 `settingsScope` → Client 不启动。须改 `inject` 与 `controller.ts` 的 `SettingsScopeService` |
| 绑定参数 | `bind({namespace, decode})`，可自带 decode | `get(entryId)`，无 decode，按 wire schema 校验 | 破坏：领域解码挪到读快照之后 |
| namespace | `composer-quick-actions` + `composer-quick-actions-catalog` 两个 | = entry id，只有 `composer-quick-actions` 一个 | **破坏**：目录命名空间消失（见第 3 节） |
| 写返回 | `mutate(...): Promise<void>` | `Promise<boolean>`；拒绝与冲突都为 `false`，传输故障 reject | 可赋值方向变化：手写 `Promise<void>` 可接住，但应改用布尔值；区分冲突仍需写后快照或直走 wire |
| 快照 | `status/value/base/revision/writable/mode` | 同上 + `user` | 兼容（手写类型更窄） |
| describe face | `getSnapshot/subscribe/ensure/acceptView`（`load` 不在 face，运行时有） | 相同 | 插件 `SettingsMirror.load()` 仍是越界用法；`contract.spec` 若钉 `describe()` 会失败，建议改 `ensure()` |
| 可写范围 | 注册的 namespace 全字段 | 仅 volatile 字段路径 | 破坏：Host 端 Config 须把用户状态字段声明成 volatile |
| `InputState.draft/attachmentIds/draftRev/phase` | 同 | 同 | 无 |
| `InputState.claim` | `{token; hint?; attachments?}` | 新增必有字段 `name` | 无（手写更窄，仍可赋值） |
| `InputState.occurrences` | `Occurrence[]`（在 `input.d.ts`） | 同形，移到 `draft-editor.d.ts` | 无 |
| `InputState.queue` | `readonly QueueRow[]`（含 `placement`） | `InboxState['next-turn']` = `readonly UserMessage[]`，**无 `placement`** | **破坏（仅类型）**：`contract.spec.ts` 的 `toExtend<InputState>()` 会红；插件运行时不读 queue。`InputQueueRow` 改成 `unknown` 即可；`execution.spec.ts:112-114` 的 `{placement:'queued'}` 夹具随之改 |
| `InputActions.setDraft/submit` | 有 | 有；另新增公开 `captureInsertion()` / `insertText(text, span)` | 无（v2 插入动作的现成入口，首版不用） |
| `contract/input.d.ts` 的依赖 | `lexical`、`./queue.ts` | `@deepseek-ai/dsh-agent/types`、`./draft-editor.ts` | 开发树需能解析 `@deepseek-ai/dsh-agent`（类型），否则 typecheck 第二遍报找不到模块 |
| `conversation.input.dock` | list / session / owner `InputZone{session,input}` | 同；另被列为新 Factory `conversation.content` 的 child | 契约兼容；但 dock 现在可能出现在 `variant:'embedded'` 的内容实例里（见不确定点） |
| `conversation.composer.dock` | list / session / 无 owner | 同 | 无 |
| Session 标准 props `sessionId/useSession/useInput/inputActions/t` | 有 | 有（另增 `useConversation`、`useProjection`） | 无 |
| `SessionSnapshot.sessionId/removed/running/subagent.address.mode/parentAvailable` | 有 | 有（删了 `queue`） | 无 |
| `ctx.conversation.blocks.storeFor` | `composer-blocks.d.ts` | 逐字相同 | 无 |
| `slots.register({name,id,order,locale})` / `slots.inject(key, cb)` | 有 | 同（新增 `registerFactory`、`session?` 目标） | 无 |
| `ctx.connection.state` | `getSnapshot(): ConnectionState\|undefined` + `subscribe` | 同；`ConnectionState = 'connected'\|'disconnected'\|'connecting'` | 无 |
| `ctx.locale.register(ns, dicts)` / `bind(ns)` | 有 | 同（两参重载仍在，运行时兼容）；`apply` 变为 async | 无 |
| primitives `Button` / `Pill` / `Input` | 有 | 有，`.d.ts` 与 0.1.2-rc.1 / 0.1.5-rc.1 逐字相同 | 无 |
| primitives `IconSearchOutline16` | 有 | **删除**，改为 `IconSearchOutlineRegular` / `IconSearchOutlineMedium` | **破坏（运行时）**：shell seed 表里没有该键，`<IconSearchOutline16 />` 取到 `undefined`，ActionPanel 渲染即抛 React “Element type is invalid” |
| primitives tarball `dependencies` | 无（坏包） | **仍无**，`lib/index.js` 照样裸 import `clsx`、`shiki`、`katex`、`micromark-*` 等 | 开发树不能升到 0.1.7-alpha.2 版本号来拿新图标类型，仍得锁 0.1.2-rc.1 + 手写/改名；或把图标换成自绘 |
| Cordis peer | `~4.0.x` | `~4.0.4` | 插件 `^4.0.2` 可覆盖 |

### 证据

- `InputState`：`research-client/dsh-client-ui-conversation@0.1.7-alpha.2/lib/types/client/contract/input.d.ts:236-255`
  ```ts
  readonly claim?: { readonly name: string; readonly token: string; readonly hint?: string; readonly attachments?: boolean; };
  readonly occurrences: readonly Occurrence[];
  /** Messages still waiting for their own turn. */
  readonly queue: InboxState['next-turn'];
  ```
  `:10` `import type { InboxState } from '@deepseek-ai/dsh-agent/types';`。
  `InboxState`：`dsh-agent@0.1.7-alpha.2/lib/types/types.d.ts:33-36`
  `readonly 'next-turn': readonly UserMessage[];`；`UserMessage`：`dsh-llm@0.1.7-alpha.2/lib/types/message.d.ts:144-146`
  （`extends MessageBase { readonly role: 'user' }`，全文件无 `placement`）。
- `InputActions`：同文件 `:206-226`（`captureInsertion(): TokenSpan;`、`insertText(text: string, span: TokenSpan): boolean;`、
  `setDraft(text: string): void;`、`submit(): void;`）。
- `Occurrence`：`contract/draft-editor.d.ts:82-101`（`occurrenceId/source/ref/offset/length/label/appearance?/clipboardText/invalid?`）。
- dock 声明：`contract/slots.d.ts:213-228`
  ```ts
  'conversation.input.dock': { kind: 'list'; scope: 'session'; owner: InputZone; };
  'conversation.composer.dock': { kind: 'list'; scope: 'session'; };
  ```
  `:379-382` `export interface InputZone { readonly session: SessionSnapshot; readonly input: InputState; }`；
  Factory 子项：`:280-327`（`'conversation.content'` 的 `children` 含 `'conversation.input.dock'`、`'conversation.composer.bar'`）；
  `:507-511` `ConversationContentInputProps { variant: 'main' | 'embedded'; … }`。
- 标准 props：`contract/slots.d.ts:332-339`（`useInput`、`inputActions`）；
  `dsh-client-ui-session@0.1.7-alpha.2/lib/types/client/index.d.ts:77-84`（`useSession`、`sessionId`、`useProjection`）。
- SessionSnapshot：`dsh-api-session-controller@0.1.7-alpha.2/lib/types/client/contract/snapshot.d.ts:58-70`；
  与 0.1.5-rc.1 diff 只删了 `QueuedMessage` 与 `queue`。
- composer blocks：`diff …/0.1.5-rc.1/…/composer-blocks.d.ts …/0.1.7-alpha.2/…/composer-blocks.d.ts` 无输出。
- slots register：`dsh-client-ui-slots@0.1.7-alpha.2/lib/types/index.d.ts:597-613`（`name/children/store/locale/registrant`）+
  list kind 的 `id/order`；`dsh-client-ui-renderer@0.1.7-alpha.2/lib/types/client/registry.d.ts:85,111`
  （`readonly register: SlotCore['register'];`、`inject(key, callback): () => void;`）。
- connection：`dsh-client-connection@0.1.7-alpha.2/lib/types/client/index.d.ts:29-33,99`；`client/connection.d.ts:17`。
- locale：`dsh-client-locale@0.1.7-alpha.2/lib/types/client/index.d.ts:199,209,219,226`（两种 `register` 重载与 `bind`）；
  运行时 `lib/client.js:1385-1386`
  `register(ns, localeOrDicts, dict) { const pairs = typeof localeOrDicts === "string" ? [[localeOrDicts, dict]] : Object.entries(localeOrDicts);`
- primitives 图标：`dsh-client-ui-primitives@0.1.7-alpha.2/lib/types/icons/index.d.ts:17-20`
  ```ts
  /** Regular one-pixel IconSearchOutline artwork. */
  export declare const IconSearchOutlineRegular: (props: IconProps) => import("react").JSX.Element;
  /** Medium IconSearchOutline artwork with a 1.3px stroke. */
  export declare const IconSearchOutlineMedium: (props: IconProps) => import("react").JSX.Element;
  ```
  0.1.5-rc.1 / 0.1.6-alpha.2 为 `icons/index.d.ts:11` `export declare const IconSearchOutline16: …`；
  `grep -c IconSearchOutline16 dsh-client-ui-primitives@0.1.7-alpha.2/lib/index.js` → `0`。
  插件使用点：`src/client/manager/ActionPanel.tsx:22,84`。
- `Button/Pill/Input`：`diff` 0.1.2-rc.1（本机 `node_modules/.pnpm/@deepseek-ai+dsh-client-ui-primitives@0.1.2-rc.1…/lib/types/`）
  与 0.1.7-alpha.2 的 `Button.d.ts`、`Pill.d.ts`、`Input.d.ts` 均无差异。
- primitives 依赖：`dsh-client-ui-primitives@0.1.7-alpha.2/package.json` 无 `dependencies` 字段（只有 `devDependencies`
  含 `clsx/shiki/katex/…` 与 `peerDependencies: {"@deepseek-ai/cordis": "~4.0.4"}`）；`lib/index.js` 的裸 import
  包含 `"clsx"`、`"shiki/core"`、`"katex"`、`"@shikijs/langs/*"` 等。

---

## 6. web shell 的 ModuleLoader seed 表与 `dsh.client` 格式

### 结论

- `@deepseek-ai/dsh-web-frontend@0.1.7-alpha.2` 的 seed 表仍含 `react`、`react/jsx-runtime`、`react-dom`、
  `@deepseek-ai/dsh-client-ui-primitives`（另有 `react-dom/client`、`@deepseek-ai/cordis`、`dsh-client-store`、
  `dsh-client-ui-slots`、新增 `dsh-client-ui-dockkit`）。
- primitives 命名空间（冻结对象，266 个键）里有 `Button`、`Pill`、`Input`、`IconSearchOutlineRegular`、
  `IconSearchOutlineMedium`，**没有 `IconSearchOutline16`**。
- `dsh.client` 格式不变：`platform: string`（web 消费者选 `web`）、`inject?: string[]`（仅信息性包名）、
  `immediately?: boolean`、`external?: string[]`。`dsh-client-modules` 的校验逻辑与 0.1.5-rc.1 相同。
  清单新增可选 `dsh.manifestVersion?: 1` 与 `engines.dsh`（声明性，暂无读取方强制）。
  `dsh.client.inject` 里的 `@deepseek-ai/dsh-client-ui-settings` 包仍存在，照写无妨；若改直走 wire，可补
  `@deepseek-ai/dsh-api-remotes`（第一方做法）。

### 证据

- `research-client/dsh-web-frontend@0.1.7-alpha.2/dist/assets/index-bRoh_x8K.js:126`
  ```js
  function AS(){return{react:Bd,"react/jsx-runtime":qd,"react-dom":Xd,"react-dom/client":tf,"@deepseek-ai/cordis":_d,"@deepseek-ai/dsh-client-store":bf,"@deepseek-ai/dsh-client-ui-slots":Of,"@deepseek-ai/dsh-client-ui-primitives":Fj,"@deepseek-ai/dsh-client-ui-dockkit":NS}
  ```
  同行 `staticModules:AS()`；`Fj=Object.freeze(Object.defineProperty({__proto__:null,BrandWordmark:Ny,Button:A0,…`，
  键表中 grep 得 `Button`、`Input`、`Pill`、`IconSearchOutlineMedium`、`IconSearchOutlineRegular`，无 `IconSearchOutline16`。
- `dsh-package-manifest@0.1.7-alpha.2/lib/types/types.d.ts:75-89` `DshClientManifest`（与 0.1.5-rc.1 同）；
  `:29-30` `manifestVersion?: 1`。
- `dsh-client-modules@0.1.7-alpha.2/lib/index.js:65-73`（`platform` 必须为字符串、`external` 可选字符串数组、
  `immediately` 可选布尔），`:714` `decl.platform !== "web"` 过滤。

---

## 7. 本机第三方插件（npm 最新版）的做法

### 结论

没有一个已经适配 `configForms`。截至 2026-09-23 的最新版：

| 包 | 最新版 | Client 读写自身设置的做法 |
|---|---|---|
| `dsh-context` | 0.54.4 | `ctx.inject(["settingsScope"], …)` 可选注入，`binder = c.settingsScope` —— 0.1.7 上该分支不执行，静默降级 |
| `@linxin666/dsh-remote-web-ui` | 0.3.24 | `(ctx.get("webUiSettings") ?? ctx.settingsScope).bind({…})` —— 0.1.7 上 `ctx.settingsScope` 为 undefined，会抛 |
| `dsh-codex-connect` | 0.1.0-alpha.4.40 | `settingsScope.bind({…})`（inject 声明含 `settingsScope`） |
| `dshmarket` | 1.58.0 | `ctx.inject(["settingsScope"], (scoped) => …)` 可选注入 |
| `dsh-better-sidebar` | 0.19.1 | 不用 settings |
| `@xmanrui/dsh-im` | 4.25.0 | Client 不读写 settings |
| `@linxin666/dsh-client-ui-skill-explorer` | 0.3.24 | 不用 settings |

可借鉴的只有「用 `ctx.inject([...], cb)` 做可选依赖、服务缺席时降级」这一模式；0.1.7 的正确写法只能参照第 4 节的第一方包。

### 证据

- `research-client/3p/dsh-context/package/lib/client.js:11842-11844` `ctx.inject(["settingsScope"], (raw) => { … const binder = c.settingsScope;`
- `3p/_linxin666_dsh-remote-web-ui/package/lib/client.js`：`settingsScope = (ctx.get("webUiSettings") ?? ctx.settingsScope).bind({ na…`
- `3p/dsh-codex-connect/package/lib/client.js`：`settingsScope.bind({`
- `3p/dshmarket/package/client/client.js`：`settingsScope"], (scoped) => {`
- 其余三包 `grep configForms|settingsScope|remote.settings` 无命中。版本号来自 `npm view <pkg> version`。

---

## 不确定点

1. **目录的去向**：Client 能拿到的只有 volatile 字段。目录要么做成 volatile 字段、读 `base`（但它随之变成可写），
   要么换别的 Host→Client 通道。这取决于 Host 侧调研，本文件不下结论。
2. **embedded 会话内容**：`conversation.input.dock` / `conversation.composer.bar` 现在是 Factory
   `conversation.content` 的 child，存在 `variant: 'embedded'`。本次只在 `dsh-client-ui-conversation` 里找到
   `renderFactorySlot("conversation.content", …)` 的主页面调用（`lib/client.js:15878`），没有全量搜所有第一方包，
   是否有侧栏或子代理视图用 embedded 渲染同一 Session 的 composer（这会影响 Resident Composer 信标判定），需要 GUI 实测。
3. `ConfigForm.mutate` 的 `false` 同时表示拒绝和冲突；若要保留「冲突 → 刷新后请用户再确认」的区分，要么继续用
   写后快照判定（`settings-subagent` 同款），要么像 `settings-models` 那样直走 `ctx.remote.settings.mutate`。
4. 未在 0.1.7 真实 GUI 里跑过；以上运行时结论都来自读已发布 bundle 源码。
