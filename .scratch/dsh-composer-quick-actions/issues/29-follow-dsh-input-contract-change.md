# 跟进 DSH 0.1.5-rc.1 的 Input 契约变更

Type: task
Mode: AFK
Status: resolved
Blocked by: none

## Question（问题）

DSH 把公开 Input 契约里的 `imageIds` 改名为 `attachmentIds`，插件在新版上整个表面崩溃。修复它，并据此修正「不设 peer 上界」这条判断。

### 症状与取证

用户在自己的 profile 上装了 `0.1.0-rc.2` 后报告「按钮加载出错」。在真实浏览器里复现，页面显示的是插件自己的错误边界（「快捷动作出错了」加「重新加载」），控制台记下：

```text
[composer-quick-actions] surface failed
TypeError: Cannot read properties of undefined (reading 'length')
    at isOccupiedDraft
    at composerGate
    at derive → publish → observe → SessionSurface
```

`isOccupiedDraft` 读的是 `input.draft !== '' || input.imageIds.length > 0 || input.occurrences.length > 0`。

**根因**：本机 `npx @deepseek-ai/dsh@latest` 现在解析到 **`0.1.5-rc.1`**，而本 effort 全部取证做在 `0.1.2-rc.1` 上。新版 `@deepseek-ai/dsh-client-ui-conversation@0.1.5-rc.1` 的 `lib/types/client/contract/input.d.ts` 里：

```ts
export interface InputState {
    readonly draft: string;
    /** Ordered runtime-only attachment ids; browser objects stay in ConversationController. */
    readonly attachmentIds: readonly DraftAttachmentId[];
    readonly draftRev: number;
    readonly phase: 'plain' | 'adjudicating' | 'claimed' | 'submitting';
    readonly claim?: { readonly token: string; readonly hint?: string; readonly attachments?: boolean };
    readonly occurrences: readonly Occurrence[];
    readonly queue: readonly QueuedMessage[];
}
```

字段由 `imageIds` 改名为 `attachmentIds`，**其余字段不变**。新版客户端产物里 `imageIds` 出现 **0** 次。

**与本轮改动无关**，逐层排除过：目录校验 `buildPresetCatalog` 返回 `ok = true`；已安装产物在假 ModuleLoader 里 factory 正常执行、只 require 那四个种子模块；用真实五条预置在 jsdom 里渲染，40 个用例通过、20 个失败全是夹具 id 不匹配。异常只在真实 shell 触发。

### 决定

**只支持新契约。** 用户定案：字段改为 `attachmentIds`，不保留 `attachmentIds ?? imageIds` 之类的回退。理由是这个插件尚未发布、没有任何用户，为不存在的旧版使用者留一个永久废弃字段不划算。

DSH peer 下界随之从 `>=0.1.2-rc.1` 提到 **`>=0.1.5-rc.1`**。

### 这推翻了一条判断

两份 README 此前写着「不设上界是因为 DSH 仍在 0.x rc 阶段」，其隐含前提是 rc 阶段不会破坏公开契约。**该前提已被证伪**：0.1.2-rc.1 到 0.1.5-rc.1 之间，一个被 spec 9.5 钉死为单飞唯一判据的字段被改名。文档措辞须相应修正，不能再把「不设上界」说成安全的。

### 待办

1. `src/client/dsh.ts` 的 `InputState` 声明改字段名。
2. `src/client/session/guards.ts` 的 `isOccupiedDraft` 与两处注释。
3. `src/client/session/execution.ts` 注释里的字段列表。
4. 测试侧：`tests/client/execution.spec.ts` 与假 Composer `tests/client/composer.ts`。
5. [spec 第 9.5 节](../spec.md)与 `CLAUDE.md` 里钉死的字段串。
6. peer 下界与两份 README 的兼容性表、验证基线；修正「不设上界」的措辞。
7. 真机复验：装新包，确认表面正常渲染。

### 验收

真实浏览器里五个按钮正常显示、无错误边界；`pnpm test` / `typecheck` / `lint` 通过；文档不再声称 `0.1.2-rc.1` 是验证基线。

## Answer（结论）

**只支持新契约，字段改名跟到底，并加两道闸门防止同类事故重演。**

### 根因与范围

DSH 在 `0.1.2-rc.1` → `0.1.5-rc.1` 之间把 Input 契约里成体系的 image 词汇整体换成 attachment，附件不再限于图片。`isOccupiedDraft` 读 `input.imageIds.length`，新版上拿到 `undefined` 即抛 `TypeError`，经 `derive → publish → observe → SessionSurface` 打垮整个快捷动作区域。

