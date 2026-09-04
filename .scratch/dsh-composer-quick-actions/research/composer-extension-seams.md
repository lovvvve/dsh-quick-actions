# Identify Supported DSH Composer Extension Seams

## Scope and source basis

This report answers the question against the live Cordis Inspect Providers and the packaged DSH implementation checkout:

`/Users/lovvvve/Library/Application Support/io.github.hairyf.deepseek-harness-desktop/dependencies/dsh/`

The checkout contains the deployed JavaScript artifacts, package manifests, bundle patches, and first-party package references for DSH `0.1.2-rc.1` (`package.json:14-16`; `node_modules/@deepseek-ai/dsh/package.json:1-4`). No web or secondary source was used.

Live Inspect discovery (`cordis_inspect_list`) confirmed the Client `Slots`, `Service`, `Event`, and `Builtin` providers and their exact query methods. The delegated session's follow-up Client query was cancelled by the runtime, so it did not provide a complete live catalog. A successful parent-session `Slots.listSubTree` query independently verified that `conversation.input.dock` is currently available as a `list`/`session` Slot with `replaceRisk: "none"`, required unique `id`, optional `order`/`label`, owner `InputZone { session, input }`, and standard `useInput`/`inputActions` props; the same live compact tree verified `conversation.composer.dock` as an available `list`/`session` Slot declared by `conversation.composer.bar`, with `replaceRisk: "none"`, required unique `id`, optional `order`/`label`, current `stats` occupant, and standard `useInput`/`inputActions`/`useSession`/`sessionId` props. The remaining exact contracts are cross-checked against the generated Inspect catalogs embedded in the shipped Client runner. That catalog says it is generated from the same AST walk as the Cordis documentation and freshness-gated so those representations cannot diverge (`node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js:1100-1111`).

Terminology in this report:

- **Supported public seam**: documented package/profile, Slot, Service, Event, or Cordis lifecycle contract intended for other packages.
- **Internal implementation detail**: reachable or observable in the current build, but package-private, absent from the public catalog, or explicitly described as internal.
- **Missing capability**: no supported seam in this checkout satisfies the requirement.

## Bottom line

| Requirement | Finding |
|---|---|
| Persist across DSH restarts/page refreshes | **Supported.** Install a Loader-backed **profile bundle** into the `web` profile. Its patch inserts an ordinary row for a built `dsh.client` package. This is separate from process-local dynamic Cordis Packages. |
| Add controls above the normal resident composer | **Supported:** `conversation.input.dock` (`list`, `session`). |
| Add controls below the normal active composer card | **Supported:** `conversation.composer.dock` (`list`, `session`). |
| Add compact controls inside the tool row | **Supported alternatives:** `conversation.input.left` and `conversation.input.right`. |
| Automatically clean up registrations/listeners | **Supported:** register through `ctx.slots.inject(...)`, `ctx.slots.register(...)`, `ctx.on(...)`, and `ctx.effect(...)`; all are fiber-owned. |
| Read/update the current draft | **Partly supported:** Slot components receive `useInput` and stable `inputActions`; `inputActions.setDraft(text)` replaces the **whole** draft and moves the caret to the end. |
| Insert static text at the current selection | **Missing as a public seam.** The implementation has a package-private `paste(text)` and span-based `slash/input-insert-text` path, but neither is exposed in `InputActions` or the public Client Event catalog. `InputState` omits selection. |
| Submit the current draft through the composer path | **Supported:** call the Slot prop `inputActions.submit()`. The shipped primary send button calls that same function. It enters the input machine, command adjudication, optimistic commit, and default `sendSession` sink. |
| Appear around literally every composer, including no-session and takeover composers | **Missing as one universal additive Slot.** The two docks belong to the resident fallback composer. A chain takeover hides that fallback; the below-card dock is also absent in hero mode, and both session-scoped docks are absent with no Session. |

The practical conclusion is therefore: a persistent quick-actions package can safely render buttons above or below every **normal, session-backed resident composer** and can submit the current draft officially, but it cannot officially splice text at the live selection, and it cannot guarantee visibility around replacement/takeover composers without a new upstream seam.

---

## 1. Supported persistent package mechanism

### 1.1 The persistent unit is a web-profile bundle, not a dynamic Cordis Package

The supported launcher describes profiles as ordered stacks of bundle patch layers. A profile directory contains:

- `package.json` with `dsh.profile.bundles` and `patchReload`, and
- `cordis.patch.yml` as the user's later patch layer.

