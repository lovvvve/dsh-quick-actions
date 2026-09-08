# DSH Plugins

DSH 持久化插件的 pnpm workspace。当前项目包含消息编辑器快捷动作功能包、它的安装 bundle，以及用于生成 DSH lazy-CJS Client 产物的本地构建适配器。

## 工作区

| 路径 | 包名 | 角色 |
|---|---|---|
| `packages/composer-quick-actions` | `dsh-composer-quick-actions` | Host/Client 双面功能包（[README](packages/composer-quick-actions/README.md) · [English](packages/composer-quick-actions/README.en.md)） |
| `packages/composer-quick-actions-bundle` | `dsh-composer-quick-actions-bundle` | 面向 DSH `web` profile 的安装 bundle（[README](packages/composer-quick-actions-bundle/README.md) · [English](packages/composer-quick-actions-bundle/README.en.md)） |
| `tools/dsh-client-bundle` | `@dsh-plugins/dsh-client-bundle` | 私有构建适配器（不发布）：Client bundle 构建与真实产物 / watch 契约测试 |

两个发布包的版本为 `0.1.0`、许可证 MIT。**目前尚未发布**到任何 registry：试用请按功能包 README 的本地 tarball 流程安装。

## 命令

```bash
pnpm install
pnpm test        # vitest run，含真实 tsdown 构建与真实 pnpm pack，较慢
pnpm typecheck   # tsc -b（项目引用，只发 .d.ts）+ tsc -p tsconfig.test.json（测试 / 配置，noEmit）
pnpm lint
pnpm build
pnpm watch:client
```

## 状态

功能包的领域模型、Host 装配、Client 控制器、三种 Composer 布局、动作执行、管理与动作面板，以及安装 bundle 与发布文档均已实现。剩下的是集成与发布验证、以及在真实 DSH GUI 下的最终人工验收——进度与决策记录见 `.scratch/dsh-composer-quick-actions/`（[spec](.scratch/dsh-composer-quick-actions/spec.md) 为 baseline，[map](.scratch/dsh-composer-quick-actions/map.md) 为议题地图）。
