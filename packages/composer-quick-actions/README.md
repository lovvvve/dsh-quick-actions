# dsh-composer-quick-actions

*English: [README.en.md](./README.en.md)*

在 DSH 每个常规、由会话支持的**常驻消息编辑器（Resident Composer）**旁提供全局快捷动作。预置动作（Preset Quick Action）由作者提供、只读；自定义动作（Custom Quick Action）由用户自己维护。全部用户数据经 DSH 本地 Settings 持久化，跨重启保留。

这是一个 Host + Client **双面功能包**：Host 半边在 Node 侧拥有配置校验与 Settings 权威，Client 半边在浏览器侧注册消息编辑器的 dock Slot。安装形态是配套的 [`dsh-composer-quick-actions-bundle`](../composer-quick-actions-bundle/README.md)。

## 首版能做什么

- **只有发送动作（Send Action）**。按一下按钮，把预先配置好的一段静态文本装载进草稿并按官方路径提交。装载路径只有一条：`setDraft(text)` → `submit()`。
- **不提供插入动作**（按选区插入、保留编辑上下文）。DSH 至今没有公开 `insertText`，插入能力待该接口公开后另建 effort，本版既不检测它也不依赖它。
- 动作文本是**静态**的：没有变量、模板、脚本或任何运行时生成内容。
- 预置与自定义**合计上限 50 个**。正常状态下达到上限就不能再新增或克隆；如果升级、包更新或 Host 配置变化把既有状态推过上限，**已有数据一个都不会丢**——只是在回到上限以内之前禁止新增和克隆。
- 每个动作可以单独设置**发送确认**。确认默认开启（只在创建和克隆时写入默认值），之后完全由你决定。
- 所有动作**全局生效**。首版没有按 Agent、按 Preset 或按对话的可见性规则，也没有跨设备同步、导入和导出。
- 快捷动作不会出现在 no-session、hero 或 takeover 消息编辑器旁。

## 兼容性

| 项目 | 值 |
|---|---|
| 取证基线 | DSH 核心包 `0.1.2-rc.1`（`@deepseek-ai/dsh` 与 `dsh-base` / `dsh-settings` / `dsh-web-app` 等同为该版本）。桌面端 `dsh --version` 打印的是它的依赖集标签，与核心包版本不是同一个数字。 |
| DSH peer 下界 | `>=0.1.2-rc.1`，不设上界 |
| Cordis | `^4.0.2` |
| Schemastery | `^3.18.2` |
| React 与 React DOM（浏览器侧） | `^18.3.1`，由 web shell 的模块表提供，不从 profile 安装。`react-dom` 承载管理面板的 portal，用的是 shell 自己那份渲染器实例 |
| DSH UI primitives（浏览器侧） | peer `>=0.1.2-rc.1`，同样由模块表提供；devDependency 精确锁 `0.1.2-rc.1` 仅供类型检查 |
| 平台 | 只支持 `web` profile（`dsh.client.platform: web`） |
| 消费的公共契约 | Host 注入 `settings`；Client 注入 `slots`、`settingsScope`、`connection`、`locale`，并经 `ctx.get` 读 `conversation` |

下界取的是本 effort 全程取证所用的核心包版本。它**不是**首个正式支持的 DSH 发布版本——首发版本尚不可知，本文不做该断言。不设上界是因为 DSH 仍在 0.x rc 阶段，`^0.1.2-rc.1` 会把 0.2.x 直接排除在外。

首版**不依赖 `insertText`**，安装与运行都不检测任何 DSH 能力，因此不存在随 DSH 版本变化的功能分档：要么整个插件能装能跑，要么装不上。

### 已知限制：样式的作者格式

界面控件用的是官方 `@deepseek-ai/dsh-client-ui-primitives`（`Button` / `Pill` / `Input` 与官方图标），配色只取 DSH 主题 token，不覆盖全局主题。但插件自己的布局样式**以带 `dsh-cqa-` 前缀的样式字符串编写，而非 CSS Modules**。

