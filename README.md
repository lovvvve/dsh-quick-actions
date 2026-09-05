# DSH Plugins

DSH 持久化插件的 pnpm workspace。当前项目包含消息编辑器快捷动作功能包、安装 bundle，以及用于生成 DSH lazy-CJS Client 产物的本地构建适配器。

## 工作区

- `packages/composer-quick-actions`：Host/Client 双面功能包。
- `packages/composer-quick-actions-bundle`：面向 DSH `web` profile 的安装 bundle。
- `tools/dsh-client-bundle`：Client bundle 构建适配器及真实产物/watch 契约测试。

## 命令

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm watch:client
```

当前功能包仍是可构建骨架；后续 Wayfinder 任务会逐步加入领域模型、Host Settings、Client Controller 和界面行为。