Bundle patches apply in bundle order, followed by profile and home patches and then `--patch` overlays (`node_modules/@deepseek-ai/dsh/README.md:33-47`; executable composition order in `node_modules/@deepseek-ai/dsh/lib/profile-boot-BTzzdrGY.js:166-210`).

The exact bundle manifest declaration is:

```json
{
  "dsh": {
    "bundle": {
      "patch": "./cordis.patch.yml"
    }
  }
}
```

`loadProfile()` reads precisely `package.json.dsh.bundle.patch`, fails if it is absent, joins it to the package directory, and parses that patch (`node_modules/@deepseek-ai/dsh-app-boot/lib/index.js:834-879`). The package-level contract is also stated verbatim in the profile module documentation (`node_modules/@deepseek-ai/dsh-app-boot/lib/index.js:286-309`). Shipped bundles use exactly this field, for example `@deepseek-ai/dsh-web-app` (`node_modules/@deepseek-ai/dsh-web-app/package.json:25-40`) and `@deepseek-ai/dsh-base` (`node_modules/@deepseek-ai/dsh-base/package.json:21-35`).

A bundle patch is a top-level list. The ordinary way to add the browser package's Loader row is an insert such as:

```yaml
- insert:
    - id: composer-quick-actions
      name: '@scope/dsh-composer-quick-actions-client'
```

This follows the shipped web bundle's browser roster, which is one `insert` containing ordinary `{ id, name, ... }` rows (`node_modules/@deepseek-ai/dsh-web-app/cordis.patch.yml:39-43,151-175,207-214`). Loader entry options are publicly documented as `id`, `name`, `config`, `group`, `disabled`, and `inject` (`node_modules/@deepseek-ai/cordis-plugin-loader/README.md:25-35`).

`dsh plugin --profile web add <package>` is the supported installation path. It forwards to pnpm in the profile directory and then appends installed dependencies that declare `dsh.bundle` to `dsh.profile.bundles`; bundle-less dependencies remain plain dependencies and are not activated as layers (`node_modules/@deepseek-ai/dsh/lib/plugin-F7ZVfRyo.js:7-16,20-33,35-77,96-127`). Therefore:

- a **client-only** package installed as a dependency is not enough to persistently mount it;
- either a bundle package must insert that client row, or the user's persistent profile patch must insert it manually;
- the canonical installable package mechanism is the bundle declaration above.

The web profile is a host-plane composition. The shipped patch explicitly calls its `dsh.client` rows “the browser roster” (`node_modules/@deepseek-ai/dsh-web-app/cordis.patch.yml:39-42,151-156`) and separately moves only the agent/tool plane behind per-session presets (`same file:308-313,433-439`). The Client module scanner listens to the host Loader's `internal/plugin` events and scans `ctx.loader.entries()` (`node_modules/@deepseek-ai/dsh-client-modules/lib/index.js:434-479`). Thus an agent preset is not the correct home for a global browser-composer extension.

### 1.2 Exact persistent Client package declaration

A browser package declares `dsh.client`, exports `./client`, and ships the already-built browser artifact. The package reference states this as the authoring contract (`node_modules/@deepseek-ai/dsh-client-modules/README.md:25-44`). The executable parser accepts this exact shape:

```ts
interface DshClientDeclaration {
  platform: string                 // only "web" is selected here
  inject?: string[]                // package/row prerequisites
  external?: string[]              // non-baseline runtime module requests
  immediately?: boolean
}
```

The parser rejects a non-object declaration, a missing/non-string `platform`, non-string arrays, or a non-boolean `immediately` (`node_modules/@deepseek-ai/dsh-client-modules/lib/index.js:139-154`). It accepts `exports["./client"]` either as a string or as an object with a string `default` (`same file:155-165`). During scan, only `platform === "web"` survives; absence of `./client` is a hard error, and the resolved artifact path and manifest fields become the boot graph row (`same file:618-647`).

A representative shipped UI package has:

- root/default export for its Loader row;
- `./client` export pointing at `lib/client.js`;
- `dsh.client.inject` containing package names that must precede it;
- `platform: "web"`;
- built `lib/index.js` and `lib/client.js` files.

See `node_modules/@deepseek-ai/dsh-client-ui-plan/package.json:13-37,57-65`. Its Node/root half is intentionally an empty `apply()` solely so the package can exist as a host Loader row while its browser behavior comes from `exports["./client"]` (`node_modules/@deepseek-ai/dsh-client-ui-plan/lib/index.js:1-12`). This is the exact precedent for a pure browser feature.

