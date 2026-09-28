# 让 GUI 驱动进入会话时不被折叠的工作区行卡住

Type: task
Mode: AFK
Status: resolved
Blocked by: none

## Question（问题）

票据 37 的两轮 GUI（2026-09-28，DSH `0.1.7-rc.2`，用户刚把 `dsh-better-sidebar` 从 `0.21.1` 升到 `0.22.0`）里出现一个稳定的规律：**同一个 Playwright worker 里的第二个用例，首次尝试总在 `openResidentComposer` 超时**（约 1.3 分钟，报 `no sidebar session mounted the quick actions layout cell`），重试——Playwright 换一个新 worker——就通过。`surface.spec` 三视口 15 条、`scale.spec` 每档 3 条都是如此，整轮耗时因此翻倍；在更早的票据 34 窗口（`better-sidebar 0.21.1`）里没有出现过。

失败现场的页面快照里，侧栏会话树只有三个**全部折叠**的工作区行（`web`、`yulong`、`tmp`），一条会话都没露出来。`tests/gui/support.ts` 的 `enterSession` 把「不含子 treeitem 的行」当作会话叶子去点，而折叠的工作区行恰好也不含子 treeitem：点它只会展开或收起工作区，进不了会话，8 次尝试、每次最多等 20 秒，耗尽 90 秒的用例预算。模块级缓存 `knownLeaf` 在第二个用例里也指不到会话。

要做：

1. 确认第二个用例开始时工作区为什么是折叠的（`better-sidebar 0.22` 是否把折叠状态存到了服务端或别的跨 context 的地方）。
2. 让 `enterSession` 区分工作区行与会话行（例如按 `aria-expanded` 是否存在、或 DSH/`better-sidebar` 给会话行的 `data-row-key="session:…"`），遇到折叠的工作区先展开再找会话，而不是把它当成会话去点。
3. 复跑 `verify-round.sh surface.spec.ts` 确认不再需要重试。

这不影响插件本身：重试后所有用例都通过，失败发生在进入会话之前。

## Comments

## Answer（结论）

**`enterSession` 改为只点会话行、先展开折叠的工作区、按会话 id 缓存；surface + manager 三视口 30 条一次全过，耗时从 27.7 分钟降到 3.8 分钟。**

### 根因（源码取证，`0.1.7-rc.2`，只读）

- 侧栏树是 DSH 自己的 `@deepseek-ai/dsh-client-ui-workspace` 渲染的，与 `better-sidebar` 无关。**会话行与工作区行是兄弟节点**，不是父子：会话行 `data-row-key="session:<id>"`（带 `aria-selected`），工作区行 `data-row-key="workspace:<id>"`（带 `aria-expanded`，整行 onClick 即展开/收起）（`dsh-client-ui-workspace/lib/client.js:1284-1287,1589-1592`）。折叠的工作区行本就没有子 treeitem，旧的「无子项即会话」判据从根上区分不了两者。
- 展开状态存在浏览器 `localStorage` 的 `dsh.workspace.view.v5` → `groupExpansion`（`:656-678`），默认折叠，只有当前会话所属的工作区会被自动展开（`:2326-2328,2349-2352`）。Playwright 每个用例都是空存储，所以每次加载时工作区基本都是折叠的。
- 真正的失败来自模块级缓存 `knownLeaf`：它记的是**行下标**，是第一个用例「展开了某个工作区之后」那棵树上的位置；到了新 context 树又全部折叠，同一下标指向了工作区行。这在升级 `better-sidebar` 之前就存在（票据 34 的 `r-verify.log` 已有 26.7 s / 1.3 m 的同样模式），只是当时恰好在第 4 次尝试时点中了有历史的会话。

### 改动（`tests/gui/support.ts` 的 `enterSession`）

- 只选 `[role="treeitem"][data-row-key^="session:"]`；缓存从行下标 `knownLeaf` 改为会话行键 `knownSession`。
- 可见会话都试过时，展开下一个 `[data-row-key^="workspace:"][aria-expanded="false"]`：点行左侧 20 px 的文件夹图标（行中部与右侧是悬停出现的「工作区操作」「在此新建会话」按钮），点完等 `aria-expanded="true"`；刚加载的树可能吞掉点击，所以最多点 3 次，每次点之前确认仍是折叠，避免把已展开的再收起。
- 工作区行先于会话行渲染：既无未试会话又无折叠工作区时，先等最多 10 秒让新的会话行出现，再判定没有。

### 真机过程（用户停服后自起 3080，开窗前另存 profile 四文件）

1. 首版（只点会话行 + 点行中部展开）：`reinstall` 的「卸载后」段展开失败——页面加载时三个工作区全部折叠，点中部没展开。
2. 临时探查脚本（用完即删）确认：点行左侧 20 px 可展开；中部与右侧是悬停按钮。期间 `~/.dsh/sessions` 无任何新建会话。
3. 改点左侧后：`manager.spec` 前三条首次即过，但仍有展开被吞与会话行未加载两类快速失败（30 条中 5 条需重试，6.8 分钟）。
4. 加上重复点击与等待会话行后：**30 条一次全过（3.8 分钟）**，`reinstall` 与 `close-window` 通过，每轮后 patch 与独立备份一致。

### 期间的外部变化

- 第二次验证期间（14:28:45），用户 profile 里的 `dsh-better-sidebar` 从 `0.22.0` 升到 `0.22.1`（`pnpm-workspace.yaml` 新增 `minimumReleaseAgeExclude: dsh-better-sidebar@0.22.1`）。本插件的测试从不触碰其他插件，服务器日志也无记录；是 dshmarket 自动更新还是有人在测试服务器的界面上点了更新，无法判定。没有回退，之后以升级后的 profile 为新基准。
- 同一轮里 `manager.spec` 的 launcher 切换有一次首次失败（切换后仍显示 ribbon），重试通过，发生在上述热升级前后，更像 DSH 重新加载插件时丢了一次写入；最后一轮未再出现。
