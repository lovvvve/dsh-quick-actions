# 识别 DSH Composer（编辑器）受支持的扩展点

## 范围与来源依据

本报告基于实时 Cordis Inspect Provider 和打包随附的 DSH 实现检出目录回答该问题：

`/Users/lovvvve/Library/Application Support/io.github.hairyf.deepseek-harness-desktop/dependencies/dsh/`

该检出目录包含 DSH `0.1.2-rc.1` 的已部署 JavaScript 产物、包清单、bundle 补丁和第一方包参考资料（`package.json:14-16`；`node_modules/@deepseek-ai/dsh/package.json:1-4`）。未使用 Web 或二手来源。

实时 Inspect 发现（`cordis_inspect_list`）确认了客户端（Client）的 `Slots`、`Service`、`Event` 和 `Builtin` Provider 及其确切查询方法。委派会话后续的 Client 查询被运行时取消，因此未能提供完整的实时目录。父会话中一次成功的 `Slots.listSubTree` 查询独立验证了：`conversation.input.dock` 当前可用，是一个 `list`/`session` Slot，具有 `replaceRisk: "none"`、必需且唯一的 `id`、可选的 `order`/`label`、拥有者 `InputZone { session, input }`，以及标准 `useInput`/`inputActions` props；同一份实时精简树还验证了 `conversation.composer.dock` 是一个可用的 `list`/`session` Slot，由 `conversation.composer.bar` 声明，具有 `replaceRisk: "none"`、必需且唯一的 `id`、可选的 `order`/`label`、当前占用项 `stats`，以及标准 `useInput`/`inputActions`/`useSession`/`sessionId` props。其余确切契约均与随附 Client runner 中嵌入的生成式 Inspect 目录进行了交叉核对。该目录说明，它由与 Cordis 文档相同的 AST 遍历生成，并通过新鲜度门禁确保这些表示不可能发生分歧（`node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js:1100-1111`）。

本报告使用以下术语：

- **支持的公开扩展点**：供其他包使用的、已有文档说明的 package/profile、Slot、Service、Event 或 Cordis 生命周期契约。
- **内部实现细节**：在当前构建中可以触达或观察，但属于包私有、未出现在公开目录中，或被明确描述为内部内容。
- **缺失能力**：此检出版本中没有任何受支持的扩展点能够满足该要求。

## 核心结论

| 要求 | 结论 |
|---|---|
| 跨 DSH 重启/页面刷新持久存在 | **受支持。** 将一个由 Loader 支持的 **profile bundle** 安装到 `web` profile 中。它的补丁会为已构建的 `dsh.client` 包插入一个普通行。这与仅在进程内存在的动态 Cordis Package 不同。 |
| 在常规常驻 Composer 上方添加控件 | **受支持：** `conversation.input.dock`（`list`、`session`）。 |
| 在常规活动 Composer 卡片下方添加控件 | **受支持：** `conversation.composer.dock`（`list`、`session`）。 |
| 在工具行内添加紧凑控件 | **受支持的替代方案：** `conversation.input.left` 和 `conversation.input.right`。 |
| 自动清理注册项/监听器 | **受支持：** 通过 `ctx.slots.inject(...)`、`ctx.slots.register(...)`、`ctx.on(...)` 和 `ctx.effect(...)` 注册；它们都归 fiber 所有。 |
| 读取/更新当前草稿 | **部分受支持：** Slot 组件会收到 `useInput` 和稳定的 `inputActions`；`inputActions.setDraft(text)` 会替换**整个**草稿，并将光标移至末尾。 |
| 在当前选区插入静态文本 | **作为公开扩展点时缺失。** 实现中存在包私有的 `paste(text)` 和基于 span 的 `slash/input-insert-text` 路径，但二者都没有通过 `InputActions` 或公开 Client Event 目录暴露。`InputState` 不包含选区。 |
| 通过 Composer 路径提交当前草稿 | **受支持：** 调用 Slot prop `inputActions.submit()`。随附的主发送按钮调用的就是同一个函数。它会进入输入状态机、命令裁决、乐观提交和默认 `sendSession` sink。 |
| 出现在字面意义上的每一个 Composer 周围，包括无 session 和 takeover Composer | **缺失一个通用的可叠加 Slot。** 两个 dock 都属于常驻 fallback Composer。chain takeover 会隐藏该 fallback；下方卡片 dock 在 hero 模式中也不存在，而且没有 Session 时，这两个 session 作用域的 dock 都不存在。 |

因此，实际结论是：持久化 quick-actions 包可以安全地在每个**常规、由 session 支持的常驻 Composer**上方或下方渲染按钮，也可以正式提交当前草稿；但它无法通过官方方式在实时选区插入文本，也无法在没有新增上游扩展点的情况下，保证自身出现在 replacement/takeover Composer 周围。

---

## 1. 受支持的持久化包机制

### 1.1 持久化单元是 web-profile bundle，而不是动态 Cordis Package

受支持的 launcher 将 profile 描述为由 bundle 补丁层组成的有序栈。一个 profile 目录包含：

