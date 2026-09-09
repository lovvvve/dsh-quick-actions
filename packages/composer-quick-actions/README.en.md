# dsh-quick-actions

*中文：[README.md](./README.md)*

Global Quick Actions next to every ordinary, session-backed **Resident Composer** in DSH. Preset Quick Actions ship with the package and are read-only; Custom Quick Actions belong to the user. All user data is persisted through DSH's local Settings and survives restarts.

This is a **dual-face feature package**: the Host half owns configuration validation and Settings authority on the Node side, the Client half registers the composer's dock Slots in the browser. The installable form is its companion, [`dsh-quick-actions-bundle`](../composer-quick-actions-bundle/README.en.md).

## What the first release does

- **Send Actions only.** One press loads a pre-configured piece of static text into the draft and submits it through the official path. There is exactly one loading path: `setDraft(text)` → `submit()`.
- **There is no insert action** (insert at the selection, keep the editing context). DSH has not published `insertText`, so inserting is left to a separate future effort; this release neither detects nor depends on that capability.
- Action text is **static**: no variables, templates, scripts or any runtime-generated content.
- Presets and customs are capped at **50 combined**. Once you are at the cap, adding and cloning stop. If an upgrade, a package update or a Host config change pushes existing state past the cap, **no data is lost** — adding and cloning are simply refused until you are back under it.
- Each action carries its own **send confirmation**. Confirmation defaults to on (the default is written only when an action is created or cloned) and is yours to change afterwards.
- Every action is **global**. This release has no per-Agent, per-Preset or per-conversation visibility rules, and no cross-device sync, import or export.
- Quick Actions never appear next to a no-session, hero or takeover composer.

## Compatibility

| Item | Value |
|---|---|
| Verified baseline | DSH core packages at `0.1.2-rc.1` (`@deepseek-ai/dsh` itself, plus `dsh-base` / `dsh-settings` / `dsh-web-app`). Note that `dsh --version` on the desktop build prints its dependency-set label, which is a different number from the core package version. |
| DSH peer floor | `>=0.1.2-rc.1`, with no upper bound |
| Cordis | `^4.0.2` |
| Schemastery | `^3.18.2` |
| React and React DOM (browser side) | `^18.3.1`, supplied by the web shell's module table rather than installed into the profile. `react-dom` carries the management overlay's portal, on the shell's own renderer instance |
| DSH UI primitives (browser side) | peer `>=0.1.2-rc.1`, also supplied by the module table; the devDependency pins `0.1.2-rc.1` exactly, for typechecking only |
| Platform | `web` profile only (`dsh.client.platform: web`) |
| Public contracts consumed | Host injects `settings`; the Client injects `slots`, `settingsScope`, `connection`, `locale` and reads `conversation` through `ctx.get` |

The floor is the core package version this effort took all of its evidence on. It is **not** the first officially supported DSH release — that release is not knowable yet, and this document makes no such claim. There is no upper bound because DSH is still in 0.x rc, where `^0.1.2-rc.1` would exclude 0.2.x outright.

This release does **not** depend on `insertText` and detects no DSH capability at install or at runtime, so there is no feature tiering that varies with the DSH version: either the whole plugin installs and runs, or it does not.

### Known limitation: how the styles are authored

The controls are the official `@deepseek-ai/dsh-client-ui-primitives` (`Button`, `Pill`, `Input` and the official icons), colours come from DSH theme tokens only, and no global theme is overridden. The plugin's own layout styles, however, are **written as a `dsh-cqa-`-prefixed style string rather than as CSS Modules**.

Delivery is identical to what first-party DSH plugins do — a `<style data-plugin-css>` tag injected at runtime behind the same idempotence check that `dsh-client-ui-chat` and friends use. The difference is only in how the styles are authored (a hand-written string rather than `.module.css`) and how class names are generated (a prefix by convention rather than a compile-time hash), and **neither is visible to the user**. Collision safety rests on the prefix convention rather than on the compiler. This is a known and accepted trade-off for the first release.