Important distinction: manifest-level `dsh.client.inject` contains **package names used by the browser boot graph**. Runtime Cordis injection is the Client module's exported `inject` array of **Service keys**. For example, `ui-plan` has package prerequisites in its manifest (`package.json:28-36`) but exports runtime Service keys `slots`, `remote`, `remote.commands`, and `locale` (`lib/client.js:103-135`). A composer quick-actions Client package would at minimum order itself after `@deepseek-ai/dsh-client-ui-conversation` at the manifest level and inject `slots` at runtime.

Built Client artifacts use DSH's lazy-CJS registration wrapper:

```js
window.__ModuleLoader__.load({
  id: "@scope/package",
  factory: (require) => { /* exports.apply / exports.inject */ }
})
```

A shipped artifact begins with exactly that form (`node_modules/@deepseek-ai/dsh-client-ui-plan/lib/client.js:1-4`) and exports `apply`/`inject` at its tail (`same file:103-136`). The Client module system explains that executing the bundle registers a lazy factory and first materialization runs its body (`node_modules/@deepseek-ai/dsh-client-modules/lib/index.js:7-37`).

This is persistent across normal page loads because every enabled Loader row declaring `dsh.client` is scanned into `window.__DSH_BOOT__` and served under `/plugins` (`node_modules/@deepseek-ai/dsh-client-modules/README.md:10-12,28-44`). This contrasts with dynamic Client Packages, for which “nothing is restored after a refresh” (`node_modules/@deepseek-ai/dsh-cordis-client-runner/README.md:10-12,38-40`).

Loading-time boundary: the profile manifest and bundle list are composed during process boot. In `patchReload: "live"` mode, the running launcher watches only the profile and home `cordis.patch.yml` files (`node_modules/@deepseek-ai/dsh/lib/profile-boot-BTzzdrGY.js:233-261,271-288`), not `package.json.dsh.profile.bundles`. Installing a new bundle therefore persists it for the next DSH boot; it is not evidence that the already-running process mounted it. During development, Client HMR also needs an external build watcher to rewrite `lib/client.js` before the existing page can swap it (`node_modules/@deepseek-ai/dsh-client-hmr/README.md:24-36`).

### 1.3 Packaging limitation that must not be hidden

The mechanism is supported, but the checkout documents a tooling gap for out-of-tree browser plugins: the `clientBundle` tsdown preset that emits the required lazy-CJS artifact lives inside the DSH monorepo and is **not published**, so an external plugin must reproduce that build (`node_modules/@deepseek-ai/dsh-client-ui-settings-plugins/README.md:88-97`). The module system also fails activation loudly when `lib/client.js` is missing (`node_modules/@deepseek-ai/dsh-client-modules/README.md:42-44`; implementation diagnostics at `lib/index.js:90-119`).

The source independently parses `dsh.bundle` and `dsh.client`, so it does not reject a manifest containing both. However, the shipped examples establish a clearer two-role pattern: a bundle carries the patch, and an inserted UI package carries the Client row. No source in this checkout explicitly promises a one-package self-inserting layout, so it should not be presented as the canonical contract without a test.

---

## 2. Exact supported composer Slots

The shipped Client runner embeds the generated Slot contract ledger. It includes kind, scope, owner props, standard props, registration options, declaring owner, current occupants, replacement risk, and original source location (`node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js:2133-2145`).

### 2.1 Above: `conversation.input.dock`

Exact contract:

- key: `conversation.input.dock`
- kind: `list`
- scope: `session`
- purpose: “Full-width entries above the composer card.”
- registration: required unique `id`; optional ascending `order` (default `0`) and optional `label`
- owner props:

```ts
interface InputZone {
  readonly session: SessionSnapshot
  readonly input: InputState
}
```

- standard props include `useInput: SnapshotSelectorHook<InputState>`, `inputActions: InputActions`, `useSession`, `sessionId`, `useProjection`, and the other standard Session/Workspace hooks.

All of that is recorded at `node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js:2672-2724` (the catalog records original source `packages/client/ui-conversation/src/client/contract/slots.ts:127`). It is additive (`replaceRisk: "none"`); shipped occupants include Queue, Todo, and Goal docks (`same range:2716-2723`).

The owner actually renders this Slot immediately before the resident composer bar:

