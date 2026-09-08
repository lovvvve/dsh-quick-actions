# 完成安装 Bundle 与发布文档

Type: task
Mode: AFK
Status: resolved
Blocked by: 15, 16, 20

## Question（问题）

完成安装 bundle 的 `dsh.bundle.patch`、功能包 exports、`dsh.client` 声明、包依赖与 peer range；最终名称、scope 和安装命令一律采用[票据 20](./20-choose-publishing-identity-and-license.md)确定的发布身份，不得把脚手架无 scope 名称当作发布决策。验证正式安装、本地 tarball 安装和重启激活；本地/离线安装必须明确两个 tarball 的可复现解析方式并在证据中说明，不得假设 bundle tarball 内嵌功能包。补齐中文/英文 README：配置预置、三种布局、Settings 路径、开发 build/watch、现有 GUI HMR 前置和卸载/升级流程。首版功能说明按 spec 第 12、16 节撰写——只提供发送动作，静态文本经公共 `setDraft` + `submit` 走官方提交路径；**不提供插入动作**，该能力待公共 `insertText` 可用后另建 effort，README 不得再出现能力矩阵或兼容性抑制说明。peer range 覆盖公开 `setDraft` 与 `submit` 的受支持 DSH。

README 必须单列 Command Send Action（命令发送动作）：`/` 开头文本合法，确认默认开启且可关闭；启用确认时面板展示最终提交内容但**不会**出现 DSH 原生 `/` 候选菜单，关闭确认后命令一键提交、无预览。命令一律由官方路径裁决——这是已知并接受的取舍（spec 第 16.2 节）。正式首发版本未知时不得虚构最低 DSH 版本。不得要求修改 Agent preset。


## Comments（评论）

### 2026-09-08 — Catalog 通道改为 Settings base 层

spec 第 17 节取代第 6.2 节：目录不再经自有 Remote 发布，改由 Host 注册只读命名空间 `composer-quick-actions-catalog` 并以 composition `base` 层承载快照。本票据相应调整：

- 功能包不再输出 `./typert` / `./remote` 生成产物；`./remote` 入口的去留随本票据的发布面决策一并确定。
- README 需说明目录经只读 Settings 命名空间发布，以及 `Config.presets` 是预置的授权声明通道。

## Answer（答案）

安装形态、发布身份与中英文文档已落地，并在**隔离的 `DSH_HOME`** 中实测（未启动第二个服务器，遵守单 GUI 通道约束）。

### 1. 发布身份落地

功能包 `dsh-composer-quick-actions`、安装 bundle `dsh-composer-quick-actions-bundle`，两者 `version: 0.1.0`、`license: MIT`，**均不设 `publishConfig`**（票据 20：暂不发布）。`LICENSE` 无需复制进各包——pnpm 打包时会从仓库根自动带入，已在 tarball 内容中核实。

### 2. `./remote` 入口：删除（本票据待决的发布面决策）

`src/remote.ts` 与 `./remote` 导出、以及 tsdown 的 `remote` entry 一并删除。依据：spec 第 17 节决定首版**根本没有自有 Remote**，该文件实际内容只有 `export {}`，第 11.1 节把 `./remote` 列为公开面的表述已被第 17.4 节取代。功能包公开面现为 `.`、`./client`、`./types`、`./package.json` 四项，由测试固定。

### 3. `dsh.client` 声明补全

契约来源是已安装的 `@deepseek-ai/dsh-client-modules`（0.1.2-rc.1）：`parseDshClient` 接受 `platform`（必填字符串，非 `'web'` 的行直接被 web 扫描跳过）、`inject?`、`external?`、`immediately?`。

```json
"dsh": { "client": {
  "platform": "web",
  "inject": ["@deepseek-ai/dsh-client-ui-renderer","@deepseek-ai/dsh-client-ui-settings",
             "@deepseek-ai/dsh-client-connection","@deepseek-ai/dsh-client-locale",
             "@deepseek-ai/dsh-client-ui-conversation"],
  "external": ["react","react/jsx-runtime"]
} }
```

