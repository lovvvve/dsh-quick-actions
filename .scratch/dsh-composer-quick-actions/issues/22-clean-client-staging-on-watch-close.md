# 清理 watch 关闭后遗留的 Client staging 目录

Type: task
Mode: AFK
Status: resolved
Blocked by: none

## Question（问题）

spec 第 11.2 节要求「Watch 构建失败时必须保留最后一次完整成功产物，修复后继续发布；**关闭时不得遗留子进程或临时 staging**」。第 15 节把这一条与「JavaScript 与 sourcemap 不会跨代发布」并列，要求补充验证，并规定验证不通过时把修复交给票据 17 的前置票据。

票据 17 已验证并修复前半条（`tsc -b` 曾把整包第二份 JS 与坏 sourcemap 发进 tarball）。后半条经核查**不成立**，需由本票据修复：

- `tools/dsh-client-bundle/src/index.ts` 只在 `publishClientBundle()` 内部、也就是**发布成功之后**才 `rm(staging, { recursive: true })`。构建失败时 staging 目录按设计保留（原子发布依赖它），而没有任何路径在 watcher 关闭时清理它。
- 现有契约测试 `tools/dsh-client-bundle/tests/bundle.spec.ts` 里的 `keeps failed staging outside a trailing-separator final outDir` 只断言**最终 outDir** 为空——它固定的恰恰是「失败时保留 staging」；watch 用例 `rebuilds the same client artifact when the watched entry changes` 只断言失败时保留上一次成功产物、修复后继续发布，两者都没有覆盖关闭清理。
- 净结果：「watch 期间最后一次构建失败 → 关闭 watcher」会在包目录旁留下 `lib.dsh-client-stage/`。`.gitignore` 的 `**/lib.dsh-client-stage/` 把它遮住了，所以不会污染提交，但这违反第 11.2 节，而且 `pnpm test` 现在发现不了。

需要决定并实现：

1. 关闭时的清理点放在哪里——tsdown 的关闭钩子、进程信号处理，还是「下一次构建开始前先清空 staging」这种不依赖关闭时机的等价做法；
2. 如何用测试固定它，且不显著拖慢现有那条 35s 的 watch 用例。

硬约束：不得破坏原子发布。`lib/` 中最后一次完整成功的产物在任何情况下都必须保留，修复不能退化成「失败时连带清掉已发布产物」。

## Comments（评论）

### 2026-09-08 — 由票据 17 拆出

票据 17 在核实 spec 第 15 节留给它的两条前置项时发现本项不成立。修复落在 `tools/dsh-client-bundle`（票据 11 的代码），与票据 17 的发布面主题无关，且另一会话已预告要为 CSS Modules 改同一批文件，因此拆为独立票据，而不是就地扩大票据 17 的范围。

本项属于 spec 第 11.2 节的发布要求，应在[票据 18](./18-run-integration-and-release-verification.md)的发布验证收口之前完成；票据 18 的 `## Comments` 已记录该前置关系。

## Answer（答案）

清理点三个选项都不采用：tsdown 关闭钩子**不存在**（选项 1），单纯"下一次构建开始前清空"关闭后仍有残留（选项 3），而进程信号处理（选项 2）**可行但不采用**——它要在一个构建配置工厂里改写整个 tsdown 进程的信号语义（同一次运行里还有 Host 配置），得自己接管退出码，且覆盖不了 SIGKILL；用"接管进程关闭契约"换一个窄窗口不值得。改为让 scratch 目录**不再参与发布**——产物在 `generateBundle` 里捕获到内存，`onSuccess` 才原子写入 `lib/`；bundler 写出的 scratch 目录一律不可信，在每次构建开始与 `closeBundle` 时**无条件**删除。这样"关闭时不得遗留临时 staging"不依赖关闭时机，而由"每次构建自己收尾"保证。

### 为什么不能挂在关闭时机上（取证）

