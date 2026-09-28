# dsh-quick-actions

*English: [README.en.md](./README.en.md)*

在 DSH 每个常规、由会话支持的**常驻消息编辑器（Resident Composer）**旁提供全局快捷动作。按一下按钮，把预先写好的一段文本发出去。

预置动作（Preset Quick Action）随包提供、只读，你可以隐藏或克隆它；自定义动作（Custom Quick Action）完全归你。所有数据经 DSH 本地 Settings 持久化，跨重启保留。

## 能做什么

- **发送动作**：把一段静态文本装载进草稿并按官方路径提交，装载路径只有一条 `setDraft(text)` → `submit()`。
- **三种布局**：输入框上方的动作带、输入框下方的操作栏、单入口的可搜索面板，随时切换。
- **每个动作可单独设置发送确认**，默认开启，之后由你决定。
- **`/` 开头的文本是合法的命令发送动作**，交给 DSH 官方裁决。
- 预置与自定义**合计上限 50 个**。达到上限后不能再新增或克隆；若升级或配置变化把既有状态推过上限，**已有数据一个都不会丢**，只是在回到上限以内之前禁止新增和克隆。

本版**不提供插入动作**（按选区插入、保留编辑上下文）：DSH 尚未公开 `insertText`，本版既不检测也不依赖它。动作文本是静态的，没有变量、模板或脚本。所有动作全局生效，暂无按 Agent 或按对话的可见性规则，也没有跨设备同步与导入导出。快捷动作不会出现在 no-session、hero 或 takeover 消息编辑器旁。

## 兼容性

| 项目 | 值 |
|---|---|
| 验证基线 | DSH 核心包 `0.1.7-rc.1`。桌面端 `dsh --version` 打印的是依赖集标签，与核心包版本不是同一个数字 |
| DSH peer | `>=0.1.7-alpha.2` |
| Cordis | `^4.0.4` |
| Schemastery | `^3.18.4` |
| React 与 React DOM（浏览器侧） | `^18.3.1`，由 web shell 的模块表提供，不从 profile 安装 |
| DSH UI primitives（浏览器侧） | `>=0.1.7-alpha.2`，同样由模块表提供 |
| 平台 | 只支持 `web` profile |

安装与运行都不检测 DSH 能力，因此不存在随版本变化的功能分档：要么整个插件能装能跑，要么装不上。

下界取的是本插件读取其 Settings 表单的那个 DSH 版本。**不要在更低版本上使用**：`0.1.7-alpha.1` 重写了 Settings——插件不再自己注册命名空间，用户数据改为插件自己的 Config、写进 profile。本版只按新模型读写，在 `0.1.5`、`0.1.6` 线上 Client 根本不会启动。要在那两条线上用，请装本插件的 `0.1.0`。

验证基线比下界高一版：本版在 `0.1.7-rc.1` 上验证，而 `0.1.7-alpha.2` 到 `0.1.7-rc.1` 之间，本插件用到的契约逐字未变，所以下界仍停在 `0.1.7-alpha.2`，留在 alpha 通道的用户照样能装。

上界不设，但**这不等于向后兼容有保障**，两点需要知道：

- **预发布阶段会破坏公开契约。** `0.1.2-rc.1` 到 `0.1.5-rc.1` 之间，被本插件用作唯一发送判据的那个字段被改了名；`0.1.7-alpha.1` 又整个换掉了 Settings 接口，旧版本插件在它上面 Host 直接激活失败（`settings.register is not a function`）。每次 DSH 升级都可能需要本插件跟一版；升级后若快捷动作出错，多半又是契约变更，请提 issue。
- **`>=0.1.7-alpha.2` 在 semver 里匹配不到下一个预发布版本。** 预发布版本只满足「主次修订号完全相同」的比较符，因此 `0.1.8-rc.1` 不满足 `>=0.1.7-alpha.2`；而 DSH 至今发布的每个版本都是预发布。DSH 一旦发出新的预发布，包管理器就会报未满足的 peer 依赖，即使插件本身没问题。反过来，semver 也拦不住你把本版装到 `0.1.5` 线上。这是 semver 对预发布的规定，不是本插件挑版本——`dsh plugin add` 装得上就可以继续用，出错时按上一条判断。（下面「装好之后」里那条 `Issues with peer dependencies found` 说的是另一个原因，两者会一起出现。）