原始判断「其余字段不变」**不成立**。逐行 diff 两版 `contract/input.d.ts` 得到的完整清单见 [spec 第 21.1 节](../spec.md)：除 `imageIds` → `attachmentIds`，还有 `claim.images` → `claim.attachments`、`addImages`/`removeImage`/`pruneImages` → `addAttachments`/`removeAttachment`/`pruneAttachments`、`CommandClaim.submit` 第三参、`adjudicate` 信封；`SubmitImageAttachment` 变成含 `{type:'file'}` 分支的联合 `SubmitAttachment`。`DraftAttachmentId` 未改名。触及本插件的只有前两条。

### 落地

- 源码与测试全面改名，DSH peer 下界提到 `>=0.1.5-rc.1`。
- 开发树用 `pnpm-workspace.yaml` 的 `overrides` 钉住 `dsh-invariants`/`dsh-scope`/`dsh-session`：DSH 各包 peer 锁整条线而 `latest` dist-tag 停在 `0.0.1-rc.1`，pnpm 自动安装的传递 peer 会回落旧线；只加 devDependency 不收敛（被声明的包其自身的 peer 又落回去）。`minimumReleaseAgeExclude` 同步补齐（spec 第 21.5 节）。
- `@deepseek-ai/dsh-client-ui-primitives` 是唯一不跟版本线的：其 `0.1.5-rc.1` tarball 删空了 `dependencies` 而产物仍 `import clsx` 并动态 import `@shikijs/langs/*`，装出来解析不了。运行时不受影响（shell seed 表给的是冻结命名空间），两版所用控件声明逐字相同，故 devDependency 留在 `0.1.2-rc.1`。

### 两条被证伪的判断（spec 第 21.4 节）

1. **rc 阶段不破坏公开契约**——被本次改名直接证伪。两份 README 不再把「不设上界」说成安全，改说每次 DSH 升级都可能需要本插件跟一版。
2. **`>=x-rc.n` 能覆盖后续预发布**——node-semver 只让预发布匹配同三元组比较符，实测 `0.1.6-rc.1` 与 `0.2.0-rc.1` 都不满足 `>=0.1.5-rc.1`，而 DSH 至今全是预发布。用户定案**维持这个形状**（放宽成 `*` 会连真正不兼容的版本一起接受），只在 README 说明包管理器会在下个 rc 报未满足 peer。

### 两道闸门（用户拍板都做）

- **`isOccupiedDraft` 改为总读**：缺失或非数组的列表字段判为「占用」。下次改名的后果从表面崩溃降级为动作不可用，且绝不让 send 带走这条 guard 看不见的附件。这不是第 21.3 节禁止的兼容回退——不读任何旧字段名，也没有东西降级到「能用」。
- **`tests/client/contract.spec.ts`**：用 `expectTypeOf` 把手写的 `InputState`/`InputActions` 对已发布声明做可赋值性断言。本次事故能发出去，正是因为手写契约与假 Composer 同步移动、测试永远绿。**只在 typecheck 第二遍生效**；按相对路径深引 `lib/types/client/contract/input.js`，走 `./client` 入口会与本插件的窄 `ConversationLike` 增强撞 TS2717。

两道闸门都做过反向验证：去掉总读时新用例复现线上同一条 `TypeError`；把字段改回 `imageIds` 时 `pnpm typecheck` 报 TS2344。

### 一并修掉的取证失真（`/code-review` 报了 14 条）

`packaging.spec.ts` 的 `BROWSER_SEEDS` 原是 0.1.2 的表却被改标成 0.1.5，已从 0.1.5-rc.1 的 web shell 重新读出（多出 `@deepseek-ai/dsh-client-ui-dockkit`）；`docs.spec.ts` 的「验证基线」断言是「peer 下界」断言的子串、删掉整行也不会红，改为按表格行锚定且版本从清单读取；四处过期的版本背书更新。

### 验证

`pnpm typecheck` / `lint` / `test`（23 文件 486 用例）全绿，`pnpm peers check` 干净。**用户于 2026-09-11 在自己的实时 DSH（web profile，本地 tarball 安装）上确认验证通过**，快捷动作区域正常渲染，无错误边界。

### 已知边界

peer 下界的 semver 预发布语义是**刻意保留**的形状，不要改成 `*` 或试图「修好」。DSH 修好 primitives 的依赖声明之前，不要再把它提到 0.1.5-rc.1。

## Comments（评论）

### 2026-09-10 — 发布须暂缓

[票据 27](./27-publish-to-npm-and-list-in-market.md) 的发布在本票据修复前不得进行：`0.1.0` 一旦发出，在最新 DSH 上就是坏的，而 npm 版本号不可重发。名字冷却期本就要到本地 2026-09-11 00:45，时间上不冲突。

已提交的[市场 PR](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/4762) 不受影响：它只登记条目，不含版本号。

