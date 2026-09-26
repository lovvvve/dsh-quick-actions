# DSH 0.1.7-alpha.2 Host 侧 Settings 新模型调研

> 调研日期 2026-09-23。只读调研，证据来自已发布的 npm tarball（`npm pack` 解包）和公开上游仓库 `github.com/deepseek-ai/deepseek-harness`（master，引入提交 `601d6761e4 feat(settings): project volatile Config through profile-backed forms (#4587)`，2026-09-21）。
> 行号均指解包后的文件。简称：
> - **S** = `@deepseek-ai/dsh-settings@0.1.7-alpha.2` `lib/index.js`（与 0.1.7-alpha.1 逐字相同，`diff` 无输出）
> - **CE** = `@deepseek-ai/dsh-config-editor@0.1.7-alpha.2` `lib/index.js`
> - **L** = `@deepseek-ai/cordis-plugin-loader@1.0.5` `src/config/entry.ts`
> - **Z** = `@deepseek-ai/schemastery@3.18.4` `src/index.ts`
> - **CK** = `@deepseek-ai/cosmokit@1.8.5` `src/volatile.ts`
> - **SC** = `@deepseek-ai/dsh-api-settings-controller@0.1.7-alpha.2` `lib/index.js`
>
> 版本线：0.1.5-rc.1、0.1.5-rc.3、0.1.6-alpha.1/2 的 `dsh-settings` 都还是旧的 `SettingsProvider`（带 `register` / `installSection`）；**0.1.7-alpha.1 起**才换成 `SettingsForms`。0.1.5-rc.3 发布于 0.1.7-alpha.1 之前 27 分钟，走的仍是旧模型。

## 总览：一句话模型

**Settings 不再持有独立的数据。** 一个「设置表单」就是 profile 里一个 Loader 条目（entry）的 `Config` schema 中标了 `.volatile()` 的那部分字段；namespace 就等于 entry id；写入由 `config-editor` 落进 **active profile 的 `cordis.patch.yml`**，成为该条目的 `config`；Loader 发现只有 volatile 字段变化时，不重挂 fiber，只把新值提交进插件拿着的 `Volatile` 引用，并向该 fiber 发 `loader/volatile-update`。`register`、第二个 namespace、`applies: 'restart'`、声明式 `base` 都没有了。

---

## 1. `SettingsForms` 的运行时语义

### 结论

- **枚举**：`describe()` 遍历 `configEditor.configuration()`，也就是 **root Include（id `include`）下直接挂着、且 id 唯一的 Loader 条目**。只有同时满足下面四条的条目才出现：插件 runtime 导出了 schemastery 的 `Config`（`"toJSON" in schema`）；fiber 存在；fiber `state === 2`（ACTIVE）；`Config` 里**至少有一个 volatile 字段**。namespace（`ns`）就是 `entry.options.id`。
- **`schema`**：`volatileForm(Config).toJSON()`，只含 volatile 子树，去掉了 `volatile` 标记，secret 字段的默认值也被去掉。
- **`value`**：`entry.fiber.config`（已解析的活配置，含 schema 默认值）先经 `plainConfig` 展开 `Volatile` 引用，再投影到表单字段。
- **`base`**：「profile 覆盖层之下」的配置。取法是把所有 bundle 层、home 层 patch 组合起来，但去掉 profile 层对该 id 的 `config`，经 `interpolate`（求值 `!!js`）后再 `resolveConfig`（因此**包含 schema 默认值**）；解析失败时退回原始值。最后投影到表单字段。
- **`user`**：active profile patch 里该 id **最后一行** `config`，投影到表单字段。
- **`revision`**：进程内的 `Map`，按 entry id 计数，详见第 6 节。
- **`applies`**：恒为 `'live'`。**`autoGenerate`** 见第 3 节。
- **写入位置**：`update` / `replace` / `mutate` 都走 `SettingsForms.write` → `configEditor.edit(entry, …)`，写的是 **active profile 的 `cordis.patch.yml`**（`profileContext.patchPath`），文件模式 0600，原子写入，写后立即 reconcile Loader。
- **写入内容**：写进去的是**整份 raw config**，不只是 volatile 字段。做法是先取当前组合好的 raw config，剥掉其中的 volatile 字段，再合并新的 volatile 值；ordinary 字段按当前的原始值被一起「钉」到 profile 层。如果结果和 inherited 深相等，就删掉 profile 行里的 `config`；删完只剩 `id`/`name` 的，整行删除。
- **`writable`**：**硬编码 `true`**。不存在「只读 profile」的概念。写入被拒只有几种情况：home patch 或命令行 overlay 覆盖了该条目（抛 `Configuration for "…" is overridden by a home patch or command-line overlay`）；条目不唯一或不在 root Include 下；条目不再 ACTIVE。没有 `profileContext` 时，`settings` 服务本身就被 `disabled`，`ctx.settings` 不存在。

### 证据