## 安装

```sh
dsh plugin --profile web add dsh-quick-actions@next
```

**`@next` 不能省。** DSH 自己的 npm `latest` 还停在 `0.1.5` 线，所以本版发在 `next` dist-tag 上；不带 tag 装到的是 `latest` 上的 `0.1.0`，它只支持 `0.1.5`、`0.1.6` 线，在 `0.1.7` 上激活失败。等 DSH 把 `0.1.7` 推上 `latest`，本插件跟着回到 `latest`。

然后重启 web profile。一个包就是全部：它自带 `dsh.bundle.patch` 把自己的 Host 半边插进 profile，`dsh.client` 声明让 web 端加载浏览器半边。

### 本地 / 离线安装

```sh
mkdir -p /tmp/quick-actions
pnpm --filter dsh-quick-actions pack --pack-destination /tmp/quick-actions
dsh plugin --profile web add /tmp/quick-actions/dsh-quick-actions-0.2.0-rc.2.tgz
```

上面的 `--filter` 形式在仓库任意位置都能用；如果你已经在包目录里，`pnpm pack --pack-destination /tmp/quick-actions` 即可。

tarball 路径要用**绝对路径**：`dsh plugin` 是 pnpm 的转发器，pnpm 在 profile 目录里运行，相对路径会解析到 `<DSH_HOME>/profiles/web/` 下并以 `ENOENT` 失败。

### 装好之后

- `<DSH_HOME>/profiles/web/package.json` 的 `dependencies` 与 `dsh.profile.bundles` 末尾都会多出 `dsh-quick-actions`。这两处由 `dsh plugin` 维护，不要手工编辑。
- 不启动服务器也能检查：

  ```sh
  dsh --profile web --dump-config | grep -A1 'id: composer-quick-actions'
  ```

  应当看到 `- id: composer-quick-actions` / `name: dsh-quick-actions`。这条 row 在**下一次 profile 启动**时生效。

- pnpm 会打印 `Issues with peer dependencies found`。**这是正常的**：DSH 核心包装在 DSH 自己的安装锚点里，profile 的 pnpm 看不到它们。同一 profile 里其它第三方 DSH 插件也是同样表现。

### 安装报 `ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION`

安装可能以这样的错误结束，而**被点名的包一个都不是本插件**：

```text
ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION  4 lockfile entries failed verification:
  some-other-plugin@1.2.3 was published at ..., within the minimumReleaseAge cutoff (...)
```

pnpm 有一条供应链策略：拒绝发布时间在冷却窗口内（默认 24 小时）的依赖。它校验的是**整个 profile 的 lockfile**，不只是你这次要装的包——所以只要 profile 里任何一个已装插件在最近一天发过新版且没拿到豁免，装任何东西都会被拦下。

想确认与本插件无关，在 profile 目录里单跑一次 `pnpm install`，什么都不加；报同样的错就说明如此。三种处理方式：

1. 给这一次命令加个标志，只影响本次：

   ```sh
   dsh plugin --profile web add dsh-quick-actions --config.minimumReleaseAge=0
   ```

2. 等冷却期过去。错误信息里写了每一条的发布时间与截止时间，等最晚的那个满 24 小时即可。
3. 把被点名的 `名字@版本` 逐条加进 `<DSH_HOME>/profiles/web/pnpm-workspace.yaml` 的 `minimumReleaseAgeExclude`，代价是对这些包放弃这层保护。

## 配置预置动作

预置目录由两部分拼成：先是随包内置的清单，然后是 Host composition 在 `Config.presets` 里追加的条目。`Config.presets` 是预置的唯一声明通道，没有运行时注册 API。