- `inject` 命名的是**包**而不是服务名。Client 注入的四个 Cordis 服务的实际提供者已逐个核实：`slots` ← `dsh-client-ui-renderer`（`super(ctx, "slots")`）、`settingsScope` ← `dsh-client-ui-settings`、`connection` ← `dsh-client-connection`（`provide("connection", …)`）、`locale` ← `dsh-client-locale`；另加经 `ctx.get` 读取的 `conversation` ← `dsh-client-ui-conversation`。
- `external` 与构建适配器声明的 externals 一致，且两者都是浏览器模块表的**平台种子**（种子表实测为 `react`、`react/jsx-runtime`、`react-dom`、`react-dom/client`、`@deepseek-ai/cordis`、`@deepseek-ai/dsh-client-store`、`@deepseek-ai/dsh-client-ui-slots`、`@deepseek-ai/dsh-client-ui-primitives`）。运行时 `makeRequire` 的解析顺序是 seed → loadCache → 已注册 factory，`external` 只影响到达顺序，种子会短路；声明它是漂移守卫而非运行时必需。
- **「运行时不要求」不等于「不该声明」。** DSH 运行时确实不要求声明种子：`makeRequire` 无条件第一优先命中冻结的 seed 表（`@deepseek-ai/dsh-client-modules/lib/client.js` 的 seed → loadCache → factory 分支），所以 `react` / `react/jsx-runtime` 即便完全不出现在 manifest 里也 require 得到；main 上的 [`research/client-ui-primitives-availability.md`](../research/client-ui-primitives-availability.md) 就是在这个意义上写「不需要改 `dsh.client`」的。本票据仍然声明它们，属于**本仓库自设的、比运行时更严的自证机制**：manifest 的 `dsh.client.external` 与产物里的 `require` 调用集合由 `tests/release/packaging.spec.ts` 做严格相等断言，构建期 externals 与已发布 manifest 只改一边就会立刻变红。两者不冲突——一个是运行时下限，一个是发布契约。
- 关于在 `external` 里写种子名：`orderByModuleGraph` 的契约注释明确写了 external 项「either the package row it names 或 a static-table name that adds no graph edge」，所以这样声明在契约之内、且完全惰性。但需如实记录一条**约定偏离**：核心里只有 `dsh-api-session-controller` / `dsh-api-workspace-controller` 用 `external`，且都是为跨插件动态包（`@deepseek-ai/dsh-api-gateway/client`）排序，没有任何第一方包把 `react` 这类种子写进去。这里保留它是有意的——让功能包 manifest 自述构建期 externals，并由 `tests/release/packaging.spec.ts` 把它与**实际产物的 `require` 调用**绑在一起；`inject` 则严格照第一方约定（对比 `dsh-client-ui-conversation` 逐个列出所注入服务的提供者包）。

### 4. peer range

DSH 核心包一律 `>=0.1.2-rc.1`：这是本 effort 全程取证的基线版本，**不虚构首个正式支持版本**，也不用 `^0.1.2-rc.1` 那种会把 0.2.x 排除在外的上界。`@deepseek-ai/cordis: ^4.0.2`、`@deepseek-ai/schemastery: ^3.18.2`、`react: ^18.3.1`。新增了 Client 侧消费的五个契约包。

peer 声明**不参与 profile 解析**：profile 的 pnpm 是 `autoInstallPeers: false`，DSH 核心装在 DSH 自己的安装锚点而非 profile 的 `node_modules`。因此 `pnpm peers check` 会把它们全列为 missing——这与现状一致（用户真实 web profile 里已装的第三方插件已产生 19 条同类 missing peer），属预期噪声，README 已说明。

### 5. 顺带修掉的打包缺陷（spec 第 15 节留给本票据的前置项）

`tsc -b` 原先向 `lib/types/` 发射**JavaScript** 以及 `.js.map` / `.d.ts.map`，而 `files` 的 `lib/**/*.js` + `lib/**/*.map` 把它们全部打进 tarball。实测后果：tarball 里带着**整包第二份未打包的 JS**（含一份 tsc 编译的 Client——ModuleLoader 根本无法加载它），以及指向未发布 `src/` 的坏 sourcemap。这正是 spec 第 15 节「JavaScript 与 sourcemap 不会跨代发布」要求验证的失败。