- S:413-452 `describe`：
  ```js
  const descriptors = this.ownerContext.configEditor.configuration().flatMap(({ entry, inherited, override }) => {
      const schema = this.schema(entry);
      if (schema === void 0 || entry.fiber === void 0 || entry.fiber.runtime === null || entry.fiber.state !== 2) return [];
      const form = volatileForm(schema);
      if (form === void 0) return [];
      ...
      const value = projectForm(form, plainConfig(entry.fiber.config));
      const resolved = interpolate(entry.fiber.ctx, inherited);
      const base = projectForm(form, plainConfig(inheritedConfig(entry.fiber.runtime, resolved)));
      const user = projectForm(form, override);
  ```
- S:538-541 `schema(entry)`：`const schema = entry.fiber?.runtime?.Config; return schema !== void 0 && "toJSON" in schema ? schema : void 0;`
- S:314-320 `inheritedConfig`：`try { return resolveConfig(runtime, inherited); } catch (_error) { return inherited; }`
- CE:30-35 `entries()` 只取 root Include 下 id 唯一的条目：
  ```js
  const candidates = [...this.ownerContext.loader.entries()].filter((entry) => entry.parent.tree.ctx.fiber.entry?.id === "include");
  ...
  return candidates.filter((entry) => counts.get(entry.options.id) === 1);
  ```
- `@deepseek-ai/dsh-app-boot@0.1.7-alpha.2` `lib/index.js:3328-3335`：root Include 条目为 `id: "include", name: "cordis:include"`。本插件经 bundle patch 顶层 `insert` 挂载，位于 root Include 之下，理论上可寻址（**尚未实测**）。
- CE:39-57 `configuration()` / `inherited()`：`override` 为 `loaded.patches.findLast((row) => row.id === entry.options.id && row.config !== void 0)?.config ?? {}`；inherited 是去掉 profile 层该 id 的 `config` 之后再 `composeEntries([...layers, patches])`。
- CE:63-125 `edit`：
  - `withFileLock(join(profile.dir, "package.json"))` 加锁，先 `reconcileProfilePatches`；
  - `const current = structuredClone(entry.options.config ?? {})`；
  - `if (fiber.state !== 2) throw new Error("Configuration plugin is no longer active")`；
  - `resolveConfig(fiber.runtime, resolved)`：**先整体校验，再写盘**；
  - `isDeepStrictEqual(next, inherited)` 时删除 profile 行的 `config`，否则 `document.add({ id, name, config: next })` 或 `setIn([index,"config"], next)`；
  - `writeFileAtomic(path, String(document), { mode: 384 })`；reconcile 失败时写回原文件并重新 reconcile。
- CE README「Known Limitations」原文：“A complete config override preserves ordinary fields but pins their current raw values at the profile layer.” / “Only uniquely addressed entries owned by the profile’s root Include are editable.” / “Edits target the active profile patch. Home patches and command-line overlays are read for precedence but are not write targets.”
- S:501-536 `write`：`strip(raw, form)` 删除 raw 里的 volatile 键，保留 ordinary 键，再 `mergeLayers(strip(raw, form), next)`。
- S:395-398：`get writable() { return true; }`
- `@deepseek-ai/dsh-base@0.1.7-alpha.2` `cordis.patch.yml`：`- id: settings / name: '@deepseek-ai/dsh-settings' / disabled: !!js "!ctx.get('profileContext')"`，`config-editor` 同理。
- 三种写法（S:470-500）：
  - `update`：`mergeLayers(current, input)`，`current` 是 profile 当前 raw 的表单投影；
  - `replace`：`mergeLayers(base, input)`，**先把 volatile 字段重置为 inherited 值**，不是清空；
  - `mutate`：按路径 set/unset；unset 一个 inherited 里有值的路径时，写回 inherited 值。
- 所有写入都经过 `cloneJsonShaped`（S:237-273），只接受纯 JSON（plain object / array / string / 有限 number / boolean / null）。

## 2. volatile 是什么、怎么声明、怎么通知

### 结论

- **声明方式**：schemastery 的方法 **`.volatile()`**，不是 `role('volatile')`。它等价于 `this.extra('volatile', true)`，同一节点重复调用会抛错。
- **位置限制**：volatile 节点必须位于「**固定的 object 路径**上、且没有外层 volatile」。放在 `dict` / `array` / `union` 的内部会在解析时抛 `volatile fields require a fixed object path without an enclosing volatile field`。整棵子树（例如 `z.any().volatile()`、`z.dict(profile).volatile()`）可以整体标为 volatile。
- **解析结果**：插件 `apply(ctx, config)` 收到的 `config.<field>` 是一个 `Volatile<T>` 引用，只有 `.get()` 一个方法。它返回**深冻结**的快照，不能含函数、环，也不能含非 plain object。ordinary 字段仍是普通值。
- **写入限制**：非 volatile 字段**不能**经表单写入。`mutate` 的路径在进入 `edit` 前就会被 `isVolatilePath` 校验；`update` / `replace` 在 `edit` 回调里由 `validatePaths` 校验，发现非 volatile 键就抛 `Error('Config field "x" is not volatile')`，文件不变。经 Remote 调用时，这类错误被映射为 `settings/rejected`。条目没有任何 volatile 字段时，抛 `Plugin entry "ns" has no volatile fields`。
- **通知机制**：Loader 在 `Entry.update` 里判断本次变化是否「只有 `config` 变、fiber ACTIVE、context 未变、`equalExceptVolatile` 成立」。成立时**不重挂 fiber**，调用 `_commitVolatile`：
  1. 用 fiber 的 `internal/config` waterfall 加 `Config` 重新解析 raw；
  2. 若任何 ordinary 的**有效值**变了，退回普通重挂；
  3. 否则把新快照写进原有 `Volatile` 引用（引用对象身份不变）；
  4. 对值确实变化的路径，发 **`loader/volatile-update`(paths)**。该事件**只派发给拥有该 fiber 的监听者**，过滤条件是 `owner.fiber === fiber`。