```tsx
zone !== undefined && renderSlot("conversation.input.dock", zone)
inputBar
```

See `node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js:14401-14404,14437-14461`. This is the best supported seat for a full-width quick-action row **above** the normal session-backed composer.

Boundary: `zone` exists only when both a Session snapshot and Input state exist. Consequently this Slot does not render in the no-Session inert state (`same file:14401-14404,14436-14460`).

### 2.2 Below: `conversation.composer.dock`

Exact contract:

- key: `conversation.composer.dock`
- kind: `list`
- scope: `session`
- purpose: “Ambient entries below the composer card.”
- registration: required unique `id`; optional `order` and `label`
- no owner-specific props
- standard props include `useInput`, `inputActions`, `useSession`, `sessionId`, `useProjection`, and the standard Session/Workspace hooks.

See `node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js:2463-2511` (catalog source `packages/client/ui-conversation/src/client/contract/slots.ts:131`). `ui-chat` provides a concrete supported precedent by registering its `stats` row through `ctx.slots.inject(... register(...))` (`node_modules/@deepseek-ai/dsh-client-ui-chat/lib/client.js:8147-8152`).

The InputBar renders this Slot after the composer card, but only for the active `composer` variant with Session and Input present:

```tsx
variant === "composer" && input !== undefined && sessionId !== undefined
  ? renderSlot("conversation.composer.dock", {})
  : null
```

See `node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js:15713-15718`. It therefore does **not** render below the centered hero variant.

### 2.3 In-row alternatives

If “above/below” is not essential and the controls should sit inside the composer toolbar:

- `conversation.input.left`: `list`, `session`, “Compact controls at the left of the composer tool row”; required `id`, optional `order`/`label` (`node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js:2727-2775`).
- `conversation.input.right`: `list`, `session`, “Compact controls before the composer submit action”; same list options (`same file:2893-2941`).

The InputBar places those Slots exactly in those positions (`node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js:15612-15643`).

### 2.4 Slots that look relevant but are not additive quick-action seams

#### `conversation.composer.bar`

This is `single`, `session-maybe`, and already occupied by the shipped `InputBar`. Registering another entry shadows the shipped composer (`replaceRisk: "shadows-shipped-ui"`) (`node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js:2433-2460`). Its owner prop includes `accessory?: ReactNode`, documented as content above the surface (`same file:2439`), but that is an input **to the sole bar occupant**, not an additive accessory Slot. A third-party registrant cannot set `accessory` on the existing InputBar; it would have to replace the whole bar and reimplement the composer. That is not a supported quick-actions approach.

#### `conversation.composer`

This is a `chain` of selector-routed **replacements** for temporary Session interactions, not an additive region (`node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js:2388-2430`; public usage constraints in `node_modules/@deepseek-ai/dsh-client-ui-conversation/README.md:51-97`). The shell invokes it with `overlay: true` and the resident bar as fallback (`node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js:14463-14472`). When a chain entry wins, the renderer keeps the fallback mounted but sets its wrapper to `display: none` (`node_modules/@deepseek-ai/dsh-client-ui-renderer/lib/client.js:871-878`). Thus both resident docks are visually hidden during approval/question/subagent takeover composers.

### 2.5 “Every composer” is not fully supported

There is no additive Slot outside the `conversation.composer` chain that wraps both its fallback and elected replacements. Therefore:

- above normal session-backed resident composer: yes (`conversation.input.dock`);
- below active normal resident composer: yes (`conversation.composer.dock`);
- no-Session inert composer: neither session-scoped dock;
- centered hero: above dock can render when a Session/Input exists, below dock does not;
- elected takeover composer: resident fallback and its docks are hidden.

A literal “above/below every composer implementation” requirement needs a new outer Slot around the chain/seat. That capability is absent in this version.

---

## 3. Lifecycle-safe registration and cleanup

### 3.1 Slot lifecycle

The supported registration pattern is:

```ts
ctx.slots.inject("conversation.input.dock", () =>
  ctx.slots.register(
    { name: "conversation.input.dock", id: "my-unique-id", order: 100 },
    QuickActions,
  ),
)
```

`SlotsService.inject` has the exact public signature:

```ts
inject(
  key: keyof SlotMap & string,
  callback: () => SlotInjectionEffect,
): () => void
```