修法：包级 tsconfig 改 `emitDeclarationOnly: true` + `declarationMap: false` + `sourceMap: false`，`files` 改为逐项显式列举。修后 tarball 只有 `lib/index.js`、`lib/types.js`、`lib/client.js`、`lib/client.js.map`、`lib/types/**/*.d.ts` 与两份 README（加 pnpm 带入的 LICENSE）。形状与官方 `@deepseek-ai/dsh-base` 的 `files` 一致。

同时给功能包加了 `prepack: pnpm run build`（实测 `pnpm pack` 会执行 `prepack`），保证 pack / publish 永远不会带出陈旧产物。

### 6. 安装验证（隔离 `DSH_HOME`）

逐条命令、退出码、版本与时间已按 spec 第 13.1 节记入 [`verification/release-evidence.md`](../verification/release-evidence.md)（该文件此前不存在，本票据建立，后续票据追加而非重写）。下面是结论摘要。

`dsh plugin --profile <name> <args>` 的实现是 pnpm 转发器 + 按**已安装状态**回填 `dsh.profile.bundles`（声明了 `dsh.bundle` 的依赖入层，移除或没有该声明的出层）；`dsh.bundle.patch` 由 `join(packageDir, declared)` 直接读文件，**不经 `exports` 解析**，因此不需要导出 patch 子路径。

实测结果：

| 场景 | 结果 |
|---|---|
| `add dsh-composer-quick-actions-bundle`（registry） | `ERR_PNPM_FETCH_404` —— 两个包按票据 20 决定尚未发布，如实记录，不绕过 |
| `add ./bundle.tgz` | 失败：pnpm 仍去 registry 解析 bundle 的传递依赖 `dsh-composer-quick-actions@0.1.0` |
| `add ./feature.tgz ./bundle.tgz`（同一条命令） | **同样失败**——直接依赖不会满足传递依赖 |
| 先 `add ./feature.tgz` 再 `add ./bundle.tgz` | **同样失败**（并额外打印 `declares no dsh.bundle` 警告，因为功能包本身不是 bundle 层） |
| profile 的 `pnpm-workspace.yaml` 加 `overrides: dsh-composer-quick-actions: file:<绝对路径>` 后 `add ./bundle.tgz` | **成功** |

因此**两个 tarball 的可复现解析方式 = profile 级 pnpm `overrides` 指向功能包 tarball 绝对路径 + `dsh plugin add` 指向 bundle tarball**。bundle tarball 不内嵌功能包已由测试固定（无 `node_modules/`、无嵌套 `.tgz`、无 `lib/`）。

成功安装后核实：profile `package.json` 的 `dependencies` 与 `dsh.profile.bundles` 都被 `dsh plugin` 自己回填；功能包以传递依赖 hoist 进 `<profile>/node_modules/dsh-composer-quick-actions`（版本 0.1.0，`lib/` 内容正确）；`dsh --profile web --dump-config` 输出中出现

```
# == dsh-composer-quick-actions-bundle
- id: composer-quick-actions
  name: dsh-composer-quick-actions
```

这是**重启激活的结构性证据**：该层已进入下一次 profile 启动会应用的合成树，取证过程不需要启动服务器。它证明的是「装对了、下次启动会加载这条 row」，**不**证明 Host 真的起来、Client 真的渲染——那属于票据 18 的真实 GUI 实测。`remove dsh-composer-quick-actions-bundle` 会同时撤掉依赖与该层（`node_modules` 清空）；重复 `add` 同一版本幂等，不产生重复层。

安装 bundle 的 `"type": "module"` 一并去掉了：该包不含任何 JavaScript（`files` 只有 patch 与两份 README），`type` 对它没有语义；`dsh.bundle.patch` 由 `join(packageDir, declared)` 直读文件，不经 `exports` 解析，因此也不需要导出 patch 子路径。

### 7. `cordis.patch.yml`

形状不变（单条 `insert`，`id: composer-quick-actions`，`name: dsh-composer-quick-actions`），补上了注释：安装通道如何工作、`id` 属于已安装身份不得重命名、以及 `config.presets` 的指引。

### 8. 文档