- **插件怎么观察**：
  - 最简单的做法是每次用时读 `config.x.get()`；
  - 需要刷新注册状态时，在**插件自己的 apply ctx 上** `ctx.on('loader/volatile-update', paths => …)`。挂在 `ctx.inject([...], child => …)` 子 fiber 上的监听**收不到**，因为子 fiber 是另一个 fiber。
  - `ctx.config` 不会被替换，也没有 `ctx.on('config')`。
- **候选配置非法时**：`_commitVolatile` 只记一条 warn，引用保持旧值。正常经 settings 写入时，config-editor 已先 `resolveConfig` 整体校验，非法值会被**拒绝写盘**，走不到这一步。

### 证据

- Z:480-483：
  ```ts
  Schema.prototype.volatile = function volatile() {
    if (this.meta.volatile) throw new TypeError('volatile schema is already wrapped')
    return this.extra('volatile', true)
  }
  ```
- Z:488-509 `validateVolatileSchema`：`dict` / `sKey` / `inner` / `list` 的子节点都以 `blocked = true` 递归，命中即抛上述错误。Z:520-528：volatile 节点解析为 `createVolatile(value)`。
- CK:39-45 `createVolatile` 返回 `Object.freeze({ get: () => current, [write]: … })`。CK:18-32 `snapshot` 负责深冻结，遇到函数、环、非 plain object 时抛 TypeError。
- S:153-158 `isVolatilePath`；S:507 `for (const path of paths) if (path.length && !isVolatilePath(schema, path)) throw new Error(\`Config field "${path.join(".")}" is not volatile\`)`；S:513-523 `validatePaths`。
- L:141-148：
  ```ts
  const volatileOnly = changes.length === 1 && changes[0] === 'config'
    && this.fiber.state === FiberState.ACTIVE && Object.getPrototypeOf(this.ctx) === this.parent.ctx
    && equalExceptVolatile(legacy.config, this.options.config, this.fiber.runtime?.Config)
  if (volatileOnly) this.fiber._config = this.options.config
  const pending = volatileOnly && this._commitVolatile() ? [] : changes
  ```
- L:162-192 `_commitVolatile`：
  - `resolveConfig(fiber.runtime!, fiber.ctx.waterfall(fiber, 'internal/config', raw, () => raw))`；
  - 失败时 `logger.warn('volatile config update failed for %C')` 并 `return true`，引用不变；
  - `if (!deepEqual(fiber.config, candidate, true)) … return false`，退回普通重挂；
  - `updateVolatile(ref, source)`；
  - `self[Context.filter] = (owner: Context) => owner.fiber === fiber; fiber.ctx.emit(self, 'loader/volatile-update', paths)`。
- `cordis-plugin-loader@1.0.5` `src/index.ts:29-34`：`'loader/volatile-update'(paths)`，注释写明“dispatched to the owning fiber only”。
- `cordis@4.0.4` `src/events.ts:171-173`：`.filter(hook => hook.global || !filter || filter.call(thisArg, hook.ctx))`。`registry.ts:300-302`：`inject()` 等于 `this.plugin({ inject, apply })`，是新的子 fiber。
- 上游 `docs/cookbook/adding-a-settings-card.md` 给出的官方范式：
  ```ts
  export const Config = z.object({
    endpoint: z.string().volatile(),
    retries: z.number().step(1).min(0).default(3).volatile(),
  })
  export function apply(ctx: Context, config: Config): void {
    ctx.on('loader/volatile-update', () => {
      ctx.logger.info('Retry limit: %d', config.retries.get())
    })
  }
  ```
  原文还有一句：“Use `.check()` for cross-field Config validation; these checks run on the Host before persistence”。但**已发布的 schemastery 3.18.4 类型声明里没有 `.check()`**（`lib/types/index.d.ts` grep 无结果），文档比发布版本超前。
- 上游 `docs/subsystems/settings.md`：“`settings/document-updated` invalidates form descriptors … It is a UI notification; consumers use `loader/volatile-update` only when they need to refresh registration facts.”
- 本地实测（`research-host/sandbox/probe.mjs`，使用上面两个 tarball 的源码）：
  ```
  state.get {"userActionsById":{"a":{"kind":"future","extra":[1,{"x":2}]}},"unknownTop":1} true   ← 冻结
  default {"schemaVersion":1}
  isVolatilePath state.x true presets false
  dict-volatile error: $.d.* volatile fields require a fixed object path without an enclosing volatile field
  invalid volatile: $.state.n expected number but got bad
  unknown keys inside object volatile: {"n":1,"extra":2}                                          ← object 保留未知键
  ```

## 3. `configure({auto})` 与 `autoGenerate`

