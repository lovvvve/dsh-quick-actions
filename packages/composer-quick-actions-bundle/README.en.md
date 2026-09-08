# dsh-composer-quick-actions-bundle

*中文：[README.md](./README.md)*

The install bundle that mounts [`dsh-composer-quick-actions`](../composer-quick-actions/README.en.md) into a DSH `web` profile.

This package contains nothing but `cordis.patch.yml`: the `dsh.bundle.patch` layer that inserts the feature package's Host row (`id: composer-quick-actions`) into the profile. The feature package's own `dsh.client` declaration is what makes the web app load its `./client` bundle as the browser half. There is **no implementation code here**, and the feature package is **not embedded** — this package merely declares a dependency on it.

## Install

```sh
dsh plugin --profile web add dsh-composer-quick-actions-bundle
```

Then restart the web profile.

> Neither this package nor the feature package is **published** to any registry yet, so the command above ends in a 404 today.

## Local / offline install

Because this package depends on the feature package rather than embedding it, an offline install has to make **both tarballs resolvable**:

- `dsh-composer-quick-actions-0.1.0.tgz` — the feature package, resolved through a pnpm `overrides` entry in the profile.
- `dsh-composer-quick-actions-bundle-0.1.0.tgz` — this package, the argument to `dsh plugin add`.

Adding only this package's tarball fails (pnpm looks for the unpublished feature package in the registry), and adding both tarballs in one command fails the same way. The full, reproducible procedure is in the feature package's [Local / offline install](../composer-quick-actions/README.en.md#local--offline-install) section.

## Uninstall

```sh
dsh plugin --profile web remove dsh-composer-quick-actions-bundle
```

`dsh plugin` removes both the dependency and this layer from `dsh.profile.bundles`. User data stays in Settings so that reinstalling restores it; the feature package's readme has the full cleanup steps.

## License

MIT
