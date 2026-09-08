# 清理 watch 关闭后遗留的 Client staging 目录

Type: task
Mode: AFK
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