### 结论

- `autoGenerate` 默认 `true`。它只是一个给客户端的提示，表示「可以按 schema 自动生成页面」。README 原话是“no shipped client does so yet”。它**不影响读写**。
- 不想要自动页面的插件，应在 `apply` 里用**可选的** `ctx.inject(['settings'], child => …)` 注册：`child.effect(() => child.settings.configure({ auto: false }, ctx.fiber))`。
  - 第二个参数必须传**业务插件自己的 fiber**。默认值是调用方 fiber，而在 inject 子插件里那就是子 fiber，不对。
  - 同一 fiber 重复 `configure` 会抛错。
  - 这样写，settings 服务晚到或被替换时会自动重新注册，没有 settings 时业务插件照常运行。
- 所有已适配的第一方插件一律这样写，而且 **Host 顶层 `inject` 都不再依赖 `settings`**。

### 证据

- S:370-381 `configure`：`if (this.presentations.has(fiber)) throw new Error("Settings presentation is already configured for this plugin instance")`；S:426：`const autoGenerate = this.presentations.get(entry.fiber)?.auto ?? true;`
- dsh-settings README 原文：“A plugin that ships its own page registers `configure({ auto: false }, ctx.fiber)` as an effect inside an optional `ctx.inject(['settings'], ...)` child from `apply` … the business plugin runs without Settings. The policy does not remove configuration reads or writes.”
- 范例见第 7 节（theme / chat / locale / agent-default-model / permission-presets 逐字相同）。

## 4. 旧 `settings.yaml` 导入（`importLegacyDocument`）

### 结论

- **时机**：`SettingsForms` 构造时挂了 `ctx.root.loader.await().then(() => this.importLegacyDocument())`，即 **Loader 把所有条目都 settle 之后执行一次**。
- **条件**：`<profile.home>/settings.yaml` 存在。`profile.home` 是 Harness home（`~/.dsh`），**所有 profile 共用这一份**。
- **重命名**：**第一次写入之前**先把整个文件改名为 `settings.yaml.imported`，因此**无论成功与否都只尝试一次**，也**只有最先启动的那个 profile 能导入**。
- **映射规则**：逐个顶层 section 处理，`ns = LEGACY_SECTION_ENTRIES[section] ?? section`。内置映射只有 3 个：`ui-developer-tools→ui-settings`、`ui-onboarding→ui-settings-general`、`shell→bash-sandbox/pwsh-sandbox`。**其余 section 都按同名 entry id 匹配**。`composer-quick-actions` 会匹配到 entry `composer-quick-actions`（本插件的装载 id）。
- **写法**：`await this.update(ns, values)`，不带 expectedRevision，走的是和表单完全相同的校验。失败只记两条 `logger.warn`，然后跳过，**数据只留在 `.imported` 文件里，不重试**。
- **会失败的情形**（任一即失败）：
  - 找不到同名条目（例如 `composer-quick-actions-catalog`）：`No configurable plugin entry`；
  - 条目没有导出 schemastery `Config`；
  - `Config` 没有 volatile 字段：`has no volatile fields`；
  - section 里有**任何一个顶层键**不在 volatile 路径上：`Config field "x" is not volatile`。**整个 section 原子失败**；
  - 插件此刻不是 ACTIVE（例如 apply 抛错）：`Configuration plugin is no longer active` / `is no longer configurable`；
  - 完整 Config 校验失败；
  - home patch 或 overlay 覆盖了该条目。
- **对本插件的直接含义**：
  - 旧 section 的顶层键是 `schemaVersion`、`layout`、`userActionsById`、`actionOrder`、`presetStateById`（见 `packages/composer-quick-actions/src/host/settings.ts` 中的 `quickActionSettingsSchema`），高版本还可能写出额外的顶层键。
  - 想让自动导入成功，新 `Config` 必须把**这 5 个键原样作为顶层 volatile 字段**声明，而且旧数据里不能有这 5 个以外的顶层键。
  - 如果改成套一层（例如 `state: z.any().volatile()`），自动导入**必然失败**，数据会落进 `settings.yaml.imported`。
  - 如果用户先把 DSH 升到 0.1.7、插件还是 0.1.0（其 apply 调用已不存在的 `settings.register`，会抛错；且没有导出 `Config`），这次唯一的导入机会就会失败，数据同样只留在 `.imported` 里。
- `composer-quick-actions-catalog` section：正常情况下从未写过 user 层（目录只走 base），通常不存在；即使存在，也只会 warn 后跳过，没有损失。
- 当前本机 `~/.dsh/settings.yaml`（2026-09-21 修改）的顶层 section 只有 `ui-onboarding`、`llm-openai-codex`、`agent-default-model`、`locale`，**没有 `composer-quick-actions`**。只列了键名，没有读值。

### 证据

- S:339-341：`ctx.root.loader.await().then(() => this.importLegacyDocument()).catch((error) => { ctx.logger.error(error); });`
- S:346-363：
  ```js
  const path = join(profile.home, "settings.yaml");
  if (!existsSync(path)) return;
  const imported = `${path}.imported`;
  await rename(path, imported);
  const sections = parse(await readFile(imported, "utf8"));
  for (const [section, values] of Object.entries(sections ?? {})) {
      const ns = LEGACY_SECTION_ENTRIES[section] ?? section;
      try { await this.update(ns, values); }
      catch (error) {
          this.ownerContext.logger.warn("settings: section %s of %s was not imported into entry %s", section, imported, ns);
          this.ownerContext.logger.warn(error);
      }
  }
  ```
