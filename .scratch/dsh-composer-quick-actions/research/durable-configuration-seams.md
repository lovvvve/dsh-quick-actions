# Durable Configuration and Preset Seams for Quick Actions

## Decision

Use the **Host `settings` service backed by `@deepseek-ai/dsh-settings-file`** as the persistence boundary for user-owned Quick Actions. Keep author-owned Preset Quick Actions in the installable package (or its Host composition config), with immutable, stable preset IDs; persist only user-created actions and user deltas keyed by those preset IDs. On the browser side, use the shipped **`ctx.settingsScope` / generated `ctx.remote.settings`** integration. Do not persist in browser memory, a Client-only store, an Agent preset, or a dynamic Cordis package.

This is a supported public seam and requires no DSH core change for ordinary JSON-shaped Quick Action state. The material gap is **first-class schema migration**: Settings has validation, layering, revisions, and reset, but no migration hook. If compatibility-schema-plus-rewrite is insufficient, the smallest core prerequisite is an atomic, pre-validation settings migration hook keyed by namespace and stored schema version.

`ctx.storageDomain` is also a supported durable Host seam, but is a heavier record store, has no generic Client persistence API, and explicitly has no data-migration facility. It is justified only if Quick Actions outgrow configuration semantics (large/high-frequency collections or point-write requirements).

## Evidence scope and Inspect limitation

Primary sources only were used:

1. Live Cordis Inspect Providers in this running DSH process.
2. The installed DSH implementation and first-party package references under:
   `/Users/lovvvve/Library/Application Support/io.github.hairyf.deepseek-harness-desktop/dependencies/dsh/`.

The live Host `Service.listService` directory and exact service queries verified `settings`, `settingsController`, `storage`, `storageDomain`, and `agentPresets`. The first Client `Service.listService` request was cancelled by the page, so Client details below are taken from the shipped Client implementation and its first-party package reference. The Client catalog available to the parent investigation contains no generic Client storage/persistence service; the supported Client settings surface is a proxy over Host persistence, not a browser-owned store.

No DSH source match for `Quick Action`, `quickAction`, or `quick-action` was found under the first-party `@deepseek-ai` packages. DSH therefore provides primitives, not a Quick Action registry or record schema.

## Supported facilities and gaps

| Facility | Classification | What it gives Quick Actions | Important limit |
|---|---|---|---|
| Host `settings` + file provider | **Supported public seam; recommended** | Namespaced JSON configuration, schema/defaults, composition `base` + user layer, durable writes, observation, reset, optimistic revisions | No migration callback; one user layer; arrays replace wholesale |
| Client `ctx.settingsScope` + `ctx.remote.settings` | **Supported public Client integration** | Mirrored namespace view and revision-fenced `set`/`unset`/`mutate`; canonical settings UI slots | Host is still authoritative; disabled on non-loopback pages |
| Host `ctx.storageDomain` over JSON/SQLite backend | **Supported public Host data seam; alternative** | Typed/version-stamped KV tables, stable record keys, durable point writes, change events | No generic Client API; no automatic data migration; explicit open/close ownership |
| `ctx.storage.backend` / raw `KvUnit` | **Infrastructure/internal consumer detail** | Backend implementation contract | Product packages are told not to touch backends directly; use `storageDomain` |
| Dynamic `harness.handle` / `host.call` | **Supported only for dynamic Cordis Packages; wrong lifetime here** | Package-private JSON RPC for a dynamic Host/Client pair | Dynamic definitions vanish on DSH restart; it is not the installable-package persistence seam |
| Agent preset files / `agentPresets` | **Supported composition facility, not Quick Action storage** | Selects per-session plugins/tools/skills | Agent-preset plugins cannot own a Host settings namespace; preset authoring is copy-only |
| Client local persistence | **Missing supported capability** | None found | No generic Client storage service; browser state is not the authority |
| Quick Action schema/registry/ID/migration API | **Missing capability** | None supplied by DSH | The installable package must own these domain rules |

## 1. Recommended Host seam: `settings`

### Exact live contract