- 带有 `dsh.profile.bundles` 和 `patchReload` 的 `package.json`；以及
- 作为用户较后补丁层的 `cordis.patch.yml`。

Bundle 补丁按 bundle 顺序应用，随后应用 profile 和 home 补丁，最后应用 `--patch` overlay（`node_modules/@deepseek-ai/dsh/README.md:33-47`；可执行的组合顺序见 `node_modules/@deepseek-ai/dsh/lib/profile-boot-BTzzdrGY.js:166-210`）。

确切的 bundle 清单声明如下：

```json
{
  "dsh": {
    "bundle": {
      "patch": "./cordis.patch.yml"
    }
  }
}
```

`loadProfile()` 会精确读取 `package.json.dsh.bundle.patch`；若该字段不存在则失败；随后将其与包目录拼接，并解析该补丁（`node_modules/@deepseek-ai/dsh-app-boot/lib/index.js:834-879`）。profile 模块文档也逐字陈述了这一包级契约（`node_modules/@deepseek-ai/dsh-app-boot/lib/index.js:286-309`）。随附 bundle 使用的正是这个字段，例如 `@deepseek-ai/dsh-web-app`（`node_modules/@deepseek-ai/dsh-web-app/package.json:25-40`）和 `@deepseek-ai/dsh-base`（`node_modules/@deepseek-ai/dsh-base/package.json:21-35`）。

Bundle 补丁是一个顶层列表。添加浏览器包 Loader 行的常规方式是使用如下 insert：

```yaml
- insert:
    - id: composer-quick-actions
      name: '@scope/dsh-composer-quick-actions-client'
```

这遵循了随附 web bundle 的浏览器名册结构，即一个包含普通 `{ id, name, ... }` 行的 `insert`（`node_modules/@deepseek-ai/dsh-web-app/cordis.patch.yml:39-43,151-175,207-214`）。Loader 条目选项的公开文档列出了 `id`、`name`、`config`、`group`、`disabled` 和 `inject`（`node_modules/@deepseek-ai/cordis-plugin-loader/README.md:25-35`）。

`dsh plugin --profile web add <package>` 是受支持的安装路径。它会在 profile 目录中转交给 pnpm，然后把已安装依赖中声明了 `dsh.bundle` 的依赖追加到 `dsh.profile.bundles`；不含 bundle 的依赖仍只是普通依赖，不会作为层被激活（`node_modules/@deepseek-ai/dsh/lib/plugin-F7ZVfRyo.js:7-16,20-33,35-77,96-127`）。因此：

- 仅安装一个**纯客户端**包作为依赖，并不足以持久挂载它；
- 要么由一个 bundle 包插入该 Client 行，要么由用户的持久化 profile 补丁手动插入；
- 规范的可安装包机制就是上面的 bundle 声明。

web profile 是一个 Host 平面组合。随附补丁明确将其 `dsh.client` 行称为“浏览器名册”（`node_modules/@deepseek-ai/dsh-web-app/cordis.patch.yml:39-42,151-156`），并单独将只有 agent/tool 平面移到各 session 的 preset 后面（`same file:308-313,433-439`）。Client 模块扫描器监听 Host Loader 的 `internal/plugin` 事件，并扫描 `ctx.loader.entries()`（`node_modules/@deepseek-ai/dsh-client-modules/lib/index.js:434-479`）。因此，agent preset 并不是全局浏览器 Composer 扩展的正确归属位置。

### 1.2 持久化 Client 包的确切声明

浏览器包需要声明 `dsh.client`、导出 `./client`，并随包提供已经构建好的浏览器产物。包参考资料将其陈述为编写契约（`node_modules/@deepseek-ai/dsh-client-modules/README.md:25-44`）。可执行解析器接受以下确切结构：

```ts
interface DshClientDeclaration {
  platform: string                 // only "web" is selected here
  inject?: string[]                // package/row prerequisites
  external?: string[]              // non-baseline runtime module requests
  immediately?: boolean
}
```

解析器会拒绝非对象声明、缺失或并非字符串的 `platform`、非字符串数组，或非布尔值的 `immediately`（`node_modules/@deepseek-ai/dsh-client-modules/lib/index.js:139-154`）。它接受字符串形式的 `exports["./client"]`，也接受带有字符串 `default` 的对象形式（`same file:155-165`）。扫描期间，只有 `platform === "web"` 会保留下来；缺少 `./client` 属于硬错误，而解析后的产物路径和清单字段会成为 boot graph 行（`same file:618-647`）。

一个有代表性的随附 UI 包包含：

- 面向其 Loader 行的 root/default export；
- 指向 `lib/client.js` 的 `./client` export；
- 包含必须先于它加载之包名的 `dsh.client.inject`；
- `platform: "web"`；
- 已构建的 `lib/index.js` 和 `lib/client.js` 文件。

参见 `node_modules/@deepseek-ai/dsh-client-ui-plan/package.json:13-37,57-65`。它的 Node/root 部分有意只提供空的 `apply()`，目的仅在于让该包能够作为 Host Loader 行存在，而其浏览器行为则来自 `exports["./client"]`（`node_modules/@deepseek-ai/dsh-client-ui-plan/lib/index.js:1-12`）。这正是纯浏览器功能的先例。