Its contract says the callback runs for each declaration lifetime; declaration collapse disposes it; re-declaration runs it again; iterable effects install transactionally and dispose in reverse order; and the controller belongs to the caller's fiber, so unload cancels a pending wait and removes an active contribution (`node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js:1317-1336`). The implementation does exactly that with nested `ctx.effect` calls and idempotent stop/reconcile logic (`node_modules/@deepseek-ai/dsh-client-ui-renderer/lib/client.js:1000-1074`).

`slots.register` itself is routed through the **caller** context and implemented as:

```js
return this.ctx.effect(
  () => this._register(options, component),
  "slots.register()",
)
```

See `node_modules/@deepseek-ai/dsh-client-ui-renderer/lib/client.js:1250-1271,1388-1391`. Therefore both the wait and registration are fiber-owned; explicit global DOM mounting is unnecessary and would weaken cleanup.

### 3.2 General Cordis lifecycle

Cordis documents that effects, event listeners, and services are removed with their owning fiber (`node_modules/@deepseek-ai/cordis/README.md:61-67`). More precisely:

- `ctx.on(name, listener, options?)` registers the listener as a fiber effect and removes it automatically on unload (`node_modules/@deepseek-ai/cordis/lib/index.js:327-379`).
- `ctx.effect(execute, label?)` collects callback/iterable/async effect disposers and executes collected cleanup in reverse order (`same file:1124-1168,1168-1184`).
- `ctx.provide(name, value, check?)` is also a fiber effect; disposal unregisters the service and refreshes dependents (`same file:789-823`).

Component-local browser listeners/timers should likewise be installed in `React.useEffect` with a cleanup return, or be wrapped in `ctx.effect`. Direct mutations of the composer DOM are not lifecycle or API safe.

---

## 4. Draft and selection: supported surface versus internal implementation

### 4.1 `inputActions` is a standard Slot prop, not a Cordis Service

`ui-conversation` contributes `input` as a hook source and `inputActions` as a stable plain prop via `ctx.uiSession.provide()` (`node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js:16039-16056`). The renderer materializes those provided sources into standard component props and selector hooks (`node_modules/@deepseek-ai/dsh-client-ui-renderer/lib/client.js:537-573,588-626`). This is why the two dock Slot contracts include `useInput` and `inputActions`.

The generated Slot ledger names the compile-time type `InputActions` (`node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js:2490-2502,2699-2711`). The exact erased runtime face in this packaged checkout is:

```js
actions = {
  setDraft: (text) => { this.setDraft(text) },
  addImages: (ids) => this.addImages(ids),
  removeImage: (id) => { this.removeImage(id) },
  pruneImages: (ids) => { this.pruneImages(ids) },
  submit: () => { this.submit("queue") },
}
```

See `node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js:11483-11510`. The executable code and its callers establish `text` as the draft string and `id`/`ids` as draft-attachment identities; this deployed package does not physically include the advertised declaration file, so this report does not invent erased readonly modifiers.

The public Input snapshot is composed as:

```ts
{
  draft,
  imageIds,
  draftRev,
  phase,
  claim?,
  occurrences,
  queue,
}
```

and contains **no selection or caret** (`node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js:12235-12245`).

### 4.2 What `setDraft` actually does

`setDraft(text)` is a whole-document replacement. It strips reserved reference placeholders, clears the Lexical root, creates paragraphs from newline-separated text, and calls `root.selectEnd()` (`node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js:11621-11643`). It is useful for restoring or replacing a draft, but it does not preserve or target the current selection.

Therefore computing a new string from `useInput(s => s.draft)` and calling `setDraft(newString)` is not selection-aware. It also destroys rich reference-chip identity represented in the editor but flattened in the clipboard projection.

### 4.3 The selection-aware implementation exists, but is private

The internal shell has precisely the behavior the requested feature wants:

```js
paste(text) {
  // sanitize
  const selection = $getSelection()
  if ($isRangeSelection(selection)) selection.insertText(clean)
  else root.selectEnd().insertText(clean)
}
```

See `node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js:11686-11705`. It also computes the live selection as an ordered detect-coordinate span with `caretSpan()` (`same file:11785-11798`). But neither method appears in the public `actions` object (`same file:11495-11510`). The implementation explicitly calls the broader keyboard face “package-internal” and says it is handed to the composer-bar entry, “never across a plugin boundary” (`same file:12342-12350`).

The contenteditable itself is also private assembly: `ComposerContentEditable` binds a shell-owned Lexical editor to a resident `div[data-composer-input]` (`same file:14646-14681`), and `InputBar` receives that editor only through its private `keyboard` injection (`same file:15305-15331,16193-16213`). DOM selection, `data-composer-input`, and Lexical internals are therefore implementation details, not an extension contract.