四份 README：功能包中/英、bundle 中/英，另加刷新过的仓库根 README。覆盖 spec 第 12 节要求的全部条目——预置配置（`Config.presets` 是预置的授权声明通道）与只读目录命名空间、三种布局、两个 Settings 命名空间与 `<DSH_HOME>/settings.yaml`、**兼容矩阵**、开发 build/watch、现有 GUI HMR 的三条前置、安装（正式 + 本地 tarball）、升级、降级、卸载、手工彻底清理。兼容矩阵列出取证基线（核心包 0.1.2-rc.1）、peer 下界与无上界的理由、平台限制和消费的公共契约，并明确写出「下界不是首个正式支持的 DSH 发布版本」；同时说明 `dsh --version` 打印的是桌面端依赖集标签（本机 `0.1.1-rc.2`），与核心包版本不是同一个数字——这两个数并存容易被误读为矛盾，所以在文档里直接消歧。首版功能按第 12、16 节撰写：只有发送动作、单一 `setDraft` + `submit` 装载路径、**不提供插入动作**（待公共 `insertText` 另建 effort），**命令发送动作单列一节**（`/` 合法、确认默认开启可关闭、启用确认时展示最终提交内容但不会出现原生候选菜单、关闭确认后一键提交无预览、一律由官方路径裁决）。README 里没有能力矩阵、没有兼容性抑制、没有虚构的最低 DSH 版本、不要求改 Agent preset、不建议改 `node_modules`。

### 9. 测试

新增两个契约 spec（共 71 条）：

- `tests/release/packaging.spec.ts` —— 真跑 `pnpm pack` 两次并解包：发布身份、公开导出面、`dsh.client` 三项（其中 `external` 与**实际产物里的 `require` 调用**对齐、且每项必须是平台种子；`inject` 必须覆盖 Client 自己 `inject` 列表里每个服务的提供者包）、bundle patch 的 YAML 结构、bundle 不内嵌功能包、packed 文件清单（一份 JS、一份 sourcemap、`lib/types` 只有 `.d.ts`、无 `src/`、无 `tsbuildinfo`）、peer range。
- `tests/release/docs.spec.ts` —— 按内容而非标题固定四份 README 的必备覆盖，并把已关闭决策的词汇（能力矩阵、兼容性抑制、虚构最低版本、改 Agent preset / `node_modules`）列为禁止串。

`pnpm typecheck`、`pnpm lint`、`pnpm test`（22 文件 476 用例）与 `pnpm build`、两次 `pnpm pack` 退出码均为 0，明细见证据文件。为 patch 的结构断言新增根 devDependency `yaml`。

两个 spec 共用 `tests/release/support.ts`（沿用 `tests/{client,model}/support.ts` 的既有约定）；带版本的断言从 manifest 派生，因此改版本号会在文档契约测试里失败并点名仍写着旧版本的文件，而不是留下不一致的 README。

### 10. 已知边界（留给票据 18 / 21）

- Host 真实加载、Client 从目录命名空间 `base` 读到快照、常驻判定、等宽与端到端发送，仍未在运行中的 DSH GUI 里实测；本票据只到「row 进入合成 profile 树」为止。
- **正式安装命令的形态只能在发布之后才谈得上实测**；本票据记录的是它在未发布状态下的真实行为（404）。README 已明确标注两个包尚未发布。
- `pnpm peers check` 的 missing peer 是结构性噪声，不是缺陷；若将来 DSH 把核心包也装进 profile，这一节说明需要复核。
- **spec 第 15 节的另一条前置项不成立，已拆票**。第 15 节要求验证「JavaScript 与 sourcemap 不会跨代发布」**和**「watch 关闭清理 staging」两条。前者已验证失败并在本票据修复（见第 5 节）；后者经核查同样不成立——`tools/dsh-client-bundle/src/index.ts` 只在发布成功后 `rm(staging)`，构建失败时按原子发布设计保留，而没有任何路径在 watcher 关闭时清理，现有契约测试 `keeps failed staging outside a trailing-separator final outDir` 固定的恰恰是「失败时保留 staging」。修复落在票据 11 的适配器代码、与本票据的发布面主题无关，因此拆为[票据 22](./22-clean-client-staging-on-watch-close.md)而不是就地扩大范围；票据 18 的 `## Comments` 已记录该前置关系。
- 证据文件只覆盖本票据能在不启动服务器的前提下取得的部分。真实 GUI 实测、卸载后 Settings 残留与手工清理的逐条执行、以及第 13.2 节的行为矩阵都留在文件的「本节未覆盖」清单里。