重要区别：清单级 `dsh.client.inject` 包含浏览器 boot graph 使用的**包名**。运行时 Cordis injection 则是 Client 模块所导出的 **Service key** 数组。例如，`ui-plan` 在其清单中包含包前置依赖（`package.json:28-36`），但导出的运行时 Service key 是 `slots`、`remote`、`remote.commands` 和 `locale`（`lib/client.js:103-135`）。Composer quick-actions Client 包至少应在清单层面将自己排在 `@deepseek-ai/dsh-client-ui-conversation` 之后，并在运行时注入 `slots`。

已构建的 Client 产物使用 DSH 的 lazy-CJS 注册 wrapper：

```js
window.__ModuleLoader__.load({
  id: "@scope/package",
  factory: (require) => { /* exports.apply / exports.inject */ }
})
```

一个随附产物的开头正是这种形式（`node_modules/@deepseek-ai/dsh-client-ui-plan/lib/client.js:1-4`），并在结尾导出 `apply`/`inject`（`same file:103-136`）。Client 模块系统说明，执行 bundle 会注册一个惰性 factory，而第一次具体化会运行其函数体（`node_modules/@deepseek-ai/dsh-client-modules/lib/index.js:7-37`）。

它能够跨常规页面加载持久存在，因为每一个已启用且声明 `dsh.client` 的 Loader 行都会被扫描进 `window.__DSH_BOOT__`，并通过 `/plugins` 提供（`node_modules/@deepseek-ai/dsh-client-modules/README.md:10-12,28-44`）。动态 Client Package 则与此不同，对后者而言，“刷新后不会恢复任何内容”（`node_modules/@deepseek-ai/dsh-cordis-client-runner/README.md:10-12,38-40`）。

加载时边界：profile 清单和 bundle 列表在进程启动期间完成组合。在 `patchReload: "live"` 模式下，运行中的 launcher 只监视 profile 和 home 的 `cordis.patch.yml` 文件（`node_modules/@deepseek-ai/dsh/lib/profile-boot-BTzzdrGY.js:233-261,271-288`），而不会监视 `package.json.dsh.profile.bundles`。因此，安装新 bundle 会使其在下一次 DSH 启动时保持存在；这并不能证明当前已经运行的进程已挂载它。开发期间，Client HMR 还需要一个外部构建 watcher 来重写 `lib/client.js`，之后现有页面才能替换该模块（`node_modules/@deepseek-ai/dsh-client-hmr/README.md:24-36`）。

### 1.3 不得隐瞒的打包限制

该机制本身受支持，但检出目录记录了树外浏览器插件的一个工具缺口：能够产出所需 lazy-CJS 产物的 `clientBundle` tsdown preset 位于 DSH monorepo 内，且**没有发布**，因此外部插件必须复现该构建流程（`node_modules/@deepseek-ai/dsh-client-ui-settings-plugins/README.md:88-97`）。当 `lib/client.js` 缺失时，模块系统也会明确地让激活失败（`node_modules/@deepseek-ai/dsh-client-modules/README.md:42-44`；实现诊断见 `lib/index.js:90-119`）。

源码会独立解析 `dsh.bundle` 和 `dsh.client`，因此不会拒绝同时包含二者的清单。不过，随附示例建立了一种更清晰的双角色模式：bundle 携带补丁，被插入的 UI 包携带 Client 行。此检出版本中没有源码明确承诺单包自插入布局，因此在未经测试的情况下，不应将它描述为规范契约。

---

## 2. 受支持的 Composer Slot 确切情况

随附 Client runner 嵌入了生成的 Slot 契约账本。它包含种类、作用域、拥有者 props、标准 props、注册选项、声明方拥有者、当前占用项、替换风险和原始源码位置（`node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js:2133-2145`）。

### 2.1 上方：`conversation.input.dock`

确切契约：

- 键：`conversation.input.dock`
- 种类：`list`
- 作用域：`session`
- 用途：“Composer 卡片上方的全宽条目。”
- 注册：必需且唯一的 `id`；可选的升序 `order`（默认值为 `0`），以及可选的 `label`
- 拥有者 props：

```ts
interface InputZone {
  readonly session: SessionSnapshot
  readonly input: InputState
}
```

- 标准 props 包括 `useInput: SnapshotSelectorHook<InputState>`、`inputActions: InputActions`、`useSession`、`sessionId`、`useProjection`，以及其他标准 Session/Workspace hook。

这些内容全部记录在 `node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js:2672-2724`（目录记录的原始来源为 `packages/client/ui-conversation/src/client/contract/slots.ts:127`）。它是可叠加的（`replaceRisk: "none"`）；随附占用项包括 Queue、Todo 和 Goal dock（`same range:2716-2723`）。

拥有者确实会在常驻 Composer bar 之前紧邻渲染该 Slot：

```tsx
zone !== undefined && renderSlot("conversation.input.dock", zone)
inputBar
```

