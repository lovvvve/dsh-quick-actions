# dsh-quick-actions

*中文：[README.md](./README.md)*

Global Quick Actions next to every ordinary, session-backed **Resident Composer** in DSH. One press sends a piece of text you wrote in advance.

Preset Quick Actions ship with the package and are read-only — you can hide or clone them. Custom Quick Actions are entirely yours. Everything is persisted through DSH's local Settings and survives restarts.

## What it does

- **Send Actions**: load a piece of static text into the draft and submit it through the official path. There is exactly one loading path, `setDraft(text)` → `submit()`.
- **Three layouts**: a ribbon above the input, a bar inside it, or a single launcher opening a searchable panel. Switch at any time.
- **Per-action send confirmation**, on by default and yours to change.
- **Text starting with `/` is a valid Command Send Action**, adjudicated by DSH itself.
- Presets and customs are capped at **50 combined**. At the cap, adding and cloning stop; if an upgrade or a config change pushes existing state past it, **no data is lost** — adding and cloning are simply refused until you are back under it.

This release has **no insert action** (insert at the selection, keep the editing context): DSH has not published `insertText`, and this release neither detects nor depends on it. Action text is static — no variables, templates or scripts. Every action is global, with no per-Agent or per-conversation visibility rules and no cross-device sync, import or export. Quick Actions never appear next to a no-session, hero or takeover composer.

## Compatibility

| Item | Value |
|---|---|
| Verified baseline | DSH core packages at `0.1.2-rc.1`. Note that `dsh --version` on the desktop build prints its dependency-set label, a different number from the core package version |
| DSH peers | `>=0.1.2-rc.1`, with no upper bound |
| Cordis | `^4.0.2` |
| Schemastery | `^3.18.2` |
| React and React DOM (browser side) | `^18.3.1`, supplied by the web shell's module table rather than installed into the profile |
| DSH UI primitives (browser side) | `>=0.1.2-rc.1`, also supplied by the module table |
| Platform | `web` profile only |

Nothing is capability-detected at install or at runtime, so there is no feature tiering that varies with the DSH version: either the whole plugin installs and runs, or it does not.

## Install

```sh
dsh plugin --profile web add dsh-quick-actions
```

Then restart the web profile. One package is the whole thing: it carries `dsh.bundle.patch`, which inserts its Host half into the profile, while its `dsh.client` declaration makes the web app load the browser half.

### Local / offline install

```sh
mkdir -p /tmp/quick-actions
pnpm --filter dsh-quick-actions pack --pack-destination /tmp/quick-actions
dsh plugin --profile web add /tmp/quick-actions/dsh-quick-actions-0.1.0-rc.2.tgz
```

The `--filter` form works from anywhere in the repository; from the package directory itself, `pnpm pack --pack-destination /tmp/quick-actions` is the same thing.

Use an **absolute path** for the tarball: `dsh plugin` is a pnpm forwarder and pnpm runs in the profile directory, so a relative path resolves under `<DSH_HOME>/profiles/web/` and fails with `ENOENT`.

### What a good install looks like

- `<DSH_HOME>/profiles/web/package.json` gains `dsh-quick-actions` both under `dependencies` and at the end of `dsh.profile.bundles`. Both are maintained by `dsh plugin` — do not hand-edit them.
- You can check without starting a server:

  ```sh
  dsh --profile web --dump-config | grep -A1 'id: composer-quick-actions'
  ```

  You should see `- id: composer-quick-actions` / `name: dsh-quick-actions`. That row takes effect on the **next profile boot**.

- pnpm prints `Issues with peer dependencies found`. **That is expected**: DSH's own packages live in DSH's install anchor, where the profile's pnpm cannot see them. Every other third-party DSH plugin in the same profile behaves the same way.

### The install fails with `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`

The install may end like this, with **not one of the named packages being this plugin**:

```text
ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION  4 lockfile entries failed verification:
  some-other-plugin@1.2.3 was published at ..., within the minimumReleaseAge cutoff (...)
```

pnpm enforces a supply-chain policy that rejects dependencies published inside a cooling-off window (24 hours by default), and it checks the **whole profile lockfile** rather than only the package you are adding. So if any plugin already in the profile shipped a release in the last day without an exemption, adding anything at all is refused.

To confirm it has nothing to do with this plugin, run a bare `pnpm install` in the profile directory, adding nothing; the same error means exactly that. Three ways out:

1. Pass a flag for this one command, affecting nothing else:

   ```sh
   dsh plugin --profile web add dsh-quick-actions --config.minimumReleaseAge=0
   ```

2. Wait the window out. Each line of the error gives a publish time and the cutoff; once the newest is 24 hours old the install works unchanged.
3. Add each named `name@version` to `minimumReleaseAgeExclude` in `<DSH_HOME>/profiles/web/pnpm-workspace.yaml`, at the cost of giving up that protection for those packages.