- S:303-308 `LEGACY_SECTION_ENTRIES`（见上）。
- S:501-506：`if (entry === void 0 || schema === void 0) throw new Error(\`No configurable plugin entry "${ns}"\`); … if (form === void 0) throw new Error(\`Plugin entry "${ns}" has no volatile fields\`);`
- `dsh-app-boot@0.1.7-alpha.2` `lib/types/profile-context.d.ts:18` `readonly home: string`，是 Harness home。
- README 原文：“each section is written into the entry of the same id … the file is renamed to `settings.yaml.imported` before the first write, and a section the running composition rejects is logged and stays only in the renamed file.”

## 5. 写入 volatile config 后插件拿到的值

### 结论

- 写入时先 `cloneJsonShaped`，只允许 JSON。之后由 config-editor 对**完整候选 config** 调 `resolveConfig(fiber.runtime, waterfall('internal/config', next))`。
  - **校验失败 ⇒ 抛错，拒绝写盘，文件和活值都不变**。不会出现「写进去了但保留旧值」。
  - 通过后，Loader `_commitVolatile` 再解析一次，插件的 `.get()` 拿到的是**经 schema 解析后的值**（含默认值、transform），深冻结。
- **能否存 schema 之外的任意 JSON**：
  - 可以。把字段声明为 `z.any().volatile()`（或 `z.any().default({...}).volatile()`），其内部任意 JSON 原样保存、原样返回（实测嵌套和未知键都保留）；
  - `z.object({...}).volatile()` 也会保留未知键（实测 `{"n":1,"extra":2}`）；
  - 但 **Config 顶层（表单根）的未知键不能写入**，`validatePaths` 会拒绝；
  - raw 里已有的非表单顶层键（例如高版本写出的键）在写入时经 `strip` 保留，不会被删。
- 冻结快照：`.get()` 的返回值是 `Object.freeze` 的深冻结对象，插件不能原地修改，要改先拷贝。
- 数据形态：YAML 存储，并拒绝非有限数字、`undefined` 数组元素、Date/Map 等；与现有 `deepEqualJson` / 纯 JSON 模型兼容。

### 证据

- CE:76-77：`const resolved = fiber.ctx.waterfall(fiber, "internal/config", next, () => next); resolveConfig(fiber.runtime, resolved);`，位于 `writeFileAtomic` 之前。CE README：“Writes validate the complete candidate before touching disk … Invalid values and higher-layer overrides leave the file unchanged.”
- `cordis@4.0.4` `src/fiber.ts:50-62` `resolveConfig`：`if (result.issues) throw new ValidationError(result.issues)`。
- S:524-534 `strip`：只删 volatile 键，其余 raw 键原样保留。
- 上游 cookbook：“Reject an invalid value and verify that neither the file nor the live value changed.”
- 第 2 节的 probe 输出。
- 第一方先例：`@deepseek-ai/dsh-llm-pi-ai@0.1.7-alpha.2` `lib/index.js:1047` `const Config = z.object({ providers: z.dict(profile).default({}).volatile() });`，即把一整个结构化 dict 标为 volatile。

## 6. `SettingsConflictError` 与 `expectedRevision`

### 结论

- `SettingsConflictError`：`code = "SETTINGS_CONFLICT"`，携带 `expected` / `actual`，`name = "SettingsConflictError"`。经 Remote 映射为 `RemoteError("settings/conflict", …, { ns, expected, actual })`，其余拒绝一律是 `settings/rejected`。
- **计数粒度：按 entry id（per-namespace），进程内内存计数，不持久化。**
  - 每次 `describe()` 为每个条目计算 `raw = JSON.stringify([fiber.uid, schema.toJSON(), entry.options.config ?? {}])`；
  - 与上次**被观察到的** raw 不同就 +1；首次观察为 0。
  - 因此下面几种情况都会让 revision 前进：ordinary 字段变化、fiber 重挂（uid 变）、schema 变化、条目消失。多次变化之间如果没有 describe，只算 +1。
  - 每次成功写入后，`write` 末尾都会调一次 `describe()`，写入实际改变 raw 时恰好 +1。
- **进程重启后 revision 从 0 重新开始**。客户端拿着旧进程的 revision 去写，可能误冲突（数值不同），也可能数值碰巧相同、按新进程的状态放行（ABA）。
- 冲突检查的位置：在 config-editor 文件锁内、reconcile 之后、`change` 之前，拿新鲜的 `describe()` 比较。所以检查与写入之间对同一 profile 是串行的。
- `expectedRevision === undefined` 表示无条件写入。旧 settings.yaml 导入就是这样写的。

### 证据

- S:163-181 `SettingsConflictError`。
- S:421-435：
  ```js
  const raw = JSON.stringify([entry.fiber.uid, schema.toJSON(), entry.options.config ?? {}]);
  const previous = this.revisions.get(entry.id);
  const revision = previous === void 0 ? 0 : previous.revision + Number(previous.raw !== raw);
  ```