### 4.4 The scoped `slash/input-insert-text` event is internal, not a public workaround

The input-trigger package dispatches a bail event:

```js
actx.bail(actx, "slash/input-insert-text", {
  text: outcome.text,
  span,
  ...(outcome.continue === true ? { continue: true } : {}),
})
```

(`node_modules/@deepseek-ai/dsh-client-ui-input-trigger/lib/client.js:603-619`). `ui-conversation` installs the scoped listener inside the Session shell effect (`node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js:12311-12326`). Its receiver accepts text only when `span.draftRev` still equals the editor revision, then maps and replaces that exact span (`same file:11875-11895`).

This is not a supported general button API for three independent reasons:

1. It is absent from the generated Inspect-visible Client Event catalog. That catalog contains only `connection/reset`, `locale/change`, `slots/changed`, and `theme/change` (`node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js:1551-1594`).
2. A dock component receives `draftRev` but not the live selection span (`InputState` shape at `ui-conversation/lib/client.js:12235-12245`).
3. The event is part of the private choreography between `ui-input-trigger` and `ui-conversation`; the input-trigger package's own reference says it emits no public Cordis events (`node_modules/@deepseek-ai/dsh-client-ui-input-trigger/README.md:80-90`).

`ctx.inputTriggers.registerSource(src)` *is* a supported feature-specific seam for a business package that wants to join the `/` or `@` candidate pipeline: the package reference explicitly says “any business package” may register a source and that a picked text outcome is applied by the consuming input package (`node_modules/@deepseek-ai/dsh-client-ui-input-trigger/README.md:10-12,25-32`). The exact registration method returns a disposer (`node_modules/@deepseek-ai/dsh-client-ui-input-trigger/lib/client.js:753-796`). That does not solve an arbitrary quick-action button, because only the input pipeline owns the fresh selection/span passed to the text outcome.

### 4.5 Missing API

There is no supported equivalent of any of the following on `InputActions` or a public Client Service/Event:

```ts
insertTextAtSelection(text: string): void
replaceSelection(text: string): void
getSelection(): ComposerSelection
```

The safest upstream addition would be an action (for example `inputActions.insertText(text)`) that delegates to the existing shell `paste(text)` implementation. An action is preferable to exposing raw span state because the existing span path uses a revision CAS specifically to avoid stale edits. This is a proposed seam, not one present in the examined checkout.

---

## 5. Official submit path

### 5.1 Supported call

A dock/toolbar Slot component should call its standard prop:

```ts
inputActions.submit()
```

This is not merely similar to the composer button: the shipped primary button calls that exact function after its UI guards (`node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js:15510-15521`). The action delegates to `SessionInputShell.submit("queue")` (`same file:11495-11510`).

The shell then:

1. handles image-only input;
2. validates claimed commands and image support;
3. dispatches the input state machine's `enter` event with the current projected draft;
4. runs trigger/command adjudication when applicable;
5. commits successful/default sends and invokes the default sink.

See `node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js:11707-11753,12170-12229`. The default sink is explicitly “optimistic clear + prompt” and delegates to `conversation.sendSession(...)` (`same file:12362-12371`). `sendSession` creates the local submission echo, yields a paint, serializes content, and calls the Session Controller's `session.prompt(...)` (`same file:1933-1974`). The package reference summarizes the same official flow and its queue/steer placement and failure restoration (`node_modules/@deepseek-ai/dsh-client-ui-conversation/README.md:45-49`).

A custom control should apply the same visible guards as the primary button (non-empty draft/attachments, not disabled/blocked/removed, and not `adjudicating`/`submitting`) using `useInput`/`useSession`, rather than assuming `submit()` reports a result; `submit()` returns `void`.

### 5.2 Exact limitation of the public submit action

`inputActions.submit()` is the primary **pointer-send** path and always requests delivery mode `"queue"`. The keyboard path instead calls the private `keyboard.submit(resolveSubmitMode(...))`, allowing the configured busy-Enter Queue/Steer policy (`node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js:15467-15495`). Thus `inputActions.submit()` is official and identical to clicking Send, but it is not a public parameterized “submit using the current keyboard gesture policy” API.

### 5.3 What not to call