## Configuring Preset Quick Actions

The preset catalog is two parts in order: the list built into the package, then whatever the Host composition appends through `Config.presets`. That is the only channel for declaring presets — there is no runtime registration API.

Put `config` on the plugin's row:

```yaml
# <DSH_HOME>/profiles/web/cordis.patch.yml
- id: composer-quick-actions
  config:
    presets:
      - id: run-tests
        label: Run tests
        text: Run the test suite and paste the failures.
        icon: ✅
      - id: compact
        label: Compact context
        text: /compact
```

Field rules:

- `id` is required, unique across the catalog and **permanent**. Label, icon and text may change under the same `id`; `confirm` is part of the safety signature, so changing it needs a new `id` — and so does making the text start with `/`, or stop starting with it.
- `label` and `text` are required; `icon` and `confirm` are optional, and `confirm` defaults to `true`.
- An invalid preset (a missing field, a duplicate `id`, a catalog over 50 entries) makes **plugin loading fail loudly** and lists every problem at once, rather than truncating silently.

Users can hide or clone a preset but never edit or delete it; a clone becomes an ordinary Custom Quick Action.

## Three layouts

Layout is a global persisted setting, switched in the management panel:

| Value | Name | Where |
|---|---|---|
| `ribbon` (default) | Action ribbon | One row above the input, matching its width |
| `bar` | Action bar | One row inside the input; whatever does not fit folds into "more" |
| `launcher` | Single launcher | One entry button opening a searchable panel |

`bar` and `launcher` share the same searchable panel, and the search matches labels and texts only. The management panel is where you reorder, hide, restore and clone presets, create, edit, enable and delete custom actions, and switch layout.

## Command Send Action

Static text whose first non-whitespace character is `/` is marked as a command.

- It travels **exactly the same path** as any other Send Action, and the command is adjudicated by DSH itself; this plugin never parses or rewrites command semantics.
- Confirmation is on by default and **can be turned off**. The `confirm` you set is never rewritten.
- With confirmation on, the panel shows precisely what will be submitted. **The native candidate menu you get when typing `/` in the composer does not appear here**, so adjudication may differ from typing the same command by hand.
- With confirmation off, the command is submitted in one press with no preview.
- The management form warns you when text becomes a command, but locks no control.

## Settings paths

User data lives in `<DSH_HOME>/settings.yaml` (`~/.dsh` when `DSH_HOME` is unset):

- `composer-quick-actions` — the **only** persisted namespace: layout, custom actions, the shared order and preset differences.
- `composer-quick-actions-catalog` — the preset catalog. Read-only, never written to the user layer, so it does **not** appear in that file.

The Host is the single validation authority and normalizes stored data idempotently at boot. Every change made in the UI carries an expected revision; on a conflict the panel refreshes to the latest state and asks you to confirm again, never silently overwriting someone else's write. Data written by a higher `schemaVersion` is kept as-is, so a downgrade round-trip loses nothing.

## Upgrade, downgrade and uninstall

**Upgrade / downgrade**:

```sh
dsh plugin --profile web add dsh-quick-actions@<version>
```

With a local tarball, `add` the tarball of the version you want. Restart the profile afterwards. Re-adding the same version is idempotent.

Cross-version data compatibility is the Host's job: new presets are appended to the end of the existing order and nothing stored is rewritten.

**Uninstall**:

```sh
dsh plugin --profile web remove dsh-quick-actions
```

Both the dependency and the layer in `dsh.profile.bundles` go away. After a profile restart the actions are gone.

**Full manual cleanup** (uninstalling does none of this, because a reinstall should restore your actions):

1. Delete the `composer-quick-actions` section from `<DSH_HOME>/settings.yaml` — the only place user data lives.
2. Remove any entry you added for this plugin from `<DSH_HOME>/profiles/web/pnpm-workspace.yaml`.
3. Delete any `config` you wrote for `composer-quick-actions` in the profile's `cordis.patch.yml`.
4. Restart the profile.

## Development

```sh
pnpm install
pnpm build          # Host ESM plus the single-file lazy-CJS Client
pnpm watch:client   # rebuild the Client bundle only
pnpm test
pnpm typecheck
pnpm lint
```

Output: the Host is `lib/index.js` and `lib/types.js` (plain Node ESM); the Client is `lib/client.js` plus a sourcemap, a browser-only single-file lazy-CJS bundle; types are `lib/types/**/*.d.ts`, declarations only.

`pnpm watch:client` is **not** DSH GUI HMR. For a change to reach a running page, three things must hold: the profile is loading the checkout you are watching (an offline install loads a copy of the tarball), that checkout's watcher is running and has produced one complete build, and the page has refetched the new output. The Client artifact is published atomically, so a failed watch build keeps the last successful one and the page may still be running old code.

## License

MIT
