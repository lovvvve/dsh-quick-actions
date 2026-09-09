# dsh-quick-actions-bundle

*中文：[README.md](./README.md)*

The install bundle that mounts [`dsh-quick-actions`](../composer-quick-actions/README.en.md) into a DSH `web` profile.

This package contains nothing but `cordis.patch.yml`: the `dsh.bundle.patch` layer that inserts the feature package's Host row (`id: composer-quick-actions`) into the profile. The feature package's own `dsh.client` declaration is what makes the web app load its `./client` bundle as the browser half. There is **no implementation code here**, and the feature package is **not embedded** — this package merely declares a dependency on it.

## Install

```sh
dsh plugin --profile web add dsh-quick-actions-bundle
```

Then restart the web profile.

> That one command is the whole install: the registry brings the feature package down as this package's dependency, so the profile needs no `overrides`. Verified on a fresh `DSH_HOME`.

## Local / offline install

Because this package depends on the feature package rather than embedding it, an offline install has to make **both tarballs resolvable**:

- `dsh-quick-actions-0.1.0.tgz` — the feature package, resolved through a pnpm `overrides` entry in the profile.
- `dsh-quick-actions-bundle-0.1.0.tgz` — this package, the argument to `dsh plugin add`.

Adding only this package's tarball will not pick up the feature package you built — pnpm resolves that transitive dependency from the registry and installs the published version instead; adding both tarballs in one command behaves the same way, because a direct dependency does not satisfy a transitive one. The full, reproducible procedure is in the feature package's [Local / offline install](../composer-quick-actions/README.en.md#local--offline-install) section.

## Uninstall

```sh
dsh plugin --profile web remove dsh-quick-actions-bundle
```

`dsh plugin` removes both the dependency and this layer from `dsh.profile.bundles`. User data stays in Settings so that reinstalling restores it; the feature package's readme has the full cleanup steps.

## License

MIT