### 2026-09-10 — 待办 1–6 完成，code-review 追加了五处

`/code-review` 报了 14 条，逐条核验后全部处理：13 条直接修掉，剩下 1 条（peer 下界的 semver 语义）按用户定案保留形状、只改文档。原始待办之外新增的部分：

**改名不止一处。** 逐行 diff 两版 `contract/input.d.ts` 后确认 0.1.5-rc.1 是整套 image → attachment 词汇替换，不是「其余字段不变」：`claim.images` → `claim.attachments`（本插件声明了但不读）、`addImages`/`removeImage`/`pruneImages` → `addAttachments`/`removeAttachment`/`pruneAttachments`、`CommandClaim.submit` 第三参、`adjudicate` 信封的 `{images:number}`；`SubmitImageAttachment` 变成含 `{type:'file'}` 分支的联合 `SubmitAttachment`。`DraftAttachmentId` **没有**改名。完整清单进了 spec 第 21.1 节。

**开发树曾是 0.1.2/0.1.5 混装。** `dsh-settings@0.1.5-rc.1` 的 peer 锁 `^0.1.5-rc.1`，但 DSH 各包的 `latest` dist-tag 停在 `0.0.1-rc.1`，pnpm 自动安装的传递 peer 回落到旧线，`pnpm peers check` 报未满足。显式声明 devDependency 不收敛（被声明的包其自身的 peer 又落回旧线），最终用 `pnpm-workspace.yaml` 的 `overrides` 钉住 `dsh-invariants`/`dsh-scope`/`dsh-session` 才干净。`minimumReleaseAgeExclude` 同步补到 16 条。注意 pnpm 会缓存判断：只改 `pnpm-workspace.yaml` 时 `pnpm install` 打印「Already up to date」而不重新解析，需先删 `node_modules/.pnpm-workspace-state-v1.json`。

**`@deepseek-ai/dsh-client-ui-primitives` 提不上去。** `0.1.5-rc.1` 的 tarball 删空了 `dependencies`，`lib/index.js` 却仍 `import clsx` 并动态 import `@shikijs/langs/*`；升上去后 `pnpm test` 在 import 阶段炸。运行时不受影响（seed 表给的是构建期已求值的冻结命名空间），两版 `Button`/`Input`/`Pill` 的 `.d.ts` 逐字相同，故 devDependency 留在 `0.1.2-rc.1`，peer 仍声明 `>=0.1.5-rc.1`。记在 spec 第 21.5 节。

**peer 下界的 semver 语义。** 实测 `0.1.6-rc.1` 与 `0.2.0-rc.1` 都不满足 `>=0.1.5-rc.1`（预发布只匹配同三元组比较符），而 DSH 至今全是预发布。用户定案维持 `>=0.1.5-rc.1`，只改两份 README 的措辞：不再把「不设上界」说成安全，并说明包管理器会在下个 rc 报未满足 peer。spec 第 21.4 节。

**两项加固（用户拍板都做）：**

- `isOccupiedDraft` 改为总读，缺失/非数组的列表字段判为占用。下一次改名的后果从表面崩溃降级为动作不可用，且绝不让 send 带走看不见的附件。反向验证过：改回裸 `.length` 时新测试复现同一条 `TypeError: Cannot read properties of undefined (reading 'length')`。
- 新增 `tests/client/contract.spec.ts`，用 `expectTypeOf` 把手写的 `InputState`/`InputActions` 对已发布声明做可赋值性断言。反向验证过：把字段改回 `imageIds` 时 `pnpm typecheck` 报 TS2344。它按相对路径深引 `lib/types/client/contract/input.js`，因为走 `./client` 入口会把 Cordis `Context` 的完整 `conversation` 增强带进来，与本插件的窄 `ConversationLike` 增强撞 TS2717。

其余修正：`packaging.spec.ts` 的 `BROWSER_SEEDS` 从 0.1.5 的 web shell 重新取值（多出 `@deepseek-ai/dsh-client-ui-dockkit`，原表其实还是 0.1.2 的）；`docs.spec.ts` 的「验证基线」断言原本是「peer 下界」断言的子串、删掉整行也不会红，改为按表格行锚定并从清单取版本；`src/model/text.ts`、`tests/client/{composer,support}.ts`、`src/client/dsh.ts` 四处过期的版本背书更新（占位符正则在 0.1.5 未变，但其常量从 `machine.d.ts` 的 `PLACEHOLDER` 移到 `editor/projection.d.ts` 的 `ATOMIC_CHAR`）；假 Composer 的 `attachImage()` 改名 `attach()`。

`pnpm typecheck` / `lint` / `test`（23 文件 486 用例）全绿，`pnpm peers check` 干净。

**待办 7（真机复验）仍未做**，票据保持 `claimed`。