## Install

### From the registry

```sh
dsh plugin --profile web add dsh-quick-actions-bundle
```

Then restart the web profile.

> That one command is the whole install: the registry resolves the bundle's dependency on the feature package, so the profile needs no `overrides` and there is no second tarball to place. Verified on a fresh `DSH_HOME`.
>
> The local / offline flow below is for when you have no registry access, or want to try changes that are not published.

### Local / offline install

The install bundle only **declares** a dependency on the feature package — it does not **embed** it — so an offline install has to make both tarballs resolvable.

1. Pack both packages. The feature package declares `prepack`, so `pnpm pack` builds it first and its tarball always carries fresh output; the bundle has nothing to build and is packed as-is:

   ```sh
   mkdir -p /tmp/quick-actions
   pnpm --filter dsh-quick-actions pack --pack-destination /tmp/quick-actions
   pnpm --filter dsh-quick-actions-bundle pack --pack-destination /tmp/quick-actions
   ```

   That gives you `dsh-quick-actions-0.1.0.tgz` and `dsh-quick-actions-bundle-0.1.0.tgz`.

2. Add one pnpm override to the profile, pointing the feature package at the **absolute path** of its tarball:

   ```yaml
   # <DSH_HOME>/profiles/web/pnpm-workspace.yaml
   overrides:
     dsh-quick-actions: file:/tmp/quick-actions/dsh-quick-actions-0.1.0.tgz
   ```

3. Install the bundle tarball:

   ```sh
   dsh plugin --profile web add /tmp/quick-actions/dsh-quick-actions-bundle-0.1.0.tgz
   ```

4. Restart the web profile.

Step 2 is **required**, not an optimization. `dsh plugin` is a pnpm forwarder, so the bundle's `dsh-quick-actions@<version>` dependency is resolved from the registry as usual, and **a direct dependency does not satisfy a transitive one**: adding both tarballs in one command, or adding the feature package before the bundle, still leaves the bundle pointing somewhere other than the tarball you built.

Now that the packages are published, the failure mode has changed but the conclusion has not: skipping step 2 no longer fails with `ERR_PNPM_FETCH_404` — it **quietly installs the published version instead**, so you would be running the release while believing you were testing your build. Keep the override whenever you are testing local changes.

If you only want the published version, skip this section entirely and use the registry command above.

### What a good install looks like

- `<DSH_HOME>/profiles/web/package.json` gains the bundle under `dependencies` and `dsh-quick-actions-bundle` at the end of `dsh.profile.bundles`. Both are maintained by `dsh plugin` itself — do not hand-edit them.
- The feature package lands as a transitive dependency at `<DSH_HOME>/profiles/web/node_modules/dsh-quick-actions`.
- You can check the layer without starting a server:

  ```sh
  dsh --profile web --dump-config | grep -A1 'id: composer-quick-actions'
  ```

  The composed profile tree should show `- id: composer-quick-actions` / `name: dsh-quick-actions`, attributed to the `dsh-quick-actions-bundle` layer. That row takes effect on the **next profile boot**.

- pnpm prints `Issues with peer dependencies found`, and `pnpm peers check` lists every DSH peer this package declares as missing. **That is expected**: DSH's own packages live in DSH's install anchor rather than in the profile's `node_modules`, where the profile's pnpm cannot see them (`autoInstallPeers: false`). Every other third-party DSH plugin in the same profile behaves the same way. The peer declarations document which DSH contracts this package consumes; they take no part in resolution.

### The install fails with `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`

The install may end like this, with **not one of the named packages being this plugin**:

```text
ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION  4 lockfile entries failed verification:
  some-other-plugin@1.2.3 was published at ..., within the minimumReleaseAge cutoff (...)
```

Nothing is wrong with this plugin, and you did not install it wrongly. pnpm enforces a supply-chain policy that rejects dependencies **published inside a cooling-off window** (24 hours by default), and it checks the **whole profile lockfile** rather than only the package you are adding. So if any plugin already in the profile shipped a release in the last day without an exemption, adding anything at all is refused.