在插件那条 row 上写 `config`：

```yaml
# <DSH_HOME>/profiles/web/cordis.patch.yml
- id: composer-quick-actions
  config:
    presets:
      - id: run-tests
        label: 跑测试
        text: 把测试跑一遍，把失败项贴出来。
        icon: ✅
      - id: add-tests
        label: 补测试
        text: 给刚才的改动补上测试，先写失败用例。
        confirm: false
```

字段规则：

- `id` 必填、全目录唯一且**永久**。标签、图标、文本可以在同一个 `id` 下改；`confirm` 属于安全行为签名，要改就得换新 `id`——把文本改成以 `/` 开头（或改掉这一点）同样算。
- `label`、`text` 必填；`icon`、`confirm` 可选，`confirm` 默认 `true`。
- 预置无效（缺字段、`id` 重复、目录超过 50 条）会让**插件加载响亮失败**并一次列出所有问题，而不是静默截断。
- `presets` 与你的动作数据同在这一行 `config` 下（见下文「Settings 路径」），本插件从不写它。它是 DSH 的 volatile 字段：profile 运行期间改动会即时反映到快捷动作上；此时若改出无效目录，快捷动作区域显示目录错误，重启 profile 时插件加载失败并列出问题。
- **只写在 active profile 自己的这份 `cordis.patch.yml` 里。** 不要把本插件的 `config` 写进 home patch（`<DSH_HOME>/cordis.patch.yml`）或 `dsh --patch` 的 overlay：DSH 的 patch 行 `config` 是整份替换，那一层会盖住这一行里存的你的动作数据（界面回到默认，磁盘上的数据还在），而且 DSH 会拒绝此后的每一次保存，界面报「保存被拒绝」，重试也不会成功。删掉那一层里本插件的行并重启 profile 即可恢复。

用户对预置只能隐藏或克隆，不能编辑或删除；克隆出来的是一条普通的自定义动作。

## 三种布局

布局是全局持久化设置，在管理面板里切换：

| 值 | 名称 | 位置 |
|---|---|---|
| `ribbon`（默认） | 上方动作带 | 输入框上方一行，与输入框等宽 |
| `bar` | 下方操作栏 | 输入框下方一行，与 DSH 自己的用量信息并排，宽度随内容、最多与输入卡片同宽，装不下的折进「更多」 |
| `launcher` | 单入口面板 | 一个入口按钮，点开可搜索的动作面板 |

`bar` 与 `launcher` 共用同一个可搜索面板，搜索只匹配标签和文本。管理面板里可以给预置排序、隐藏、恢复、克隆，增删改自定义动作并启停它们，以及切换布局。

## 命令发送动作（Command Send Action）

首个非空白字符是 `/` 的静态文本会被标记为「命令」。

- 它与普通发送动作走**完全相同**的一条路径，命令一律交给 DSH 官方裁决；本插件不解析、不改写命令语义。
- 确认默认开启，**可以关闭**。你设定的 `confirm` 不会被改写。
- 确认开启时，面板展示的就是最终提交内容。**但这里不会出现你在原生输入框敲 `/` 时的候选菜单**，因此裁决结果可能与逐字输入同一条命令时不同。
- 确认关闭时，命令一键提交、没有预览。
- 管理表单在文本成为命令时给出警示，但不锁定任何控件。

## Settings 路径

用户数据是本插件装载条目 `composer-quick-actions` 自己的 Config。DSH Settings 把它写进**当前 profile** 的 `<DSH_HOME>/profiles/web/cordis.patch.yml`（`DSH_HOME` 未设置时是 `~/.dsh`），落在该 id 那一行的 `config` 下：

```yaml
- id: composer-quick-actions
  name: dsh-quick-actions
  config:
    schemaVersion: 1
    layout: bar
    userActionsById: { ... }
    actionOrder: [ ... ]
    presetStateById: { ... }
```

