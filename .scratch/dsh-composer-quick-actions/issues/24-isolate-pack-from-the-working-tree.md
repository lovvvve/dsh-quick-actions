# 让打包验证不再改写工作树

Type: task
Mode: AFK
Blocked by: 17

## Question（问题）

`pnpm test` 会删掉并重建工作树里线上的 `lib/`。让打包契约验证在隔离副本里跑 `prepack`，不再触碰 watch 与 GUI 所服务的那份产物。

## 事实链

```
pnpm test
  └─ packages/composer-quick-actions/tests/release/packaging.spec.ts:115  pack(featureDir, …)   ← 真实包目录
       └─ pnpm pack → prepack: "pnpm run build"
            └─ build: node --eval "…rmSync('lib',{recursive:true,force:true})" && tsc -b && tsdown
```

`rmSync` 本身是票据 17 的正确修复（`tsc -b` 不删除失去源文件的产物，`src/remote.ts` 删掉后 `lib/types/remote.d.ts` 仍留在磁盘并被 `files` 打进 tarball，`packaging.spec.ts` 已有断言固定「packed 的 `lib/types/**/*.d.ts` 与 `src/` 模块一一对应」）。缺陷只在于**它跑在 watch/GUI 所服务的那个工作树里**。

## 四种咬人方式

| # | 场景 | 后果 |
|---|---|---|
| 1 | 测试中途失败（任何原因） | `lib/` 已删、重建未完成 → 线上 bundle 彻底消失，GUI 404。一次失败的 `pnpm test` 能把已装好的插件搞下线 |
| 2 | `pnpm watch:client` 与 `pnpm test` 同时跑 | watcher 往 `lib.dsh-client-stage/` 写完再 rename 进 `lib/`，`rmSync` 与之竞争 → 页面可能载入缺失或半写的 bundle |
| 3 | 单纯跑测试 | 静默改写 gitignored 产物。CLAUDE.md 已因此禁止审查子代理在主工作区跑 install/typecheck；`pnpm test` 现在做的是同一件事且更狠 |
| 4 | 每次 `pnpm test` | 内含一次完整构建，测试变慢 |

场景 2 在票据 18 里几乎必然发生：CLAUDE.md 要求实测「同一 DSH checkout 的 watcher 与页面加载关系」，那条实测本身就要求 watcher 与验证并存。

## 方向（已由用户拍板：A1）

**打包到隔离副本**：`packaging.spec.ts` 先把包复制到临时目录，在副本里跑 `prepack` + `pnpm pack`。

- 契约测试仍验**真实的 prepack 链**，覆盖面不缩水——这是选它而非「把破坏性清理拆成单独脚本」的理由：后者只保住场景 3、4，场景 1、2 仍在，因为它们是 `pack` 触发的。
- 主要难点是副本里的 workspace 依赖仍要可解析：功能包的 `@dsh-plugins/dsh-client-bundle` 是 `workspace:*`，`tools/dsh-client-bundle` 不发布。方案须自证副本中 `tsc -b`（项目引用）与 `tsdown`（加载适配器）都能跑通，或说明如何在副本里满足这两者。
- 副本必须落在 `$CLAUDE_JOB_DIR/tmp` 或 `mktemp -d`，不得落在仓库内。

## 验收

- `pnpm test` 前后，工作树的 `packages/composer-quick-actions/lib/` **内容与 mtime 均不变**（用测试或证据脚本固定这一条，否则回归无人拦）。
- 打包契约的既有断言全部仍绿：产物 `require` 集合与 `dsh.client.external` 严格相等、packed 声明与 `src/` 模块一一对应、peer 覆盖与范围策略。
- 一次刻意失败的测试运行之后，`lib/` 仍完整。
- `pnpm typecheck` / `pnpm lint` / `pnpm test` / `pnpm build` 全绿；证据按票据 17 建立的追加式约定写入 `verification/release-evidence.md`。
