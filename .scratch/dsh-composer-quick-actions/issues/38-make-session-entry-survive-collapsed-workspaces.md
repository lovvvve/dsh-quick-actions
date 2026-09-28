# 让 GUI 驱动进入会话时不被折叠的工作区行卡住

Type: task
Mode: AFK
Status: open
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