To confirm: run a bare `pnpm install` in the profile directory, adding nothing. The same error means it has nothing to do with this plugin.

Three ways out:

1. **Pass a flag for this one command** (recommended — it affects this invocation only and leaves your policy alone):

   ```sh
   dsh plugin --profile web add dsh-quick-actions-bundle --config.minimumReleaseAge=0
   ```

2. **Wait the window out.** Each line of the error gives a publish time and the cutoff; once the newest of them is 24 hours old the install works with no changes.
3. **Add each named `name@version` to `minimumReleaseAgeExclude`** in the profile's `pnpm-workspace.yaml`. Permanent, but it gives up that protection for those packages.

## Configuring Preset Quick Actions

The Preset Catalog is assembled in a fixed order: the package's own built-in manifest first, then whatever the Host composition appends through `Config.presets`. `Config.presets` **is** the authorization channel for presets — there is no third-party runtime registration API.

Put `config` on the row the bundle inserts:

```yaml
# <DSH_HOME>/profiles/web/cordis.patch.yml
- id: composer-quick-actions
  config:
    presets:
      - id: run-tests
        label: Run tests
        text: Run the test suite and paste every failure.
        icon: ✅
      - id: compact
        label: Compact
        text: /compact
```

Field rules:

- `id` is required, unique across the catalog, and **permanent**. Label, icon and text may change under the same `id`; `confirm` is the immutable safety signature, so changing it needs a new `id`. Editing a text so it starts with `/` — or stops doing so — crosses that same signature.
- `label` and `text` are required; `icon` and `confirm` are optional (`confirm` defaults to `true`).
- Do not declare an action type. The data contract keeps a `kind` discriminant, but this release pins it to `'send'`: authors do not declare it, the form offers no selector, users cannot change it, and normalization writes it out.
- An invalid preset — a missing field, a duplicate `id`, a `kind` other than `'send'`, a catalog over 50 entries — makes **plugin loading fail loudly** and names every problem at once, rather than truncating silently or letting the last entry win.

Users can hide or clone a preset but never edit or delete one; a clone becomes an ordinary Custom Quick Action.

The Host publishes the assembled catalog snapshot as the composition `base` layer of a **read-only** Settings namespace, `composer-quick-actions-catalog`, and the Client reads only that layer. The namespace has no user layer, so it produces no persisted section — even hand-writing a section of that name into `settings.yaml` will not change the catalog the Client sees. It does appear in the Settings namespace directory, but it registers no config card, so it renders no form.

## The three layouts

The layout is one global persisted setting, switched in the management panel:

| Value | Name | Where |
|---|---|---|
| `ribbon` (default) | Action ribbon | One row above the input box, matching its width |
| `bar` | Action bar | One row inside the input box; whatever does not fit folds into "more" |
| `launcher` | Single launcher | One entry button that opens a searchable action panel |

`bar` and `launcher` share the same searchable action panel; search matches labels and text only, and preserves the shared order. The management panel is registered as an independent layer and is where preset ordering, hiding, restoring and cloning, custom action CRUD and enable/disable, and the layout switch all live.

## Settings paths

User data lives in `<DSH_HOME>/settings.yaml` (`~/.dsh` when `DSH_HOME` is unset):

- `composer-quick-actions` — the **only persisted namespace**. It holds `schemaVersion`, `layout`, the custom actions, the shared order and the preset deltas (hidden / reordered).
- `composer-quick-actions-catalog` — the Preset Catalog: read-only, never written as a user layer, and therefore **never present** in this file.

The Host is the sole validation and migration authority: at startup it performs one idempotent canonical rewrite of the stored section against the current catalog, fenced by its revision. The Client never writes a file, never treats browser storage as a source of truth and never migrates; every change it makes carries an expected revision, and on a conflict the authoritative snapshot refreshes and the retry is yours to trigger explicitly — the plugin never silently overwrites another writer. Data written by a higher `schemaVersion` is kept untouched, so a downgrade round-trip loses nothing.