参见 `node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js:14401-14404,14437-14461`。对于常规、由 session 支持的 Composer，这是在其**上方**放置全宽 quick-action 行的最佳受支持位置。

边界：只有 Session snapshot 和 Input state 同时存在时，`zone` 才存在。因此，该 Slot 不会在无 Session 的惰性状态下渲染（`same file:14401-14404,14436-14460`）。

### 2.2 下方：`conversation.composer.dock`

确切契约：

- 键：`conversation.composer.dock`
- 种类：`list`
- 作用域：`session`
- 用途：“Composer 卡片下方的环境条目。”
- 注册：必需且唯一的 `id`；可选的 `order` 和 `label`
- 没有拥有者专用 props
- 标准 props 包括 `useInput`、`inputActions`、`useSession`、`sessionId`、`useProjection`，以及标准 Session/Workspace hook。

参见 `node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js:2463-2511`（目录来源为 `packages/client/ui-conversation/src/client/contract/slots.ts:131`）。`ui-chat` 提供了一个具体且受支持的先例：通过 `ctx.slots.inject(... register(...))` 注册其 `stats` 行（`node_modules/@deepseek-ai/dsh-client-ui-chat/lib/client.js:8147-8152`）。

InputBar 会在 Composer 卡片之后渲染该 Slot，但仅限于 Session 和 Input 均存在的活动 `composer` variant：

```tsx
variant === "composer" && input !== undefined && sessionId !== undefined
  ? renderSlot("conversation.composer.dock", {})
  : null
```

参见 `node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js:15713-15718`。因此，它**不会**渲染在居中的 hero variant 下方。

### 2.3 行内替代方案

如果并不要求必须位于“上方/下方”，并且控件应放在 Composer 工具栏内部：

- `conversation.input.left`：`list`、`session`，“Composer 工具行左侧的紧凑控件”；必需的 `id`，可选的 `order`/`label`（`node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js:2727-2775`）。
- `conversation.input.right`：`list`、`session`，“Composer 提交操作之前的紧凑控件”；列表选项相同（`same file:2893-2941`）。

InputBar 会把这些 Slot 准确放置在上述位置（`node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js:15612-15643`）。

### 2.4 看似相关、但不是可叠加 quick-action 扩展点的 Slot

#### `conversation.composer.bar`

它是 `single`、`session-maybe`，且已由随附的 `InputBar` 占用。注册另一个条目会遮蔽随附 Composer（`replaceRisk: "shadows-shipped-ui"`）（`node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js:2433-2460`）。其拥有者 prop 包含 `accessory?: ReactNode`，文档将其描述为 surface 上方的内容（`same file:2439`），但它是提供给唯一 bar 占用项的输入，**并非**一个可叠加的 accessory Slot。第三方注册方无法在现有 InputBar 上设置 `accessory`；它必须替换整个 bar 并重新实现 Composer。这不是一种受支持的 quick-actions 方案。

#### `conversation.composer`

这是 selector 路由的临时 Session 交互**替代项**所组成的 `chain`，而不是可叠加区域（`node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js:2388-2430`；公开使用限制见 `node_modules/@deepseek-ai/dsh-client-ui-conversation/README.md:51-97`）。shell 使用 `overlay: true` 调用它，并以常驻 bar 作为 fallback（`node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js:14463-14472`）。当一个 chain 条目胜出时，renderer 会保持 fallback 已挂载，但将其 wrapper 设置为 `display: none`（`node_modules/@deepseek-ai/dsh-client-ui-renderer/lib/client.js:871-878`）。因此，在 approval/question/subagent takeover Composer 期间，两个常驻 dock 在视觉上都会被隐藏。

### 2.5 并未完全支持“每一个 Composer”

`conversation.composer` chain 外部没有一个可叠加 Slot 能够同时包裹其 fallback 和当选 replacement。因此：

- 常规、由 session 支持的常驻 Composer 上方：可以（`conversation.input.dock`）；
- 活动的常规常驻 Composer 下方：可以（`conversation.composer.dock`）；
- 无 Session 的惰性 Composer：两个 session 作用域的 dock 都不存在；
- 居中的 hero：存在 Session/Input 时，上方 dock 可以渲染；下方 dock 不会渲染；
- 当选的 takeover Composer：常驻 fallback 及其 dock 都会被隐藏。

如果要求在字面意义上的“每一种 Composer 实现上方/下方”显示，就需要在 chain/seat 外围新增一个 Slot。此版本缺少该能力。

---

## 3. 生命周期安全的注册与清理

### 3.1 Slot 生命周期

受支持的注册模式是：

```ts
ctx.slots.inject("conversation.input.dock", () =>
  ctx.slots.register(
    { name: "conversation.input.dock", id: "my-unique-id", order: 100 },
    QuickActions,
  ),
)
```

`SlotsService.inject` 的确切公开签名是：

```ts
inject(
  key: keyof SlotMap & string,
  callback: () => SlotInjectionEffect,
): () => void
```

