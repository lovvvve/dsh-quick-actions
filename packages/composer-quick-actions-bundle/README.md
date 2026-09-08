# dsh-composer-quick-actions-bundle

*English: [README.en.md](./README.en.md)*

把 [`dsh-composer-quick-actions`](../composer-quick-actions/README.md) 安装到 DSH `web` profile 的安装 bundle。

这个包里只有 `cordis.patch.yml`：它是 `dsh.bundle.patch` 层，向 profile 插入功能包的 Host row（`id: composer-quick-actions`）。功能包自己的 `dsh.client` 声明负责让 web app 加载它的 `./client` 产物作为浏览器半边。本包**不含任何实现代码**，也**不内嵌功能包**——它只是声明对功能包的依赖。

## 安装

```sh
dsh plugin --profile web add dsh-composer-quick-actions-bundle
```

然后重启 web profile。

> 本包与功能包目前**尚未发布**到任何 registry，上面这条命令现在会以 404 结束。

## 本地 / 离线安装

因为本包只依赖、不内嵌功能包，离线安装必须让**两个 tarball 都能被解析**：

- `dsh-composer-quick-actions-0.1.0.tgz`（功能包，经 profile 的 pnpm `overrides` 解析）
- `dsh-composer-quick-actions-bundle-0.1.0.tgz`（本包，`dsh plugin add` 的参数）

只 `add` 本包的 tarball 会失败（pnpm 会去 registry 找未发布的功能包），把两个 tarball 一起 `add` 也一样失败。完整的、逐步可复现的流程见功能包 README 的[本地 / 离线安装](../composer-quick-actions/README.md#本地--离线安装)一节。

## 卸载

```sh
dsh plugin --profile web remove dsh-composer-quick-actions-bundle
```

`dsh plugin` 会同时移除依赖和 `dsh.profile.bundles` 里的这一层。用户数据保留在 Settings 里，重装即恢复；彻底清理步骤见功能包 README。

## 许可证

MIT