## Command Send Action

Static text whose first non-whitespace character is `/` is a **valid** Send Action, badged as a Command.

- It travels the **exact same** single path as any other Send Action: `setDraft(text)` → `submit()`. Commands are always adjudicated by DSH itself; this plugin never parses or rewrites command semantics, and never registers or drives any input-trigger pipeline.
- Confirmation defaults to on and **can be turned off**. Normalization never rewrites the `confirm` you set based on the text; the default is written once, at create and clone time.
- With confirmation on, the panel shows exactly what will be submitted. **However**: the native candidate menu you get when typing `/` in the input box does not appear here. The adjudicated result can therefore differ from what you would expect after typing the same command character by character — a known, accepted trade-off.
- With confirmation off, the command is submitted in one click with no preview at all. That is your explicit choice about a static command you configured yourself.
- The management form warns you when a text becomes a command, but **locks nothing**; the confirmation switch stays yours.

## Development

```sh
pnpm install
pnpm build          # tsc -b (declarations only) + tsdown (Host ESM + single-file lazy-CJS Client)
pnpm watch:client   # rebuild the Client bundle only
pnpm test
pnpm typecheck
pnpm lint
```

Output:

- Host: `lib/index.js`, `lib/types.js` — plain Node ESM.
- Client: `lib/client.js` plus `lib/client.js.map` — a browser-only, single-file lazy-CJS bundle wrapped as `window.__ModuleLoader__.load({ id, factory })`. Only the specifiers listed in `dsh.client.external` (`react`, `react/jsx-runtime`, `react-dom` and `@deepseek-ai/dsh-client-ui-primitives`, all of them platform seeds of the browser module table) may be `require`d; everything else is inlined, and indirect or computed `require`, dynamic `import` and undeclared externals fail the build.
- Types: `lib/types/**/*.d.ts` — declarations only, no JavaScript.

### Prerequisites for verifying dev HMR

`pnpm watch:client` is **not** the same thing as DSH GUI HMR. Before expecting an edit to reach a running page, confirm all three:

1. The checkout the DSH profile actually loads is the checkout you are watching. An offline install installs a *copy* from a tarball, so editing sources will not affect it — point a `file:`/`link:` spec at your working copy while developing.
2. That checkout's Client build watcher is running and has produced at least one complete successful artifact.
3. The page has refetched the new bundle. The Client artifact is published atomically: a failed watch build keeps the last complete successful output, so a page may still be running the old code — check that this round's watch build succeeded first.

## Upgrade, downgrade and uninstall

**Upgrade / downgrade** — once published:

```sh
dsh plugin --profile web add dsh-quick-actions-bundle@<version>
```

With local tarballs, point both the override and the `add` at the new (or older) pair of tarballs and restart the profile. Re-adding the same version is idempotent and leaves no duplicate in `dsh.profile.bundles`.

Cross-version data compatibility is the Host's job: a newly added preset only appends to the end of an existing order and rewrites no stored data, and on a downgrade back to this release, data from a higher `schemaVersion` is kept as-is — not shown, not counted, not rewritten — so the round-trip is lossless.

**Uninstall**:

```sh
dsh plugin --profile web remove dsh-quick-actions-bundle
```

`dsh plugin` drops both the dependency and the layer in `dsh.profile.bundles`. After a profile restart the actions are gone.

**Full manual cleanup** (uninstall deliberately does none of this, so that reinstalling restores your actions):

1. Delete the `composer-quick-actions` section from `<DSH_HOME>/settings.yaml` — the only place user data is kept.
2. If you used the local tarball flow, delete that `overrides` entry from `<DSH_HOME>/profiles/web/pnpm-workspace.yaml`.
3. If you wrote `config` for `composer-quick-actions` into the profile's `cordis.patch.yml`, delete that block too.
4. Restart the profile.

## License

MIT