其契约说明：callback 会在每段声明生命周期内运行；声明折叠会 dispose 它；重新声明会使其再次运行；可迭代 effect 以事务方式安装并按逆序 dispose；controller 归调用方 fiber 所有，因此卸载会取消尚在等待的过程并移除活动贡献（`node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js:1317-1336`）。实现通过嵌套 `ctx.effect` 调用以及幂等 stop/reconcile 逻辑，确实完成了这些行为（`node_modules/@deepseek-ai/dsh-client-ui-renderer/lib/client.js:1000-1074`）。

`slots.register` 本身会通过**调用方** context 路由，并实现为：

```js
return this.ctx.effect(
  () => this._register(options, component),
  "slots.register()",
)
```

参见 `node_modules/@deepseek-ai/dsh-client-ui-renderer/lib/client.js:1250-1271,1388-1391`。因此，等待过程和注册项都归 fiber 所有；没有必要显式执行全局 DOM 挂载，而且这样做反而会削弱清理保障。

### 3.2 通用 Cordis 生命周期

Cordis 文档说明，effect、事件监听器和 service 会随其所属 fiber 一起移除（`node_modules/@deepseek-ai/cordis/README.md:61-67`）。更准确地说：

- `ctx.on(name, listener, options?)` 将监听器注册为 fiber effect，并在卸载时自动移除（`node_modules/@deepseek-ai/cordis/lib/index.js:327-379`）。
- `ctx.effect(execute, label?)` 收集 callback/iterable/async effect disposer，并按逆序执行已收集的清理操作（`same file:1124-1168,1168-1184`）。
- `ctx.provide(name, value, check?)` 也是 fiber effect；dispose 会注销 service 并刷新依赖方（`same file:789-823`）。

组件本地的浏览器监听器/定时器也应安装在 `React.useEffect` 中并返回清理函数，或包装在 `ctx.effect` 中。直接修改 Composer DOM 既不符合生命周期安全，也不符合 API 安全要求。

---

## 4. 草稿与选区：受支持接口与内部实现的对比

### 4.1 `inputActions` 是标准 Slot prop，而不是 Cordis Service

`ui-conversation` 通过 `ctx.uiSession.provide()` 提供 `input` 作为 hook source，并提供 `inputActions` 作为稳定的普通 prop（`node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js:16039-16056`）。renderer 会将这些已提供的 source 具体化为标准组件 prop 和 selector hook（`node_modules/@deepseek-ai/dsh-client-ui-renderer/lib/client.js:537-573,588-626`）。这就是两个 dock Slot 契约都包含 `useInput` 和 `inputActions` 的原因。

生成的 Slot 账本将编译时类型命名为 `InputActions`（`node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js:2490-2502,2699-2711`）。在此打包检出版本中，其被擦除后的确切运行时接口形态为：

```js
actions = {
  setDraft: (text) => { this.setDraft(text) },
  addImages: (ids) => this.addImages(ids),
  removeImage: (id) => { this.removeImage(id) },
  pruneImages: (ids) => { this.pruneImages(ids) },
  submit: () => { this.submit("queue") },
}
```

参见 `node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js:11483-11510`。可执行代码及其调用方证明，`text` 是草稿字符串，`id`/`ids` 是草稿附件标识；这个已部署包并未实际包含所宣传的声明文件，因此本报告不会凭空添加已被擦除的 readonly 修饰符。

公开的 Input snapshot 由以下内容组成：

```ts
{
  draft,
  imageIds,
  draftRev,
  phase,
  claim?,
  occurrences,
  queue,
}
```

其中**没有选区或光标位置**（`node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js:12235-12245`）。

### 4.2 `setDraft` 的实际行为

`setDraft(text)` 会替换整个文档。它会移除保留的引用占位符、清空 Lexical root、根据以换行符分隔的文本创建段落，并调用 `root.selectEnd()`（`node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js:11621-11643`）。它适合恢复或替换草稿，但不会保留或针对当前选区。

因此，通过 `useInput(s => s.draft)` 计算新字符串再调用 `setDraft(newString)` 并不感知选区。它还会破坏编辑器中存在、但在剪贴板投影中已被扁平化的富引用 chip 标识。

### 4.3 感知选区的实现确实存在，但属于私有内容

内部 shell 恰好拥有所请求功能需要的行为：

```js
paste(text) {
  // sanitize
  const selection = $getSelection()
  if ($isRangeSelection(selection)) selection.insertText(clean)
  else root.selectEnd().insertText(clean)
}
```

参见 `node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js:11686-11705`。它还会通过 `caretSpan()` 将实时选区计算为有序的 detect-coordinate span（`same file:11785-11798`）。但是，这两个方法都没有出现在公开的 `actions` 对象中（`same file:11495-11510`）。实现明确将更宽泛的 keyboard 接口称为“包内部”接口，并说明它会交给 Composer-bar 条目，“绝不会跨越插件边界”（`same file:12342-12350`）。

