# dsh-quick-actions-bundle

*English: [README.en.md](./README.en.md)*

把 [`dsh-quick-actions`](../composer-quick-actions/README.md) 安装到 DSH `web` profile 的安装 bundle。

这个包里只有 `cordis.patch.yml`：它是 `dsh.bundle.patch` 层，向 profile 插入功能包的 Host row（`id: composer-quick-actions`）。功能包自己的 `dsh.client` 声明负责让 web app 加载它的 `./client` 产物作为浏览器半边。本包**不含任何实现代码**，也**不内嵌功能包**——它只是声明对功能包的依赖。

## 安装

```sh
dsh plugin --profile web add dsh-quick-actions-bundle
```

然后重启 web profile。

> 这一条就够了：功能包作为本包的依赖由 registry 一并装下，profile 无需 `overrides`。已在全新 `DSH_HOME` 上实测。

如果安装以 `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` 结束，而被点名的包**不是**本插件，那是 pnpm 在校验整个 profile 的 lockfile：profile 里某个已装插件在最近 24 小时内发过新版。给这一次命令加 `--config.minimumReleaseAge=0` 即可，成因与另外两种处理方式见功能包 README 的[安装排障](../composer-quick-actions/README.md#安装报-err_pnpm_minimum_release_age_violation)。

## 本地 / 离线安装

因为本包只依赖、不内嵌功能包，离线安装必须让**两个 tarball 都能被解析**：

- `dsh-quick-actions-0.1.0.tgz`（功能包，经 profile 的 pnpm `overrides` 解析）
- `dsh-quick-actions-bundle-0.1.0.tgz`（本包，`dsh plugin add` 的参数）

只 `add` 本包的 tarball 不会用上你打的功能包——pnpm 会去 registry 解析那个传递依赖，装上已发布版；把两个 tarball 一起 `add` 也一样，直接依赖不满足传递依赖。完整的、逐步可复现的流程见功能包 README 的[本地 / 离线安装](../composer-quick-actions/README.md#本地--离线安装)一节。

## 卸载

```sh
dsh plugin --profile web remove dsh-quick-actions-bundle
```

`dsh plugin` 会同时移除依赖和 `dsh.profile.bundles` 里的这一层。用户数据保留在 Settings 里，重装即恢复；彻底清理步骤见功能包 README。

## 许可证

MIT