投递方式与第一方 DSH 插件逐字相同——运行时注入 `<style data-plugin-css>` 附带幂等判断，与 `dsh-client-ui-chat` 等包的做法一致。差别只在作者格式（手写字符串 vs `.module.css`）与类名生成（约定前缀 vs 编译期 hash），**用户不可见**。类名的不冲突由前缀约定维持，不由编译器强制。这是首版已知并接受的取舍。

## 安装

### 正式安装

```sh
dsh plugin --profile web add dsh-composer-quick-actions-bundle
```

然后重启 web profile。

> **两个包目前尚未发布到任何 registry。** 名称、`0.1.0` 版本和 MIT 许可证都已确定，但发布本身被有意推后，所以上面这条命令现在会以 404 结束。试用请走下面的本地 tarball 流程。

### 本地 / 离线安装

安装 bundle **只声明**对功能包的依赖，**不内嵌**它，所以离线安装必须让两个 tarball 都能被解析。

1. 打包两个包。功能包声明了 `prepack`，所以打它时 `pnpm pack` 会先跑一遍 `pnpm build`，tarball 里的产物一定是新鲜的；bundle 没有产物要构建，直接打包：

   ```sh
   mkdir -p /tmp/quick-actions
   pnpm --filter dsh-composer-quick-actions pack --pack-destination /tmp/quick-actions
   pnpm --filter dsh-composer-quick-actions-bundle pack --pack-destination /tmp/quick-actions
   ```

   得到 `dsh-composer-quick-actions-0.1.0.tgz` 与 `dsh-composer-quick-actions-bundle-0.1.0.tgz`。

2. 在 profile 的 pnpm 配置里为功能包加一条 override，指向功能包 tarball 的**绝对路径**：

   ```yaml
   # <DSH_HOME>/profiles/web/pnpm-workspace.yaml
   overrides:
     dsh-composer-quick-actions: file:/tmp/quick-actions/dsh-composer-quick-actions-0.1.0.tgz
   ```

3. 安装 bundle tarball：

   ```sh
   dsh plugin --profile web add /tmp/quick-actions/dsh-composer-quick-actions-bundle-0.1.0.tgz
   ```

4. 重启 web profile。

第 2 步是**必需**的，不是可选优化。`dsh plugin` 是 pnpm 的转发器，bundle 的依赖 `dsh-composer-quick-actions@0.1.0` 会照常去 registry 解析；在包未发布之前，只把两个 tarball 一起 `add`（或先 `add` 功能包再 `add` bundle）都不行——直接依赖不会满足传递依赖，pnpm 仍然报 `ERR_PNPM_FETCH_404`。override 是唯一可复现的解析方式。

包发布之后这一步就不需要了：把 override 删掉，改用上面的正式安装命令即可。

### 安装后应当看到什么

- `<DSH_HOME>/profiles/web/package.json` 里，`dependencies` 多了 bundle，`dsh.profile.bundles` 末尾多了 `dsh-composer-quick-actions-bundle`（这两处都由 `dsh plugin` 自己维护，不要手工编辑）。
- 功能包以传递依赖的形式落在 `<DSH_HOME>/profiles/web/node_modules/dsh-composer-quick-actions`。
- 检查这一层是否装好，不必启动服务器：

  ```sh
  dsh --profile web --dump-config | grep -A1 'id: composer-quick-actions'
  ```

  合成后的 profile 树里应当出现 `- id: composer-quick-actions` / `name: dsh-composer-quick-actions`，并被注明来自 `dsh-composer-quick-actions-bundle` 层。这条 row 在**下一次 profile 启动**时生效。

- pnpm 会打印 `Issues with peer dependencies found`，`pnpm peers check` 会把本包声明的 DSH peer 全部列为 missing。**这是正常的**：DSH 核心包装在 DSH 自己的安装锚点里，而不是 profile 的 `node_modules` 里，profile 的 pnpm 看不到它们（`autoInstallPeers: false`）。同一个 profile 里已装的其它第三方 DSH 插件也是同样表现。peer 声明在这里的作用是记录本包消费的 DSH 契约面，不参与解析。