contenteditable 本身也是私有装配的一部分：`ComposerContentEditable` 将 shell 所有的 Lexical editor 绑定到常驻 `div[data-composer-input]`（`same file:14646-14681`），而 `InputBar` 只通过其私有 `keyboard` injection 接收该 editor（`same file:15305-15331,16193-16213`）。因此，DOM selection、`data-composer-input` 和 Lexical 内部机制都是实现细节，而不是扩展契约。

### 4.4 有作用域的 `slash/input-insert-text` 事件属于内部内容，并非公开的变通方案

input-trigger 包会派发一个 bail event：

```js
actx.bail(actx, "slash/input-insert-text", {
  text: outcome.text,
  span,
  ...(outcome.continue === true ? { continue: true } : {}),
})
```

（`node_modules/@deepseek-ai/dsh-client-ui-input-trigger/lib/client.js:603-619`）。`ui-conversation` 在 Session shell effect 内安装有作用域的 listener（`node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js:12311-12326`）。只有当 `span.draftRev` 仍等于 editor revision 时，其 receiver 才接受文本，然后映射并替换该确切 span（`same file:11875-11895`）。

基于三个相互独立的原因，这不是受支持的通用按钮 API：

1. 它没有出现在 Inspect 可见的生成式 Client Event 目录中。该目录只包含 `connection/reset`、`locale/change`、`slots/changed` 和 `theme/change`（`node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js:1551-1594`）。
2. dock 组件会收到 `draftRev`，但不会收到实时选区 span（`InputState` 结构见 `ui-conversation/lib/client.js:12235-12245`）。
3. 该事件属于 `ui-input-trigger` 与 `ui-conversation` 之间的私有协作流程；input-trigger 包自身的参考资料说明，它不会发出公开 Cordis event（`node_modules/@deepseek-ai/dsh-client-ui-input-trigger/README.md:80-90`）。

`ctx.inputTriggers.registerSource(src)` *确实是*一个受支持的特定功能扩展点，供希望加入 `/` 或 `@` 候选项 pipeline 的业务包使用：包参考资料明确说明“任何业务包”都可以注册 source，且被选中的文本 outcome 会由消费方 input 包应用（`node_modules/@deepseek-ai/dsh-client-ui-input-trigger/README.md:10-12,25-32`）。确切的注册方法会返回 disposer（`node_modules/@deepseek-ai/dsh-client-ui-input-trigger/lib/client.js:753-796`）。这并不能解决任意 quick-action 按钮的问题，因为只有 input pipeline 拥有传递给文本 outcome 的新鲜选区/span。

### 4.5 缺失的 API

`InputActions` 或公开 Client Service/Event 上不存在与以下任一操作等价的受支持接口：

```ts
insertTextAtSelection(text: string): void
replaceSelection(text: string): void
getSelection(): ComposerSelection
```

最安全的上游新增项应该是一个 action（例如 `inputActions.insertText(text)`），将操作委托给现有 shell 的 `paste(text)` 实现。与暴露原始 span 状态相比，action 更为可取，因为现有 span 路径专门使用 revision CAS 来避免陈旧编辑。这是一个提议的扩展点，并不存在于所检查的检出版本中。

---

## 5. 官方提交路径

### 5.1 受支持的调用

dock/toolbar Slot 组件应调用其标准 prop：

```ts
inputActions.submit()
```

这不只是与 Composer 按钮相似：随附的主按钮会在完成其 UI guard 后调用这个确切函数（`node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js:15510-15521`）。该 action 会委托给 `SessionInputShell.submit("queue")`（`same file:11495-11510`）。

随后，shell 会：

1. 处理只有图片的输入；
2. 验证已认领的命令和图片支持情况；
3. 使用当前投影后的草稿派发输入状态机的 `enter` 事件；
4. 在适用时运行 trigger/command 裁决；
5. 提交成功/默认发送，并调用默认 sink。

参见 `node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js:11707-11753,12170-12229`。默认 sink 被明确描述为“乐观清空 + prompt”，并委托给 `conversation.sendSession(...)`（`same file:12362-12371`）。`sendSession` 会创建本地 submission echo、让出一次 paint、序列化内容，并调用 Session Controller 的 `session.prompt(...)`（`same file:1933-1974`）。包参考资料概述了同一个官方流程，以及它的 queue/steer 放置方式和失败恢复行为（`node_modules/@deepseek-ai/dsh-client-ui-conversation/README.md:45-49`）。

自定义控件应使用 `useInput`/`useSession` 应用与主按钮相同的可见 guard（草稿/附件非空、未 disabled/blocked/removed，且不处于 `adjudicating`/`submitting`），而不应假设 `submit()` 会报告结果；`submit()` 返回 `void`。

### 5.2 公开提交 action 的确切限制

`inputActions.submit()` 是主要的**指针发送**路径，并且始终请求交付模式 `"queue"`。keyboard 路径则调用私有的 `keyboard.submit(resolveSubmitMode(...))`，从而支持配置的 busy-Enter Queue/Steer 策略（`node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js:15467-15495`）。因此，`inputActions.submit()` 是官方路径，与点击“发送”完全相同，但它不是一种公开且参数化的“使用当前键盘手势策略提交”API。

### 5.3 不应调用的内容

