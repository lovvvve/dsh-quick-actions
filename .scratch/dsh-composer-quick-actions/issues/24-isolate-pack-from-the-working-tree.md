# 让打包验证不再改写工作树

Type: task
Mode: AFK
Status: resolved
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

## Answer（答案）

按已拍板的方向 A1 落地：打包契约把 workspace 复制到**仓库外**的临时副本，在副本里执行 `pnpm pack`，`prepack` → `build` → `rmSync('lib')` 与整条构建链随之搬进副本。工作树的 `packages/composer-quick-actions/lib/` 在 `pnpm test` 前后内容与 mtime 均不变，四种咬人方式全部关闭，打包契约的覆盖面不缩水。

### 改了什么

| 文件 | 改动 |
|---|---|
| `tests/release/support.ts` | 新增 `stageWorkspace(into)`、`outputFingerprint(dir)`、导出 `repoRoot`；`sourceModules` 收敛到内部 `walk()` 之上（行为不变） |
| `tests/release/packaging.spec.ts` | `beforeAll` 先 stage 再 pack 副本目录；新增 `packing isolation` 三条断言；头部注释改写为"为何打副本" |
| `CLAUDE.md` | 「`pnpm test` 会删掉并重建工作树 `lib/`」的陷阱改为已修复，并写明 `stageWorkspace()` 的维护约束 |

`package.json` 的 `build` / `prepack` 脚本**未改动**——`rmSync('lib')` 是票据 17 的正确修复，缺陷只在它跑错了目录。

### 副本长什么样

```
<tmpdir>/quick-actions-pack-XXXX/
  staged/
    package.json  pnpm-workspace.yaml  LICENSE  tsconfig.base.json
    node_modules -> <repo>/node_modules
    packages/composer-quick-actions/{src,tests,README*,package.json,tsconfig.json,tsdown.config.ts}
      node_modules -> <repo>/packages/composer-quick-actions/node_modules
    packages/composer-quick-actions-bundle/…   （同样 symlink）
    tools/dsh-client-bundle/…                  （同样 symlink）
  tarballs/          ← pnpm pack --pack-destination 与解包目录
```

- **包目录列表从 `pnpm-workspace.yaml` 的 `packages` glob 推导**（只支持 `<dir>/*`，其他形态直接抛错），新增 workspace 包会自动进副本，不必回来改测试。
- **不复制** `node_modules` / `lib` / `lib.dsh-client-stage`：产物留空是断言"packed 的东西是副本本次构建的"的前提。
- 依赖不重装，改用 symlink 指回已安装位置。

### 自证：副本里 `tsc -b` 与 `tsdown` 都能跑通（无需 install）

票据要求的两个难点各有其成立理由，均已实测：

1. **`tsc -b`**：功能包 `tsconfig.json` 没有 `references`（项目引用只在根 `tsconfig.json` 里，`tsc -b` 在包目录跑时用的是包自己的配置），因此它唯一的外部依赖是 `extends: ../../tsconfig.base.json`——副本根已复制该文件，相对路径成立。
2. **`tsdown`**：`tsdown.config.ts` 里的 `@dsh-plugins/dsh-client-bundle` 经副本包内 `node_modules` symlink 命中 pnpm 的 workspace 链接，Node 按 realpath 解析回**原始** `tools/dsh-client-bundle/src/index.ts`（该包 `exports` 直接指向 TS 源码，不发布、不构建）。`tsc` 与 `tsdown` 两个可执行文件则由 `pnpm run` 注入的 `node_modules/.bin`（副本根与包级都指回原始位置）提供。
3. **副本必须是 workspace**：`pnpm-workspace.yaml` 一并复制，否则 pack 时 `workspace:*` 无从替换（bundle 的 `dependencies` → `0.1.0`、功能包 devDeps 的 `@dsh-plugins/dsh-client-bundle` → `0.0.0`），根 `LICENSE` 也不会被带进两个 tarball——既有断言 `ships the MIT text with both packages` 就是这一条的守卫。

产物一致性的硬证据：副本构建出的 `lib/client.js` 为 **146124 字节**，与工作树 `pnpm build` 的产物同尺寸；tarball 里仍只有 `lib/client.js`、`lib/index.js`、`lib/types.js` 三个 JS 与唯一一份 `lib/client.js.map`。

### 四种咬人方式的处置

| # | 场景 | 现状 |
|---|---|---|
| 1 | 测试中途失败 | 已刻意验证：往 `src/index.ts` 追加语法错误 → 副本 `prepack` 失败 → `pnpm pack` 失败 → 整个 suite 失败（27 skipped），工作树 `lib/` 44 个文件的内容与 mtime **逐项不变** |
| 2 | 与 `pnpm watch:client` 并存 | 已实测：watcher 全程存活，`pnpm test`（22 files / 481 tests 全绿）期间 `lib/` 指纹不变，`lib/client.js` 仍为 146124 字节且 `node --check` 通过 |
| 3 | 静默改写 gitignored 产物 | 不再发生；`packing isolation` 用 `size:mtimeMs:sha256` 指纹固定，回归会红 |
| 4 | 每次 test 内含完整构建 | 构建仍在（契约要求验真实 `prepack` 链），但只发生在副本；工作树的增量状态（`lib/tsconfig.tsbuildinfo`）不再被推翻，`pnpm test` 全量 11.7s |

### 新增的三条断言（`packing isolation`）

1. `leaves the working tree build output byte- and mtime-identical` — 指纹在 spec 模块加载时抓取，与 pack 之后比对；含 mtime 是因为"删掉再写出同样字节"仍然存在 GUI 取不到文件的窗口。
2. `stages the copy outside the repository` — `relative(repoRoot, staged.root)` 必须以 `..` 开头。
3. `packs artifacts the copy built, from a copy that was staged with none` — 副本 stage 完成时 `lib/` 指纹为 `null`，pack 之后存在 `lib/client.js`；这条挡住"副本里其实是复制来的陈旧产物"这种伪隔离。

### 质量门

| 命令 | 结果 |
|---|---|
| `pnpm typecheck` | 通过（两遍：`tsc -b` + `tsconfig.test.json`） |
| `pnpm lint` | 0 warning / 0 error |
| `pnpm test` | 22 files / 481 tests 全绿；release 两个 spec 共 87 tests |
| `pnpm build` | 通过，工作树 `lib/` 重新落地新鲜产物，无 `lib.dsh-client-stage` 残留 |

证据按第 13.1 节追加进 [`verification/release-evidence.md`](../verification/release-evidence.md)。

### 已知边界

- 副本仍**依赖工作树已 `pnpm install`**（symlink 指向现成的 `node_modules`）。这与改动前一致：没装依赖时 `pnpm test` 本来也跑不起来。
- 副本按 `mkdtempSync` 一次一份，`afterAll` 整体删除；并行跑多个 vitest 进程不会互相踩。
- 指纹断言测的是「测试期间没人动工作树 `lib/`」：并存的 `pnpm watch:client` 因为源码没变不会重建，但**同时手工跑 `pnpm build`** 会让这条红——那是真实的并发写入，不是误报，重跑即可。
- 本次 watcher 用 SIGTERM 关闭后**没有**遗留 `lib.dsh-client-stage`，但这不构成对[票据 22](./22-clean-client-staging-on-watch-close.md) 的结论——该票据要覆盖的是构建失败时保留 staging、随后关闭的路径。