Live Host Inspect describes `settings` as an abstract settings service whose provider owns raw-document `load`/`persist`, while the base class owns namespace registration, resolution, validation, change detection, and commit events.

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

A namespace is a unique lowercase-hyphenated identifier; duplicate registration fails. The returned owner scope exposes `get`, `watch`, `update`, and `replace`; its registration and observers are tied to the calling Cordis fiber. See the implementation at `node_modules/@deepseek-ai/dsh-settings/lib/index.js:271-315`. The optional consumer helper maps the plugin composition entry to `base` and falls back to that entry if the service detaches (`.../dsh-settings/lib/index.js:317-343`).

### Persistence and layering

The first-party contract states that resolved settings layer **schema defaults, composition `base`, then the user document section**, and writes touch only the user layer (`.../dsh-settings/README.md:10-12`, `46-58`, `88-94`). This directly supports reset-to-author/deployment behavior: `replace({})` re-inherits base and defaults (`.../dsh-settings/README.md:64-68`; implementation `.../dsh-settings/lib/index.js:392-440`).

Writes accept only lossless JSON-shaped values, validate the resolved candidate, persist first, then commit. Per-namespace writes serialize and an optional `expectedRevision` rejects stale writers (`.../dsh-settings/lib/index.js:443-471`; `.../dsh-settings/README.md:64-68`, `105-107`). Arrays are replacement values rather than recursively merged (`.../dsh-settings/lib/index.js:203-215`), which is why actions should be stored in ID-keyed maps plus a separate order array, not merged as an array of records.

The shipped file provider persists every namespace in `<DSH_HOME>/settings.yaml` by default, watches it, and preserves sections belonging to currently unloaded plugins (`.../dsh-settings-file/README.md:10-12`, `34-47`). It performs read-modify-write merging and atomic replacement; direct edits hot-reload (`.../dsh-settings-file/README.md:51-59`, `78-97`). A provider must be mounted: the service itself stores nothing (`.../dsh-settings/README.md:34-44`).

### Lifecycle constraints

* Registration is a fiber effect. Unloading the owner removes the namespace and observers, but it does **not** delete the file-backed user section (`.../dsh-settings/lib/index.js:271-297`; file-provider preservation at `.../dsh-settings-file/README.md:10-12`). A later process/plugin registration resolves from the same persisted section.
* Teardown refuses new writes and drains queued writes/watchers (`.../dsh-settings/lib/index.js:223-252`). An already-started write can reach storage after its registrant disposes, but then commits/notifies nobody (`.../dsh-settings/README.md:105-107`). Callers should await writes and let Cordis own registration disposal.
* Use a Host-plane owner. The shipped plugin-settings UI explicitly says an Agent-preset-mounted plugin carries config inline in `agent.cordis.yml` and **cannot register a settings namespace** (`.../dsh-client-ui-settings-plugins/README.md:88-97`).
* `applies: 'live' | 'restart'` is metadata. Quick Actions should normally be `live`.

## 2. Author presets without mutating them

DSH has no built-in “Preset Quick Action” declaration. The installable package must declare the catalog in one of two package-owned places:

1. **Strongest ownership:** an exported/static catalog compiled into the Host and Client package artifacts.
2. **Deployment-configurable ownership:** a `presets` field in the Host plugin's Schemastery `Config`, supplied by the installer's `cordis.yml` row. The plugin receives this as composition configuration.

Do not copy that catalog into user storage. Register only a user-state namespace, for example:

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

At runtime, combine the package catalog with `presetStateById` and append/order `userActionsById`. This means:

* package upgrade can add or edit a preset without rewriting user records;
* deleting a preset leaves at most an ignored delta/tombstone;
* resetting a preset removes its delta (`unset`), revealing the package definition;
* user-owned records never mutate or shadow the source preset object.

It is also possible to put authored defaults into `settings.register(..., { base })`, and Settings will correctly show/reset base-vs-user provenance. However, because the user document may override any path and arrays replace wholesale, keeping the actual preset catalog outside the user namespace gives a firmer author-owned boundary. Use `base` for defaults of **user-state fields**, not as the only copy of immutable preset definitions.

### Stable identity expectations