- S:453-462：条目不再活跃时 `revision = previous.revision + 1` 并发 `settings/document-updated`。
- S:508-511：`const descriptor = this.describe().find((row) => row.ns === ns); … if (expected !== void 0 && descriptor.revision !== expected) throw new SettingsConflictError(ns, expected, descriptor.revision);`，位于 `configEditor.edit` 回调内。S:536：写后 `this.describe()`。
- SC:480-496 `rejected()`：按 `code === "SETTINGS_CONFLICT"` 且 expected/actual 为 number 判定冲突。

## 7. 已适配 0.1.7 的第一方范例

### 结论

在 dsh-base 与 dsh-web-app@0.1.7-alpha.2 的全部 187 个 `@deepseek-ai/dsh*` 依赖里，用 `.volatile()` 的包有：agent-default-model、agent-loop、agent-preset-registry、permission-presets、llm-deepseek、llm-pi-ai、subagent、tool-subagent、web-search-deepseek，以及 client-ui 的 Host 半边 client-locale、ui-chat、ui-conversation、ui-settings、ui-settings-general、ui-theme。

- **形态最接近本插件**的是 client-ui 家族的 Host 半边：只导出 `Config`（全部是 volatile）和一个只做 `configure({auto:false})` 的 `apply`。浏览器半边经 `ctx.remote.settings` 或配置表单读取，Host 不再调用 `register`。
- Host 需要在运行时**读**值的插件（theme、permission-presets、agent-default-model）直接 `config.x.get()`。
- Host 需要**自己写**值的插件，agent-default-model 的做法是**绕过 settings，直接 `ctx.get('configEditor')?.edit(entry, () => ({...}))`**。注意这会整份替换 config。
- 迁移说明：上游没有 CHANGELOG。引入提交 `601d6761e4`（#4587，PR 页面不可见）同时更新了 `docs/cookbook/adding-a-settings-card.md`、`docs/subsystems/settings.md`、`docs/config-catalog.md` 与各包 README，**没有给第三方插件的迁移指南**。旧 settings.yaml 的处理只在 dsh-settings README 里有一段说明。

### 证据（逐字）

- `@deepseek-ai/dsh-client-ui-theme@0.1.7-alpha.2` `lib/index.js:80-95`：
  ```js
  const Config = z.object({
  	preference: z.union([...THEME_PREFERENCES]).default(DEFAULT_PREFERENCE).volatile(),
  	fontSize: z.number().step(1).min(12).max(17).default(14).volatile()
  });
  function apply(ctx, config) {
  	ctx.inject(["settings"], (child) => {
  		child.effect(() => child.settings.configure({ auto: false }, ctx.fiber));
  	});
  	ctx.on("webserver/index-inject", (table) => {
  		table.push(...bootThemeInjections(config.preference.get(), config.fontSize.get()));
  	}, { prepend: true });
  }
  ```
  同文件第 11 行 `const THEME_SETTINGS_NAMESPACE = "ui-theme";`：namespace 就是 entry id。
- `@deepseek-ai/dsh-client-ui-chat@0.1.7-alpha.2` `lib/index.js:36-50`：
  ```js
  const Config = z.object({
  	[TRANSCRIPT_VIEW_FIELD]: ChatSettingsFields[TRANSCRIPT_VIEW_FIELD].volatile(),
  	performanceUsage: ChatSettingsFields["performanceUsage"].volatile(),
  	linkOpening: ChatSettingsFields.linkOpening.volatile()
  });
  function apply(ctx) {
  	ctx.inject(["settings"], (child) => {
  		child.effect(() => child.settings.configure({ auto: false }, ctx.fiber));
  	});
  }
  ```
  该文件第 17-19 行还保留了旧格式值：`LEGACY_TRANSCRIPT_VIEW_MODE = "normal"`，“Read as `detailed`; never offered as a choice and never written back”。
- `@deepseek-ai/dsh-agent-default-model@0.1.7-alpha.2` `lib/index.js:20-59`（dsh-settings 的 devDep）：
  ```js
  static Config = z.object({
  	provider: z.string().required().volatile(),
  	model: z.string().required().volatile(),
  	reasoningEffort: z.string().volatile()
  });
  constructor(ownerContext, config) {
  	...
  	ownerContext.inject(["settings"], (child) => {
  		child.effect(() => child.settings.configure({ auto: false }, ownerContext.fiber));
  	});
  }
  async saveSelection(next) {
  	const entry = this.ownerContext.fiber.entry;
  	if (entry === void 0) return;
  	await this.ctx.get("configEditor")?.edit(entry, () => ({ provider: next.provider, model: next.model, ... }));
  }
  ```
  dsh-base `cordis.patch.yml` 给它的 bundle 默认值是 `config: { provider: deepseek-official, model: deepseek-flash }`，这些值就成了 `base`。