`ConversationController.send(text)` 存在于实现中，并直接调用有作用域 Session 的 `prompt(..., "queue")`（`node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js:1883-1918`）。调用它会绕过草稿变更、命令裁决、乐观草稿提交/恢复、当前附件以及公开 Slot action 接口。它不是所要求的“与 Composer 相同的路径”。同样，直接调用 Host Remote 也会绕过 Client 输入状态机。

组合调用 `inputActions.setDraft(staticText)` 和 `inputActions.submit()` 虽然会使用官方提交路径，但会先替换用户的整个草稿，并把光标移到末尾。它不满足“在当前选区插入”的要求。不存在公开且原子的“插入后提交”操作。

---

## 6. 与此功能相关的 Client Service、Event 和 Builtin

### 6.1 Inspect 可见及特定功能的 Client Service

此检出版本中生成的、**Inspect 可见**的 Client Service 目录包含以下 Service key，且不包含 Composer 编辑 Service：

- `layout`
- `locale`
- `sessions`
- `slots`
- `theme`
- `timer`
- `uiWorkspace`
- `workspaces`

字面目录始于 `node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js:1113`；这些 key 分别出现在 `1116`、`1138`、`1234`、`1317`、`1339`、`1389`、`1426` 和 `1488`，目录结束于 `1550`。

相关的确切契约是：

- `slots.register`：SlotCore 注册 overload，由调用方 fiber effect 包装（`node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js:1317-1324`；实现见 `node_modules/@deepseek-ai/dsh-client-ui-renderer/lib/client.js:1388-1391`）。
- `slots.inject(key, callback): () => void`：具有声明生命周期和卸载清理行为（`node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js:1325-1336`）。
- 当一个特定功能且有作用域的 Service 确实需要它们时，可使用 `sessions.scope(id: SessionId): AgentContext | undefined` 和 `sessions.binding(id: SessionId): SessionBinding | undefined`（`node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js:1297-1313`）。

对于已编译的持久化包，这个 dynamic/Inspect 目录并不代表全部已发布包接口。另有两个特定功能 Service 明确提供给其他包使用，但都无法填补按钮插入能力的缺失扩展点：

- `ctx.uiConversation` 为 Conversation target 包管理 event/view registry 和 `binding(bindingOrSessionId)`（`node_modules/@deepseek-ai/dsh-client-ui-conversation/README.md:25-34`；实现方法见 `lib/client.js:1629-1746`）。它不暴露 Composer 草稿变更。
- `ctx.inputTriggers.registerSource(src): () => void` 接纳由业务方拥有的 `/` 或 `@` source（`node_modules/@deepseek-ai/dsh-client-ui-input-trigger/README.md:10-12`；实现见 `lib/client.js:753-796`）。它的 controller 只有在自身 trigger/menu 流程捕获到新鲜 span 后才会应用文本。

实现还提供有作用域的 `ctx.conversation`，其中包括直接 `send(text)`、queue 和 cancel 操作（`node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js:1883-2101`），但这不是标准 Composer action 接口，而且直接 `send(text)` 会绕过这里所需的输入状态机行为。`inputActions` 被有意作为 Slot 标准 prop 传递，而不是从 `ctx` 查找。

所检查源码中没有任何已有文档说明的 Service 暴露当前选区插入能力。

### 6.2 Inspect 可见的 Client Event

Inspect 可见的确切 Client Event 目录：

```ts
"connection/reset"(): void
"locale/change"(snapshot: LocaleSnapshot): void
"slots/changed"(key: string): void
"theme/change"(snapshot: ThemeSnapshot): void
```

参见 `node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js:1551-1594`。其中没有任何 Event 携带草稿文本、选区、插入命令或提交请求。`slots/changed` 仅用于观察；`ctx.slots.inject` 已经提供该包所需的声明生命周期行为。所检查的第一方包参考资料均未记录单独的公开 Composer 变更 Event；唯一找到的文本插入派发是上文所述的私有 `slash/input-insert-text` 协作流程。

在 Cordis 层面，`ctx.on(...)` 受支持且会随 fiber 自动清理（`node_modules/@deepseek-ai/cordis/lib/index.js:360-379`），但自行虚构或派发目录中没有的 Composer event 并不是受支持的 DSH 扩展点。

### 6.3 必须将“Builtin”拆分为三个不同概念

#### A. 普通 Cordis 生命周期/context API——受持久化插件支持

持久化 Client 包是一个普通的已编译 Cordis plugin。它导出 `apply` 和可选的 `inject`，导入其构建时依赖，并使用普通 Cordis API，例如 `ctx.get`、`ctx.on`、`ctx.effect`、`ctx.provide` 和 `ctx.plugin`。Cordis 自身定义 plugin/fiber 生命周期和自动清理行为（`node_modules/@deepseek-ai/cordis/README.md:18-67`；effect 实现见 `node_modules/@deepseek-ai/cordis/lib/index.js:1124-1278`）。

#### B. Loader builtin——受支持的组合机制，而不是 Composer API

DSH boot 只注册两个 Loader builtin：