DSH enforces only the settings namespace identity; it supplies no Quick Action ID generator or rename semantics. The package must establish them:

* Keep one stable namespace, e.g. `composer-quick-actions`; renaming it strands the old section.
* Give each author preset a permanent package-scoped ID (for example `com.example.plugin:explain-selection`), independent of label, order, or localized text.
* Generate user action IDs once and persist them; never derive them from array position or mutable title.
* Treat an incompatible semantic replacement as a new preset ID. For intentional ID rename, ship an alias/migration map.
* Store order as stable IDs. Unknown IDs should be retained or ignored deterministically, not cause the whole namespace to fail.

For installable Client code, the browser module identity is the resolved manifest package name. A package declares `dsh.client` with `platform: 'web'`, exports `./client`, and must ship a built `lib/client.js`; duplicate package identities and missing bundles fail activation (`.../dsh-client-modules/README.md:28-44`, `64-68`).

## 3. Supported Client-to-Host boundary

### Static/installable package: settings Client service

`@deepseek-ai/dsh-client-ui-settings` is the canonical Client integration. It owns one mirror of Host settings and exposes `ctx.settingsScope.bind(spec)`. A bound scope contains resolved `value`, `base`, raw `user`, `revision`, writability/mode, and revision-fenced `set`, `unset`, and `mutate`; binding and disposal belong to the calling Client fiber (`.../dsh-client-ui-settings/README.md:25-40`, `50-62`).

The underlying generated Host controller has the live-Inspected contract:

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

Every read is redacted and writes map to Host `settings` operations; provider refusals are classified as `settings/conflict` or `settings/rejected` (`.../dsh-api-settings-controller/lib/index.js:291-307`, `419-430`, `439-472`, `532-546`). Thus the browser should not write files or own durable state; it edits through this Host authority.

For UI, a package may register a full `settings.section`, one `settings.general.item`, or a `settings.plugin.item` card keyed by namespace. The shipped plugin tab dispatches only the intersection of Host-served namespaces and registered cards; a namespace gets no automatic form (`.../dsh-client-ui-settings-plugins/README.md:28-36`, `52-60`). An external package must also produce the expected lazy-CJS `dsh.client` bundle (`.../dsh-client-ui-settings-plugins/README.md:93-97`).

**Locality constraint:** the shipped Client disables Host-persistent settings for non-loopback pages (`.../dsh-client-ui-settings/README.md:90-97`). The local DSH GUI is loopback, so this ticket's target is supported; remote-browser support would require a deliberate DSH policy change.

### Dynamic package-private RPC is not the installable seam

The dynamic Cordis runner provides these exact signatures:

```ts
harness.handle(
  method: string,
  handler: (args: JsonValue) => JsonValue | Promise<JsonValue>,
): () => void

host.call(method: string, args?: JsonValue): Promise<JsonValue>
```

The Host validates the handler and clones its result through a JSON boundary (`.../dsh-cordis-host-runner/lib/index.js:515-532`); omitted Client args become `null` (`.../dsh-cordis-client-runner/lib/client.js:165-184`). This is package-private **Client → Host** JSON RPC.

It should not be the basis of this persistent installable project. The owning first-party package explicitly says dynamic definitions live only in process memory and vanish on restart (`.../dsh-tool-cordis/README.md:10-12`). A static installable package using `settingsScope` already has the supported generated Settings Remote and needs no custom RPC. If `storageDomain` is chosen instead, the package must add a Host-owned Remote/controller API; DSH exposes no generic Client domain store.

## 4. Alternative Host seam: `storageDomain`

### Exact live contract

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

The domain name, version, layouts, compatibility versions, and invalid-record policy are validated by `defineDomain` (`.../dsh-storage-domain/lib/index.js:31-90`). Opening resolves a configured backend, loads and schema-validates every record, and optionally backs up/skips invalid records (`.../dsh-storage-domain/lib/index.js:317-398`). Writes are durable before in-memory change/event publication (`.../dsh-storage-domain/README.md:10-12`, `71-94`).

### Lifecycle and backend constraints