- 这五个字段存放布局、自定义动作、统一顺序和预置差异，是**唯一的持久化数据**。同一行的 `config.presets` 是你声明的预置，本插件从不写它。
- 数据按 profile 各存一份。第一次在管理面板里改动之前，这一行可能根本不存在；改回默认状态时 DSH 会把它删掉。
- 本插件自带管理面板，因此关掉了 DSH 为它自动生成设置页。

Host 是校验的唯一权威，启动时按当前目录对存放的数据做一次幂等规范化。界面的每次修改都带上预期 revision；发生冲突时会刷新到最新状态并请你确认后重试，绝不静默覆盖别人的写入。更高 `schemaVersion` 写下的数据原样保留，因此降级往返无损。

### 从 DSH 0.1.5 / 0.1.6 迁移

旧版数据存在 `<DSH_HOME>/settings.yaml` 的 `composer-quick-actions` section。DSH `0.1.7` 首次启动、全部插件就绪后，会把整份文件改名为 `settings.yaml.imported`，再把每个 section 导入同名插件条目——**只尝试这一次**，也只有最先启动的那个 profile 能导入。

导入要成功，那一刻跑着的必须是本版插件。**先升级本插件，再升级 DSH**（或在同一次重启里一起完成）。若 DSH 先升了，旧插件在它上面激活失败，这次导入随之失败，数据原样留在 `settings.yaml.imported` 里。这时手工迁移：把那个 section 下的五个字段原样复制到上面那一行的 `config` 下，然后重启 profile。

## 升级、降级与卸载

**升级 / 降级**：

```sh
dsh plugin --profile web add dsh-quick-actions@<version>
```

本地 tarball 则 `add` 指向目标版本的那个 tarball。之后重启 profile。重复 `add` 同一版本是幂等的。

跨版本的数据兼容由 Host 负责：新增预置只追加到既有顺序末尾，不改写任何已存数据。

**卸载**：

```sh
dsh plugin --profile web remove dsh-quick-actions
```

依赖与 `dsh.profile.bundles` 里的那一层会同时去掉，重启 profile 后动作不再出现。`cordis.patch.yml` 里 `id: composer-quick-actions` 那一行原样保留——你的动作都在它的 `config` 里，重装后按 id 接回，所以动作会回来。只卸不装时，这一行就成了找不到目标的孤儿行：不影响启动，`dsh --profile web --dump-config` 会为它报 `patch: entry "composer-quick-actions" not found`；按下面第 1 步删掉即可。

**手工彻底清理**（卸载不做这些，因为重装应当恢复你的动作）：

1. 从 `<DSH_HOME>/profiles/web/cordis.patch.yml` 删掉 `id: composer-quick-actions` 那一行，这是唯一保存用户数据（以及你声明的预置）的地方。
2. 如果 `<DSH_HOME>/settings.yaml.imported` 里还留着 `composer-quick-actions` section，一并删掉。
3. 如果 `<DSH_HOME>/profiles/web/pnpm-workspace.yaml` 里有为本插件加过的条目，一并删掉。
4. 重启 profile。

## 开发

```sh
pnpm install
pnpm build          # Host ESM + Client 单文件 lazy-CJS
pnpm watch:client   # 只重建 Client bundle
pnpm test
pnpm typecheck
pnpm lint
```

产物：Host 为 `lib/index.js` 与 `lib/types.js`（标准 Node ESM）；Client 为 `lib/client.js` 加 sourcemap，browser-only 单文件 lazy-CJS；类型为 `lib/types/**/*.d.ts`，只有声明。

`pnpm watch:client` **不等于** DSH GUI 的 HMR。要让改动落到运行中的页面，先确认三件事：被 profile 实际加载的是你正在 watch 的那个 checkout（离线安装装的是 tarball 的副本）；该 checkout 的 watcher 正在跑且已成功产出过一次；页面重新拉取了新产物。Client 产物是原子发布的，watch 构建失败时保留上一次成功的产物，所以页面可能仍在跑旧代码。

## 许可证

MIT