`ConversationController.send(text)` exists in the implementation and calls the scoped Session's `prompt(..., "queue")` directly (`node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js:1883-1918`). Calling it would bypass draft mutation, command adjudication, optimistic draft commit/restoration, current attachments, and the public Slot action face. It is not the requested “same path as the composer.” Likewise, calling a Host Remote directly would bypass the Client input machine.

Combining `inputActions.setDraft(staticText)` and `inputActions.submit()` uses the official submit path but first replaces the entire user draft and puts the caret at the end. It does not meet “insert at current selection.” There is no public atomic “insert then submit” operation.

---

## 6. Client Services, Events, and Builtins relevant to this feature

### 6.1 Inspect-visible and feature-specific Client Services

The generated **Inspect-visible** Client Service catalog in this checkout contains these Service keys and no composer-editing Service:

- `layout`
- `locale`
- `sessions`
- `slots`
- `theme`
- `timer`
- `uiWorkspace`
- `workspaces`

The literal catalog begins at `node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js:1113`; the keys occur at `1116`, `1138`, `1234`, `1317`, `1339`, `1389`, `1426`, and `1488`, and the catalog ends at `1550`.

Relevant exact contracts are:

- `slots.register`: the SlotCore registration overloads, wrapped as a caller-fiber effect (`node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js:1317-1324`; implementation `node_modules/@deepseek-ai/dsh-client-ui-renderer/lib/client.js:1388-1391`).
- `slots.inject(key, callback): () => void` with declaration-lifetime and unload cleanup (`node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js:1325-1336`).
- `sessions.scope(id: SessionId): AgentContext | undefined` and `sessions.binding(id: SessionId): SessionBinding | undefined` (`node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js:1297-1313`) when a feature-specific scoped Service genuinely requires them.

For a compiled persistent package, that dynamic/Inspect catalog is not the whole published package surface. Two feature-specific Services are explicitly offered to other packages, but neither fills the missing button-insertion seam:

- `ctx.uiConversation` owns event/view registries and `binding(bindingOrSessionId)` for Conversation target packages (`node_modules/@deepseek-ai/dsh-client-ui-conversation/README.md:25-34`; implementation methods at `lib/client.js:1629-1746`). It does not expose composer draft mutation.
- `ctx.inputTriggers.registerSource(src): () => void` admits a business-owned `/` or `@` source (`node_modules/@deepseek-ai/dsh-client-ui-input-trigger/README.md:10-12`; implementation `lib/client.js:753-796`). Its controller applies text only after its own trigger/menu flow has captured a fresh span.

The implementation also provides scoped `ctx.conversation`, including direct `send(text)`, queue, and cancel operations (`node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js:1883-2101`), but that is not the standard composer action face and direct `send(text)` bypasses the input-machine behavior required here. `inputActions` is intentionally delivered as a Slot standard prop, not looked up from `ctx`.

No documented Service in the examined source exposes current-selection insertion.

### 6.2 Inspect-visible Client Events

Exact Inspect-visible Client Event catalog:

```ts
"connection/reset"(): void
"locale/change"(snapshot: LocaleSnapshot): void
"slots/changed"(key: string): void
"theme/change"(snapshot: ThemeSnapshot): void
```

See `node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js:1551-1594`. None carries draft text, selection, an insertion command, or a submit request. `slots/changed` is observational; `ctx.slots.inject` already provides the declaration-lifetime behavior this package needs. No first-party package reference examined documents a separate public composer-mutation Event; the only text-insertion dispatch found is the private `slash/input-insert-text` choreography described above.

At the Cordis level, `ctx.on(...)` is supported and automatically fiber-cleaned (`node_modules/@deepseek-ai/cordis/lib/index.js:360-379`), but inventing or dispatching an uncatalogued composer event is not a supported DSH seam.

### 6.3 “Builtins” must be split into three different concepts

#### A. Ordinary Cordis lifecycle/context API — supported for persistent plugins

A persistent Client package is an ordinary compiled Cordis plugin. It exports `apply` and optionally `inject`, imports its build-time dependencies, and uses normal Cordis APIs such as `ctx.get`, `ctx.on`, `ctx.effect`, `ctx.provide`, and `ctx.plugin`. Cordis itself defines the plugin/fiber lifecycle and automatic cleanup (`node_modules/@deepseek-ai/cordis/README.md:18-67`; effect implementation `node_modules/@deepseek-ai/cordis/lib/index.js:1124-1278`).

#### B. Loader builtins — supported composition machinery, not composer APIs

DSH boot registers exactly two Loader builtins:

- `cordis:include`
- `cordis:group`

