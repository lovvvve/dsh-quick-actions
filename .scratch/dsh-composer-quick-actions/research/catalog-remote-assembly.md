# 自有 Catalog Remote 的装配契约核实

本文件回答 [spec 第 15 节](../spec.md)与[票据 13](../issues/13-implement-host-settings-and-catalog-remote.md)的硬性要求：**在关键装配契约核实前不得声称 Remote 已可用**。

## 结论（先看这条）

**已发布的 DSH 工具链无法为 DSH 单仓之外的软件包生成 strict Remote 产物**，因此 spec 第 6.2 节描述的「生成式 `remote.composerQuickActions`」在当前条件下不可交付。

存在一条**未被生成器阻断的运行时替代路径**（手写 descriptor 经公共 `ctx.typert.register` / `ctx.remote.$mount` 注册），它满足 spec 第 6.2 节的产品契约但不满足票据 13 的「生成式」措辞。是否采用属于范围决策，未擅自实施。

## 核实环境

- 运行中的 DSH：`0.1.2-rc.1`（`@deepseek-ai/dsh-*` 全家桶）。
- 实机 web profile 组合（`~/.dsh/profiles/web`，bundles 见 `package.json#dsh.profile.bundles`）。
- spike 工作区：本仓库的隔离副本，`pnpm` 安装 `@deepseek-ai/dsh-typert-generator@0.1.2-rc.1`、`dsh-typert-protocol@0.1.2-rc.1`、`dsh-settings@0.1.2-rc.1`。

## 已确认可用的部分

`@deepseek-ai/dsh-base` 的组合已挂载全部前置服务，第三方 Host 包无需额外组合改动：

| 组合条目 | 提供 |
|---|---|
| `@deepseek-ai/dsh-typert-registry` | `ctx.typert`（schema / descriptor 注册表） |
| `@deepseek-ai/dsh-typert-loader` | 自动发现**每个 Loader entry** 的 `./typert` 导出并注册；无该导出的包静默跳过 |
| `@deepseek-ai/dsh-api-gateway` | Host `ctx.typertGateway`、Client `ctx.remote` |
| `@deepseek-ai/dsh-settings-file` | Settings provider（`<DSH_HOME>/settings.yaml`） |

`@deepseek-ai/dsh-web-app` 另挂 `@deepseek-ai/dsh-api-remotes`（Client `ctx.remote` 装配面）。

Remote contribution 本身是**纯数据**：`{ package, descriptors: [{ id, service, namespace, method, invocation, parameters, result, sourceLocation }] }`，其中 codec 为 `{ mode: 'strict', typeSymbol, schema }`（证据：`@deepseek-ai/dsh-api-settings-controller/lib/typert.remote-client.js`）。

## 阻断点（生成式路径）

`typertPlugin({ mode: 'package' })` 存在且面向单包发射，但生成器识别 `@Remote` / `TypertRemoteService` 时要求该符号的**声明文件属于已注册的 workspace 包**：

```js
// dsh-typert-generator@0.1.2-rc.1  lib/types/analyzer.js
isTypeMetaSymbol(node, name) {
  ...
  const registration = this.registrationForFile(declaration.getSourceFile().fileName)
  if (registration?.name === '@deepseek-ai/dsh-typert-protocol') return true
  for (let current = declaration; current !== undefined; current = optionalParent(current)) {
    if (ts.isModuleDeclaration(current) && ts.isStringLiteral(current.name)
        && current.name.text === '@deepseek-ai/dsh-typert-protocol') return true
  }
  return false
}
```

而 `registrationForFile` 只匹配 `tsconfig.host.json` / `tsconfig.client.json` 的 project reference，且这些 reference 必须位于 `<root>/packages/` 之下：

```js
if (!isWithin(realPath(packageRoot), join(this.options.root, 'packages'))) continue
```

第三方包从 `node_modules` 消费协议包，两条判定都不成立。用 TS checker 直接验证：

```
decorator Remote -> name: Remote
  declared in: .../node_modules/@deepseek-ai/dsh-typert-protocol/lib/types/index.d.ts
  enclosing declare module: none
```

因此 `remoteMarker()` 无输出，模型中 `invocations: []`，生成器随后以

```
TypertAnalysisError: typert(host): dsh-composer-quick-actions publishes Remote artifacts but has no Remote methods
```

拒绝发射。spike 中 Cordis 服务本身**已被正确识别**（`services: ["composerQuickActions"]`，来自 `declare module '@deepseek-ai/cordis'` 增强），仅 Remote 方法不可见——说明这不是配置错误，而是生成器对协议符号来源的硬性要求。

达到该结论前已逐条排除的非阻断项（均可满足）：

1. 根目录需要 `tsconfig.host.json` 与 `tsconfig.client.json` 面聚合配置；
2. 包必须位于 `<root>/packages/` 之下；
3. `package.json#exports` 需含 `./typert` 与 `./remote`，且 `files` 必须列出 `lib/typert.host.{js,d.ts}` 与 `lib/typert.remote-client.{js,d.ts,d.ts.map}`；
4. 服务源码不能只挂在 `./remote` 子路径下——`entrySourcePaths()` 显式跳过 `./typert`、`./client/typert`、`./remote`，必须从 `.` 等被扫描入口可达。

`@deepseek-ai/dsh-typert-generator` 的 npm `latest` tag 指向 `0.0.1-rc.1`，但 `0.1.2-rc.1` 确实已发布且可安装；版本错配**不是**阻断原因。

## 未被阻断的运行时替代路径（未实施）

`dsh-typert-registry` 的文档明确允许非 loader 拥有者直接注册：「any other owner calls `ctx.typert.register(contribution)` directly and receives the exact disposer that withdraws it」。其 strict codec 校验只检查存在 `parse` 方法，不检查 zod 实例：

```js
function validateCodec(codec, subject) {
  if (codec.mode === "src-json") return
  validateNonempty(`${subject} type symbol`, codec.typeSymbol)
  if (typeof codec.schema.parse !== "function") throw new Error(`typert: ${subject} strict codec has no parse() method`)
}
```

Client 侧 `ctx.remote.$mount()` 同样接收 contribution 值。因此手写 descriptor（含手写 `parse`）在两侧都能通过校验。

**代价**：wire 契约不再由 TypeScript 类型派生，漂移无编译期防护；且这与票据 13 的「生成式」措辞不符。

**尚未核实**：Client 侧 `$mount` 的端到端行为需要活动 GUI 页面下的 Client Inspect，而本轮为后台会话，无法执行（见 `CLAUDE.md`「环境与陷阱」）。因此即便采用该路径，也仍需前台会话补一次实测才能声称可用。

## 对票据的影响

- 票据 13：Host Settings 与目录装配已交付；Remote 的 wire 发布暂缺，等待范围决策。
- 票据 14：Client 目录读取依赖本决策；在此之前不能声称 `remote.composerQuickActions` 可用。
- 票据 17：若采用运行时注册路径，包不再输出 `./typert` / `./remote` 生成产物，README 的安装与兼容矩阵需相应描述。