- `@deepseek-ai/dsh-permission-presets@0.1.7-alpha.2` `lib/index.js:134-179`：`presets: z.dict(...).default({...})` 是 **ordinary**（改动即重挂），`defaultPreset: z.string().volatile()` 是 live，读取时 `config.defaultPreset.get() ?? inferredDefault`。
- `@deepseek-ai/dsh-llm-pi-ai@0.1.7-alpha.2` `lib/index.js:2624-2632`：`ctx.on("loader/volatile-update", () => { try { ensureRegistrationFacts(); ensureDirectory(); } catch (error) { … } });`。`dsh-llm-deepseek` `lib/index.js:2228` 同样用法。
- 上游 cookbook §3 还说明，浏览器端自定义插件页收到 `form.state` 与 `form.mutate(operations, expectedRevision)`，并用 `ctx.configForms.whileServed` 让页面只在 Host 提供该 namespace 时存在。Client 侧细节不在本文范围。

## 8. 本机 web profile 的第三方插件是否已适配

### 结论

**没有一个已为 0.1.7 适配。** 它们在 npm 上的最新版本（2026-09-23 查询）仍调用旧的 `settings.register` / `installSection` / `settings.get`，最多做了「API 不存在就静默不注册」的降级。

| 包 | profile 已装 | npm latest | settings 用法（latest tarball） |
|---|---|---|---|
| dsh-context | 0.53.3 | 0.54.4 | `lib/index.js:3182-3189`：`if (typeof service.register !== "function") return; service.register(SETTINGS_NAMESPACE, SettingsSchema);`，缺少 register 时静默惰化 |
| dsh-better-sidebar | 0.19.1 | 0.19.1 | `lib/index.js:4888-4908`：`sctx.settings.register(ns, PrefsSchema)` + `describe` + `update(ns, patch, expectedRevision)` |
| dshmarket | 1.52.0 | 1.58.0 | `lib/*.js` 共 3 处 `settings.register(`；peer 为 `@deepseek-ai/dsh-settings: ^0.1.0-rc.7 \|\| ^0.1.1-rc.2 \|\| ^0.1.2-alpha.2` |
| @xmanrui/dsh-im | 4.21.2 | 4.25.0 | `inject(["settings"], r => { … r.settings?.get?.(…) …; r.on("settings/updated", …) })`，是旧的 get/事件接口 |
| dsh-codex-connect | 0.1.0-alpha.4.34 | 0.1.0-alpha.4.40 | `settingsCtx.settings.installSection(ctx, OPENAI_CODEX_SETTINGS_NS, Config, config, {...})`；peer 锁到 `… \|\| 0.1.5-rc.2` |
| @linxin666/dsh-remote-web-ui | 0.3.23 | 0.3.24 | 先试 `installSection`，再试 `register(ns, Config, { base: config ?? {} })`，外层包 `try {} catch {}` |
| @linxin666/dsh-client-ui-skill-explorer | 0.3.23 | 0.3.24 | Host 侧没有 settings 用法 |

因此社区里**没有可抄的第三方先例**，只能参照第 7 节的第一方范式。

---

## 对本插件的含义（可选方案与代价，不做决定）

硬约束先列出来：

1. 一个 entry 只对应一个 namespace，**不能再有 `composer-quick-actions-catalog`**，除非再挂第二个 Loader 条目。
2. 用户状态会落进 **每个 profile 自己的 `cordis.patch.yml`**，不再是 `~/.dsh/settings.yaml`。web 与 desktop 两个 profile 从此各存一份。
3. Host 顶层 `inject: ['settings']` 与 `settings.register` 都得去掉。插件自己的 `describe()` / 写入必须等 fiber ACTIVE 之后才能做：`describe` 过滤 `state !== 2`，config-editor 在 `state !== 2` 时直接拒绝。所以启动期的规范化重写不能放在 `apply` 同步路径里。
4. revision 是进程内按 entry 计数的，重启归零。

### 用户状态的持久化

| 方案 | 做法 | 收益 | 代价 / 风险 |
|---|---|---|---|
| A. 旧 section 的 5 个顶层键原样做 volatile | `Config = z.object({ presets: <ordinary>, schemaVersion: z.number().default(1).volatile(), layout: z.string().default('ribbon').volatile(), userActionsById: z.any().default({}).volatile(), actionOrder: z.any().default([]).volatile(), presetStateById: z.any().default({}).volatile() })` | **唯一能让 `importLegacyDocument` 自动迁移旧数据的形状**；Client 经表单或 `ctx.remote.settings` 读写的 `value` / `user` 形状与现状最接近 | 高版本新增的**顶层**键无法经表单写入，会被 `validatePaths` 拒绝；raw 里已有的会保留。要在 v2 加字段，就得往既有的 `any` 字段内部塞，或同步升 Config。`presets`（ordinary）会在第一次写入时被钉到 profile 层 |
| B. 包一层 `state: z.any().volatile()` | 整个模型进一个 any 字段 | 最宽松，高版本未知数据随意保留；写入只有一个路径 | **旧 settings.yaml 自动导入必然失败**，需要插件自带回退（见 D）；Client 读写要多一层 |
| C. 不走 SettingsForms，Host 直接 `ctx.configEditor.edit(entry, …)` | agent-default-model 的写法 | 不依赖 settings 服务，写入完全由插件掌握 | `edit` 回调给的是整份 raw config，**要自己保留 ordinary 字段**（agent-default-model 是整份替换）；没有 revision 冲突检测，要自己实现；Client 仍需要一个读取通道 |
| D. 插件自带遗留回退（与 A/B/C 组合） | 启动后 fiber ACTIVE 时，若自身状态为空，就读 `~/.dsh/settings.yaml.imported`（以及未改名的 `settings.yaml`）里的 `composer-quick-actions` section，并按插件自己的规则写入 | 能兜住「DSH 先升、插件后升」和方案 B 的导入失败 | Host 要直接读 Harness home 的文件，与「Host 不直接写文件」的精神边界要重新审视（此处只读）；另外要处理多 profile 重复导入与幂等 |