## 配置预置动作

预置目录由两部分拼成，顺序固定：先是本包内置的预置清单，然后是 Host composition 在 `Config.presets` 里追加的条目。`Config.presets` 就是**预置的授权声明通道**——没有第三方运行时注册 API。

在 bundle 插入的那条 row 上写 `config`：

```yaml
# <DSH_HOME>/profiles/web/cordis.patch.yml
- id: composer-quick-actions
  config:
    presets:
      - id: run-tests
        label: 跑测试
        text: 把测试跑一遍，把失败项贴出来。
        icon: ✅
      - id: compact
        label: 压缩上下文
        text: /compact
```

字段规则：

- `id` 必填，在整个目录里唯一，而且**永久**。标签、图标、文本可以在同一个 `id` 下改；`confirm` 是安全行为签名，要改就得换一个新 `id`。把文本改成以 `/` 开头（或改掉这一点）同样算跨过这条签名。
- `label`、`text` 必填，`icon`、`confirm` 可选（`confirm` 默认 `true`）。
- 不要声明动作类型。数据契约里保留了 `kind` 判别式，但首版恒为 `'send'`：作者不声明、表单没有选择器、用户改不了，规范化统一写出。
- 预置无效（缺字段、`id` 重复、`kind` 不是 `'send'`、目录超过 50 条）会让**插件加载响亮失败**，并一次性列出所有问题，而不是静默截断或后者覆盖前者。

用户对预置只能隐藏或克隆，不能编辑或删除；克隆出来的是一条普通的自定义动作。

Host 把拼好的目录快照发布为一个**只读** Settings 命名空间 `composer-quick-actions-catalog` 的 composition `base` 层，Client 只读这一层。它没有用户层，因此不产生持久化 section——你即便手工在 `settings.yaml` 里写出同名 section，也不会改变 Client 看到的目录。这个命名空间会出现在 Settings 的命名空间清单里，但没有注册配置卡片，所以不渲染表单。

## 三种布局

布局是一个全局持久化设置，在管理面板里切换：

| 值 | 名称 | 位置 |
|---|---|---|
| `ribbon`（默认） | 上方动作带 | 输入框上方一行，与输入框等宽 |
| `bar` | 下方操作栏 | 输入框内部下方一行，装不下的动作折进"更多" |
| `launcher` | 单入口面板 | 一个入口按钮，点开可搜索的动作面板 |

`bar` 与 `launcher` 共用同一个可搜索动作面板；搜索只匹配标签和文本，并保持统一顺序。管理面板是独立注册的一层，预置排序 / 隐藏 / 恢复 / 克隆、自定义动作的增删改与启停、以及布局切换都在这里。

## Settings 路径

用户数据落在 `<DSH_HOME>/settings.yaml`（`DSH_HOME` 未设置时是 `~/.dsh`）：

- `composer-quick-actions` — **唯一的持久化命名空间**。存放 `schemaVersion`、`layout`、自定义动作、统一顺序和预置差异（隐藏 / 排序）。
- `composer-quick-actions-catalog` — 预置目录，只读，不写用户层，因此**不会**在这个文件里出现。

Host 是校验与迁移的唯一权威：启动时它按当前目录对存放的 section 做一次幂等规范重写（受 revision fence 保护）。Client 从不直接写文件、不拿浏览器存储当权威源、也不做迁移；它的每次修改都带上预期 revision；发生冲突时权威快照会刷新，重试由你在界面上明确触发，插件绝不静默覆盖别人的写入。更高 `schemaVersion` 写下的数据会被原样保留、不改写，好让降级往返无损。

## 命令发送动作（Command Send Action）

首个非空白字符是 `/` 的静态文本是**合法**的发送动作，会被标记为"命令"。