| 事实 | 取证 |
|---|---|
| tsdown 在进程退出时**没有**关闭钩子 | `tsdown@0.22.14` `buildWithConfigs()` 只在 `restart()`（配置重载）里执行 `disposeCbs`；`bundle[Symbol.asyncDispose]` 才是调 `watcher.close()` 的地方。`q + enter` 快捷键直接 `process.exit(0)`，全文件没有任何 SIGINT / SIGTERM 处理 |
| rolldown 的 `closeWatcher` 同样不可靠 | `rolldown@1.2.7` 有 `closeWatcher`，但它只在 `watcher.close()` 时触发，也就是只覆盖上面那条 restart 路径 |
| 失败构建**先写盘、后失败**，钩子层面与成功不可区分 | 实测 `eval` + `failOnWarn` 的钩子序列为 `buildStart → buildEnd（无 error 参数）→ renderStart → generateBundle → writeBundle → closeBundle`；错误是 rolldown 事后在 `unwrapBindingResult` 把升级后的警告聚合成 JS 错误抛出的。所以 `buildEnd(err)` / `renderError` 都拿不到错误，"按失败清理"这条路不成立 |
| `closeBundle` 会触发，但**早于** `onSuccess` | tsdown 在 watch 的 `BUNDLE_END` 与 `ERROR` 两个分支都调 `event.result.close()`；一次性构建里 rolldown 的 `build()` 内部也会 close。顺序是 `closeBundle → onSuccess`，因此只要发布还依赖 scratch，就不能在 `closeBundle` 里无条件删 |
| `write: false` 救不了场 | 一次性构建里它确实完全不落盘（实测 `generateBundle` 仍拿到 `client.js` 与 `client.js.map`，`writeBundle` 不触发，连 `lib` 都不建），但 **watch 模式不理它**——失败构建的产物会被直接写进 `outDir`（实测：`lib/client.js` 被写成了坏产物）。所以 `outDir` 必须继续指向旁路 scratch，该选项不采用 |

把发布改成"从内存发布"之后，最后一条冲突消解：`closeBundle` 里的删除不再有任何顾虑。

### 改了什么

| 文件 | 改动 |
|---|---|
| `tools/dsh-client-bundle/src/index.ts` | 新增插件 `dsh-client-atomic-publish`：`generateBundle` 捕获 chunk code 与 map asset，`buildStart` / `closeBundle` 无条件删 scratch；`onSuccess` 改为从内存发布（捕获为空时响亮报错）；`replaceFile(destination, content)` 由 `copyFile` 改 `writeFile`（保留 Windows 的 EEXIST / EPERM 重命名回退）；`client.js` / `client.js.map` 收成 `CLIENT_FILE` / `CLIENT_MAP_FILE` 常量，`entryFileNames` 一并引用 |
| `tools/dsh-client-bundle/tests/bundle.spec.ts` | 新增 3 条用例、改写 1 条；新增 `entriesOf()` 目录树断言 |
| `CLAUDE.md` | 「原子发布」条目按新机制改写；项目状态与 frontier 回填 |

发布顺序（先 map、再 js）与失败时 `lib/` 原样保留的语义都不变。

### 测试怎么固定

| 用例 | 固定什么 |
|---|---|
| `keeps bundler scratch output beside a trailing-separator outDir instead of inside it` | 替代原 `keeps failed staging outside a trailing-separator final outDir`。原断言只看"最终 outDir 为空"，在新机制下失败构建本就不建 `lib/`，该断言会永真而不再守卫嵌套；改为直接断言 scratch 路径是 `lib` 的**同级兄弟目录**——这也是已发布 sourcemap 相对路径仍然可解析的前提 |
| `discards bundler scratch inherited from an interrupted run` | 先造陈旧 scratch，再跑一次早期失败（未解析导入）的构建，包目录须只剩 `src` 与 `tsdown.config.ts` |
| `leaves no build scratch anywhere when a build fails` | 一次性失败构建后，包目录树里既无 `lib/` 也无 scratch |
| `leaves no build scratch behind when the watcher closes after a failed build` | 票据描述的原场景：watch 成功 → 改坏 → 等失败 → SIGTERM 关闭 → 包目录恰好 `lib` / `src` / `tsdown.config.ts`，`lib/` 恰好两个文件且内容等于最后一次成功产物 |
| `fails the build loudly when the generated client cannot be published` | 把 `lib` 换成同名文件让发布必败，构建须以我们自己带前缀的错误失败（见下方 onSuccess 一节） |
| `emits an executable DSH ModuleLoader factory with externals and a source map`（补断言） | 已发布的 `client.js` 末尾必须仍带 `//# sourceMappingURL=client.js.map`。发布改为从内存写之后，这条链接是 rolldown 放进 `chunk.code` 的，原先没有任何用例守它 |