### 预置目录（原 `composer-quick-actions-catalog` 的 base 层）

| 方案 | 做法 | 代价 |
|---|---|---|
| E. 目录做成同一 entry 的 volatile 字段，由 schema 默认值或 bundle patch 的 `config` 提供 `base` | `describe().base` 本来就是「profile 覆盖层之下 + schema 默认值」 | 作者追加的 `presets` 是运行期合并的结果，**无法放进静态 schema 默认值**；做成 volatile 后，用户或表单也能改它（只读语义没了）；`replace` 会把它重置为 inherited 值 |
| F. 第二个 Loader 条目（例如 bundle patch 里再插一行 `id: composer-quick-actions-catalog`，`name` 指向包的一个子路径导出），只放一个 volatile 目录字段 | 保留两个 namespace 的形状 | cookbook §5 说明 Client 半边只挂在「裸包名」那一行上，子路径行只能当 Host 用；目录内容依旧受 E 的静态性限制；多一个条目意味着多一处安装身份 |
| G. 目录不再走 Settings | 例如仿照 theme，用 `webserver/index-inject` 把目录注入页面，或另找 Host→Client 通道 | 与 spec 第 17 节已闭合的「目录走 Settings base」决策冲突，需要重开决策；`webserver/index-inject` 只在页面加载时生效 |

### 其他需要一并决定的点

- 启动期规范化重写（spec 6.3）从 `settings.replace(ns, section, rev)` 改为 `update` / `mutate` / `replace`。注意新 `replace` 语义是「volatile 字段先重置为 inherited，再合并」，不再是整段替换 user 层。重写必须挪到 fiber ACTIVE 之后执行，还要能和 `importLegacyDocument` 并发，两者都在 `loader.await()` 之后运行，冲突检查可以兜住。
- 状态变化的 Host 侧观察：若 Host 需要反应，要在**插件自己的 apply ctx** 上监听 `loader/volatile-update`，不能在 inject 子 fiber 上监听。
- `configure({ auto: false })`：插件有自己的管理面板，按第一方范式注册即可。
- peer 版本线：0.1.7 的 `SettingsForms` 与 0.1.5 的 `SettingsProvider` 不兼容，需要决定是否双栈兼容（类似 remote-web-ui 的探测写法）还是只支持新线。

## 未决 / 需实测的点

1. 本插件经 bundle patch 顶层 `insert` 挂载的条目，在真实 web profile 里是否满足 `entry.parent.tree.ctx.fiber.entry?.id === "include"` 且 id 唯一（CE:31-34）。按 app-boot 的 root Include 结构推断应满足，但**没有实跑**。
2. `importLegacyDocument` 与插件 fiber 变为 ACTIVE 的先后顺序。`loader.await()` 应当等待所有条目 settle，但若插件 apply 里有异步初始化，时序需要实测。
3. 第一次写入后，profile `cordis.patch.yml` 会新增 `- id: composer-quick-actions / name: dsh-quick-actions / config: {...}` 一行。这一行对之后的插件升级、`dsh plugin remove`、dshmarket 的 patch 操作有什么影响，没有验证。
   - **`remove` 与重新 `add` 已由源码取证（票据 35，`0.1.7-rc.1` 的 npx 缓存，只读，未实跑）**：remove 只 `pnpm remove` 并把包从 `package.json` 的 `dsh.profile.bundles` 滤掉，**不写 `cordis.patch.yml`**，该行连同 `config` 保留（`dsh-plugin-manager/lib/types/operations.js:49-53,70-71,204`；Web 端 `index.js:640-666`）。重启时该行成了找不到目标的非 insert 覆盖行，只打 `patch: entry "composer-quick-actions" not found` 后跳过，不阻塞启动（`dsh-app-boot/lib/index.js:95-99`，注释 `:3533-3536`）。重新 `add` 同样不写 patch：组合按 bundle → profile → home → CLI 叠加，bundle 的 `insert` 先建出条目，profile 那一行再按 id 把 `config` 赋上（`:1014-1022`、`:2131-2134`）；之后 config-editor 用 `findLastIndex` 找到同 id 同 name 的旧行 `setIn`，不产生重复行（`dsh-config-editor/lib/index.js:92-104`）。结论：id 与包名不变、无人删过该行、新版 `Config` 接受旧值时，重装恢复五个状态字段。真机重装仍在票据 34。升级与 dshmarket 路径未查。
4. cookbook 提到的 `.check()` 在已发布的 schemastery 3.18.4 中不存在，Host 侧「写前业务校验」目前只能靠 schema 本身，或在 `internal/config` waterfall 里做。