- `cordis:include`
- `cordis:group`

`mountRootInclude` 会安装它们，并使用 profile config 路径和补丁挂载 root `cordis:include`（`node_modules/@deepseek-ai/dsh-app-boot/lib/index.js:1277-1315`）。第一方 boot 参考资料将其称为“两个 Loader builtin”，并说明 group 会创建一个共享 isolate realm（`node_modules/@deepseek-ai/dsh-app-boot/README.md:81-86`）。简单的 quick-actions bundle 只需要一个普通的插入行，不需要这两个 builtin 中的任何一个。

#### C. 动态 Client Builtin 目录——**并非**持久化包契约

嵌入式 Inspect Provider 只向**动态** Client half 暴露以下闭包符号：

```ts
ctx.get / ctx.on / ctx.provide / ctx.effect
React.createElement / React.useState / React.useEffect
host.call(method, args?)
styles.insert(css)
console.log / console.error
```

参见 `node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js:4077-4112`。其所属 README 明确将这些符号限定为不使用 import 的纯 JavaScript 动态包（`node_modules/@deepseek-ai/dsh-cordis-client-runner/README.md:25-32`）。因此，绝不能将 `host.call` 和 `styles.insert` 宣传为持久化包的 builtin。

持久化浏览器包使用的是已构建的 Client module graph。公开模块系统契约说明，shell 会植入由 React、Cordis 和静态 UI 库组成的冻结 baseline；非 baseline 运行时 import 必须列在 `dsh.client.external` 中（`node_modules/@deepseek-ai/dsh-client-modules/README.md:38-44`）。普通浏览器全局对象可能存在于该编译运行时中，因为随附实现本身会使用 `document`、`window` 和 `localStorage`；但通过 DOM 访问 `div[data-composer-input]`、合成 paste 或触达 Lexical 内部机制，都不是受支持的 Composer 扩展点，并且很容易随构建变化而失效。

---

## 7. quick-actions 包的建议受支持范围

在不修改上游的情况下，持久化包可以安全地执行以下操作：

1. 提供/安装一个 web-profile bundle，其补丁会插入已构建的 `dsh.client` 行。
2. 如果没有 Host 行为，则导出无操作的 Host/root `apply()`。
3. 在 Client `apply(ctx)` 中注入 `slots`，并通过 `ctx.slots.inject(...)` 在以下任一位置注册唯一的 list-cell id：
   - `conversation.input.dock`，用于常规 Composer 上方的全宽行；或
   - `conversation.composer.dock`，用于活动的常规 Composer 下方的一行。
4. 将控件渲染为普通 React Slot 组件。
5. 使用 `useInput`/`useSession` 读取当前状态。
6. 使用 `inputActions.submit()` 提交当前草稿。
7. 将每一个非 React side effect 放在 `ctx.effect`/`ctx.on` 之下；其余清理由 Slot 注册机制和 React unmount 完成。

通过此检出版本中受支持的扩展点，它无法：

- 在当前选区拼接静态文本；
- 自行重建文本时保留富编辑器/chip 标识；
- 使用公开 mode 参数请求私有 Queue/Steer keyboard 提交策略；
- 在无 session、hero、resident 以及每一个当选 takeover Composer 周围渲染同一个可叠加行。

这些是真实的 API 缺口，不能据此就触达 `[data-composer-input]`、派发合成浏览器事件、调用 `conversation.input.for(...)`，或使用伪造坐标发出 `slash/input-insert-text`。

## 来源索引（价值最高的范围）

- 持久化 profile/bundle：`node_modules/@deepseek-ai/dsh/README.md:33-47`；`node_modules/@deepseek-ai/dsh-app-boot/lib/index.js:286-309,834-894`；`node_modules/@deepseek-ai/dsh/lib/plugin-F7ZVfRyo.js:7-77,96-127`。
- Client 包发现：`node_modules/@deepseek-ai/dsh-client-modules/README.md:25-44`；`node_modules/@deepseek-ai/dsh-client-modules/lib/index.js:139-165,434-479,618-647`。
- 有代表性的纯 Client 包：`node_modules/@deepseek-ai/dsh-client-ui-plan/package.json:13-37,57-65`；`lib/index.js:1-12`；`lib/client.js:1-4,103-136`。
- 上方/下方 Slot 契约：`node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js:2463-2511,2672-2724`。
- Slot 实际位置：`node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js:14401-14472,15713-15718`。
- Slot 清理：`node_modules/@deepseek-ai/dsh-client-ui-renderer/lib/client.js:1000-1074,1250-1271,1388-1391`。
- Input 公开 action/state：`node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js:11483-11510,11621-11643,12235-12245,16039-16056`。
- 私有选区路径：`same file:11686-11705,11785-11798,11875-11895,12311-12350,14646-14681`。
- 提交路径：`same file:11707-11753,12170-12229,12362-12371,15510-15521,1933-1974`。
- 公开 Client Service/Event/Builtin 目录：`node_modules/@deepseek-ai/dsh-cordis-client-runner/lib/client.js:1113-1594,4077-4112`。