- 它和别的发送动作走**完全相同**的一条路径：`setDraft(text)` → `submit()`。命令一律交给 DSH 官方裁决，本插件不解析、不改写命令语义，也不注册或驱动任何输入触发管线。
- 确认默认开启，**可以关闭**。规范化绝不会根据文本改写你设置的 `confirm`；默认值只在创建和克隆时写入一次。
- 确认开启时，面板展示的就是最终提交内容。**但是**：这里不会出现你在原生输入框敲 `/` 时的候选菜单。因此裁决结果可能与你在原生输入框逐字输入同一条命令时的预期不同——这是已知并接受的取舍。
- 确认关闭时，命令一键提交、没有任何预览。这是你对自己预先配置的静态命令做出的显式选择。
- 管理表单在文本成为命令时给出警示，但**不锁定**任何控件；确认开关始终由你决定。

## 开发

```sh
pnpm install
pnpm build          # tsc -b（只发 .d.ts）+ tsdown（Host ESM + Client 单文件 lazy-CJS）
pnpm watch:client   # 只重建 Client bundle
pnpm test
pnpm typecheck
pnpm lint
```

产物：

- Host：`lib/index.js`、`lib/types.js`（标准 Node ESM）。
- Client：`lib/client.js` + `lib/client.js.map`，browser-only 单文件 lazy-CJS，包成 `window.__ModuleLoader__.load({ id, factory })`。只有 `dsh.client.external` 列出的 specifier（`react`、`react/jsx-runtime`、`react-dom`、`@deepseek-ai/dsh-client-ui-primitives`，全部是浏览器模块表的平台种子）可以 `require`；其余一律内联，间接 / 计算型 `require`、动态 `import` 与未声明的 external 会在构建期失败。
- 类型：`lib/types/**/*.d.ts`，只有声明，不含 JavaScript。

### 验证开发期 HMR 的前置条件

`pnpm watch:client` **不等于** DSH GUI 的 HMR。要看到改动落到运行中的页面，必须先确认：

1. 被 DSH profile 实际加载的，是你正在 watch 的那个 checkout（离线安装装的是 tarball 的副本，改源码不会影响它——开发时请用 `file:`/`link:` 指向工作副本）。
2. 那个 checkout 的 Client build watcher 正在跑，并且已经成功产出过一次完整产物。
3. 页面重新拉取了新的 bundle。Client 产物是原子发布的：watch 构建失败时保留上一次完整成功的产物，所以页面可能仍在跑旧代码——先确认这一轮 watch 构建成功。

## 升级、降级与卸载

**升级 / 降级**——发布后：

```sh
dsh plugin --profile web add dsh-composer-quick-actions-bundle@<version>
```

本地 tarball 则是把 override 与 `add` 指向新（或旧）版本的两个 tarball，再重启 profile。重复 `add` 同一版本是幂等的，不会在 `dsh.profile.bundles` 里留下重复项。

跨版本的数据兼容由 Host 负责：新增预置只会追加到既有顺序末尾、不改写任何存放数据；降级回本版时，更高 `schemaVersion` 的数据会被原样保留（不显示、不计数、不改写），因此往返无损。

**卸载**：

```sh
dsh plugin --profile web remove dsh-composer-quick-actions-bundle
```

`dsh plugin` 会同时把依赖和 `dsh.profile.bundles` 里的那一层去掉。重启 profile 后动作就不再出现。

**手工彻底清理**（卸载不会做这些，因为重装应当恢复你的动作）：

1. 从 `<DSH_HOME>/settings.yaml` 删掉 `composer-quick-actions` section——这是唯一保存用户数据的地方。
2. 如果你走过本地 tarball 流程，从 `<DSH_HOME>/profiles/web/pnpm-workspace.yaml` 删掉那条 `overrides`。
3. 如果你在 profile 的 `cordis.patch.yml` 里给 `composer-quick-actions` 写过 `config`，把那段一并删掉。
4. 重启 profile。

## 许可证

MIT