`mountRootInclude` installs them and mounts the root `cordis:include` with the profile config path and patches (`node_modules/@deepseek-ai/dsh-app-boot/lib/index.js:1277-1315`). The first-party boot reference calls these the “Two Loader builtins” and explains that group creates a shared isolate realm (`node_modules/@deepseek-ai/dsh-app-boot/README.md:81-86`). A simple quick-actions bundle needs only an ordinary inserted row, not either builtin.

#### C. Dynamic Client Builtin catalog — **not** the persistent-package contract

The embedded Inspect provider exposes these closure symbols to **dynamic** Client halves only:

```ts
ctx.get / ctx.on / ctx.provide / ctx.effect
React.createElement / React.useState / React.useEffect
host.call(method, args?)
styles.insert(css)
console.log / console.error
```

See `node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js:4077-4112`. The owning README explicitly scopes those symbols to plain-JavaScript dynamic packages with no imports (`node_modules/@deepseek-ai/dsh-cordis-client-runner/README.md:25-32`). Therefore `host.call` and `styles.insert` must **not** be advertised as builtins of a persistent package.

Persistent browser packages instead use the built Client module graph. The public module-system contract says the shell seeds a frozen baseline of React, Cordis, and static UI libraries; non-baseline runtime imports must be named in `dsh.client.external` (`node_modules/@deepseek-ai/dsh-client-modules/README.md:38-44`). Normal browser globals may exist in that compiled runtime, as the shipped implementation itself uses `document`, `window`, and `localStorage`, but DOM access to `div[data-composer-input]`, synthetic paste, or Lexical internals is not a supported composer extension seam and would be brittle across builds.

---

## 7. Recommended supported scope for a quick-actions package

Without upstream changes, a persistent package can safely do the following:

1. Ship/install a web-profile bundle whose patch inserts a built `dsh.client` row.
2. Export a no-op Host/root `apply()` if it has no Host behavior.
3. In the Client `apply(ctx)`, inject `slots` and register a unique list-cell id through `ctx.slots.inject(...)` in either:
   - `conversation.input.dock` for a full-width row above the normal composer, or
   - `conversation.composer.dock` for a row below the active normal composer.
4. Render controls as a normal React Slot component.
5. Read current state with `useInput`/`useSession`.
6. Submit the current draft with `inputActions.submit()`.
7. Put every non-React side effect under `ctx.effect`/`ctx.on`; let Slot registration and React unmount clean up the rest.

It cannot, through a supported seam in this checkout:

- splice static text at the current selection;
- preserve rich editor/chip identity while reconstructing text itself;
- request the private Queue/Steer keyboard submit policy with a public mode argument;
- render one additive row around no-session, hero, resident, and every elected takeover composer.

Those are genuine API gaps, not reasons to reach into `[data-composer-input]`, dispatch synthetic browser events, call `conversation.input.for(...)`, or emit `slash/input-insert-text` with fabricated coordinates.

## Source index (highest-value ranges)

- Persistent profiles/bundles: `node_modules/@deepseek-ai/dsh/README.md:33-47`; `node_modules/@deepseek-ai/dsh-app-boot/lib/index.js:286-309,834-894`; `node_modules/@deepseek-ai/dsh/lib/plugin-F7ZVfRyo.js:7-77,96-127`.
- Client package discovery: `node_modules/@deepseek-ai/dsh-client-modules/README.md:25-44`; `node_modules/@deepseek-ai/dsh-client-modules/lib/index.js:139-165,434-479,618-647`.
- Representative pure Client package: `node_modules/@deepseek-ai/dsh-client-ui-plan/package.json:13-37,57-65`; `lib/index.js:1-12`; `lib/client.js:1-4,103-136`.
- Above/below Slot contracts: `node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js:2463-2511,2672-2724`.
- Actual Slot placement: `node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js:14401-14472,15713-15718`.
- Slot cleanup: `node_modules/@deepseek-ai/dsh-client-ui-renderer/lib/client.js:1000-1074,1250-1271,1388-1391`.
- Input public actions/state: `node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js:11483-11510,11621-11643,12235-12245,16039-16056`.
- Private selection paths: `same file:11686-11705,11785-11798,11875-11895,12311-12350,14646-14681`.
- Submit path: `same file:11707-11753,12170-12229,12362-12371,15510-15521,1933-1974`.
- Public Client Services/Events/Builtins catalog: `node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js:1113-1594,4077-4112`.