The caller owns `Domain.close()`, normally through a `ctx.effect` disposer; the facility closes leaked handles only when it unmounts (`.../dsh-storage-domain/README.md:47-59`; implementation `.../dsh-storage-domain/lib/index.js:337-351`, `409-450`). Only one open handle per domain name is allowed.

Product packages must consume `storageDomain`, not raw backend `KvUnit`; the domain package is explicitly the only consumer of the backend contract (`.../dsh-storage-domain/README.md:10-12`, `27-32`). A composition must mount `dsh-storage`, a backend, and `dsh-storage-domain`. The JSON backend requires an explicit root, supports `single` and `per-record`, and makes each resolved write durable (`.../dsh-storage-json/README.md:25-56`, `68-88`).

### Upgrade/migration reality

`compatibleVersions` only expands accepted stored version stamps (`.../dsh-storage-json/lib/index.js:352-365`); current schemas must still validate the loaded records. `invalidRecords: 'backup-and-skip'` is salvage, not migration. The domain's own first-party limitation is explicit: **“No data migration”**; incompatible versions reject and schema changes require hand migration (`.../dsh-storage-domain/README.md:144-154`).

Therefore `storageDomain` does not solve the migration gap; it only provides clearer record/version identity and durable point writes.

## 5. Agent presets are a different concept

DSH Agent presets are directories containing `agent.cordis.yml` and optional assets/skills. Shipped presets and user copies live in separate roots; user authoring is copy-only and cannot delete shipped presets (`.../dsh-agent-presets/README.md:10-12`, `28-58`, `71-75`). A session's preset selects tools, prompt sections, and skills (`.../dsh-agent-presets/README.md:30-34`); it is not a record store for UI Quick Actions.

Consequences:

* Do not edit a shipped Agent preset to add user actions.
* Do not interpret `agentPresets.copy/remove` as Quick Action CRUD.
* Do not place the persistent settings owner inside an Agent preset; the settings UI contract states that such plugins cannot register settings namespaces (`.../dsh-client-ui-settings-plugins/README.md:93-96`).
* The installable Host plugin belongs in the Host composition; an Agent-preset row may consume a Host service only if session-specific behavior is needed.

## 6. Schema upgrades and the smallest missing prerequisite

### What DSH supports now

Settings registration validates the stored section immediately; invalid stored state rejects registration (`.../dsh-settings/lib/index.js:271-290`). The exhaustive live `SettingsRegisterOptions` has only `base`, `applies`, and `validate`; there is no `version` or `migrate`. Settings writes provide atomic-at-namespace validation/persist/commit and optimistic revisions, but not a pre-validation transformation.

A package can implement a bounded migration today:

1. Include `schemaVersion` in user state.
2. Keep the registered schema backward-readable for every supported old version.
3. Read the old variant after registration, build canonical JSON, then `replace` it using the descriptor's `expectedRevision`.
4. Keep migration idempotent and retain tests/fixtures for released formats.

This works only while the new registration schema can parse the old document. A schema-breaking old document cannot be reached through public writes because registration fails first and writes require a live registered namespace (`.../dsh-settings/lib/index.js:271-290`, `443-460`).

### Smallest DSH core prerequisite if stricter migration is required

Add an owner-declared, atomic **settings namespace migration hook** before current-schema validation, conceptually:

```ts
register(ns, currentSchema, {
  version: N,
  migrations: {
    [oldVersion]: (oldJson) => nextJson
  },
  base,
})
```

The provider/service should read the raw user section, run an ordered pure JSON migration under the namespace write queue (and file-provider writer lock), validate against the current schema, persist, bump revision, then publish. This is smaller and better aligned than exposing raw file or backend access to plugins. If DSH does not add it, the package must retain compatibility schemas or own an out-of-band, provider-specific migration—an internal coupling this report does not recommend.

## Recommended boundary in one sentence

**Static installable package owns immutable preset definitions and stable IDs; Host `settings` owns only JSON user actions and preset deltas in one stable namespace; the local Client edits that namespace through `settingsScope`/`remote.settings`; lifecycle stays Cordis-fiber-owned, and version upgrades use a backward-readable schema plus revision-fenced rewrite until DSH gains a pre-validation migration hook.**