变异校验（三次刻意破坏，验证用例不是装饰）：

- 删掉 `closeBundle` 清理 → watch 关闭用例立刻红，其余 15 条绿。
- 删掉 `onSuccess` 的异常兜底 → 发布失败用例立刻红，失败信息退化成裸的 `node:internal/fs/promises` unhandled rejection。
- 删掉 `buildStart` 预清理 → **仍全绿**：`closeBundle` 连早期失败构建也会触发，已把陈旧 scratch 覆盖掉。预清理因此不是任何可观测行为的唯一来源，保留它只为兜住"进程被强杀后无人清理"这一个窗口（即票据列举的方案 3），代码注释已写明；用例名也据此从 `clears ... left behind` 改为 `discards ... inherited`，不再声称自己守的是 buildStart。

耗时：本文件 12 条 2.6s → 16 条 4.4s，距 35s 上限仍有大量余量；`pnpm test` 全量 22 文件 / 485 条，`typecheck` 两遍与 `lint` 均干净。证据按 spec 第 13.1 节记入 [`verification/release-evidence.md`](../verification/release-evidence.md) 的「票据 22」一节。

### 顺手修掉的既有缺陷：`onSuccess` 不被 await

`tsdown@0.22.14` 的 `executeOnSuccess` 是 `config.onSuccess(config, ab.signal)`——**既不 await 也不 catch**（`build-D_enfyvD.mjs:177`）。这意味着发布过程里任何异常（EACCES、ENOSPC，或本次新增的"没有可发布产物"守卫）都会变成 unhandled rejection，在 Node 24 的默认策略下**直接打死 watcher**，与第 11.2 节「修复后继续发布」相悖。该缺陷早于本次改动（旧 `onSuccess` 同样在做可能失败的文件操作），但既然被暴露就一并修：发布包在 try/catch 里，失败时打印带 `dshClientBundle:` 前缀的错误并设 `process.exitCode = 1`（与 tsdown 自己 `logger.error` 的做法一致）。于是 watch 会话在发布失败后仍然活着，一次性构建则照旧以非零退出码失败。

### 硬约束核对：原子发布没被破坏

- 发布只发生在 `onSuccess`，且只从内存写：失败构建（含这种"写完才失败"的 `failOnWarn`）永远不会被消费。
- 额外收获：`renderChunk` 的模块表边界检查抛错时 `generateBundle` 不会执行，`generated` 保持 `undefined`，即使 tsdown 误报成功也只会响亮报错，不会发布陈旧产物。
- 真实功能包实测：`pnpm build` 产出 `lib/client.js` 146124 字节 + map，无 scratch 残留；`pnpm watch:client` 启动后正常发布同尺寸产物，watch 期间与 SIGTERM 关闭后包目录都没有 scratch 目录。

### 已知边界

- **scratch 目录在 watch 构建期间仍会短暂存在**（rolldown watch 忽略 `write: false`），因此 `.gitignore` 的 `**/lib.dsh-client-stage/` 仍然必要，**不要删**。
- 进程被 SIGKILL、或在写盘与 `closeBundle` 之间被强杀时，scratch 会残留到下一次构建开始（由 `buildStart` 清掉）。这个窗口进程内钩子无法覆盖，spec 第 11.2 节的「关闭时不得遗留」按正常关闭路径判定。
- 「关闭时不得遗留子进程」这半条本就成立：适配器不 spawn 任何子进程（rolldown 是进程内 N-API，`dts: false`），watcher 自身在 SIGTERM 下正常退出——新用例里 `once(child, 'close')` 能返回即是证据。
- tsdown 的体积报告仍把两个文件标注在 `lib.dsh-client-stage/` 下（它报告的是配置的 `outDir`），只是显示措辞，与实际发布位置无关。
