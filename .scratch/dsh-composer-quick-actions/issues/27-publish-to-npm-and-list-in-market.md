# 发布到 npm 并在插件市场上架

Type: task
Mode: HITL
Status: claimed
Blocked by: none

## Question（问题）

把两个包真正发布出去，使任何人都能用[功能包 README](../../../packages/composer-quick-actions/README.md)「正式安装」一节那条命令装上：

```sh
dsh plugin --profile web add dsh-quick-actions-bundle
```

**本票据推翻[票据 20](./20-choose-publishing-identity-and-license.md) 的「暂不发布」。** 那条决定当时的理由是「只定身份不推包，试用走本地 tarball，不让发布阻塞票据 17/18/21」；首版验收既已通过（票据 21），该理由不再成立。反转须逐处落到文档，不得默默执行：票据 20 的 `## Answer`、地图的决策索引、根 `CLAUDE.md`「环境与陷阱」里那条「**不要**给任何包加 `publishConfig` 或执行 `npm publish`」。

### 开工前已确认的事实

| 事实 | 依据 |
|---|---|
| 两个包名在 npm 均未被占用 | `npm view` 对二者都返回 404 |
| 打包契约已为发布备好 | 票据 17 定身份与 `files`，票据 24 把 pack 隔离到工作树外；`workspace:*` 在打包时替换为真实版本，根 `LICENSE` 自动带入 |
| 正式安装本就是一条命令 | README「正式安装」一节已写好，并注明当前会 404 |
| 发现与安装是**两条**通道 | npm 负责安装；插件市场的目录来自策展仓库 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 的 `plugins.json`，上架须去那里提 PR，市场本身不收插件条目的 PR |

### 已完成：发布前改名

用户在发布前要求把包名缩短为与仓库同名。已执行，记在 [spec 第 19 节](../spec.md)，[票据 20](./20-choose-publishing-identity-and-license.md) 追加了指向本票据的说明而其原文不改：

| 角色 | 旧名 | 现名 |
|---|---|---|
| 功能包 | `dsh-composer-quick-actions` | `dsh-quick-actions` |
| 安装 bundle | `dsh-composer-quick-actions-bundle` | `dsh-quick-actions-bundle` |

**只改 npm 包名。** Cordis 装载条目 id、两个 Settings 命名空间与本地化命名空间一律仍是 `composer-quick-actions`：它们是另一条身份轴，其中 Settings 那两个一经发布就是陌生人机器上的用户数据，此后改名须写迁移。议题跟踪目录 `.scratch/dsh-composer-quick-actions/` 与包目录名也不动，它们不参与解析。

改名过程中的一次返工值得记下：首版批量替换用的是无差别 `sed`，把跟踪器目录路径和历史记录里的旧包名一并改掉了——前者让所有链接指向不存在的目录，后者会让票据 20 与发布证据谎称当时用的就是新名。已整体回退重做，改为负向前瞻只替换后面不跟斜杠的出现，并把文件清单收窄到前瞻性文件。

### 待办

1. **（HITL）** 发布本身要用户来跑。已实测：`npm login` 不够——该账号对 publish 开了 2FA，pnpm 在非交互终端下以 `ERR_PNPM_OTP_NON_INTERACTIVE` 拒绝，两个包均未发出、registry 无残留。Agent 无法代跑，也不应经对话传递一次性密码。用户在交互终端执行，或自行附 `--otp=<code>`。
2. `pnpm --filter dsh-quick-actions publish --dry-run` 核对将要上传的内容，再正式发布。**功能包必须先发**——bundle 依赖它。
3. ~~发布 bundle 包。~~ **已作废**：[票据 28](./28-merge-into-a-single-package.md) 把安装 bundle 并回功能包，不再有第二个包要发。
4. **在全新 `DSH_HOME` 里实测陌生人的安装路径**：只用那条官方命令，不加 profile `overrides`、不指 tarball。本地流程当初需要 override 加两个 tarball（票据 17），从 registry 装能否收敛成一条命令**尚无人验证**，这是本票据唯一的实质未知。
5. 删掉四份 README 里的「尚未发布」注记，正式安装一节改为可直接执行。
6. 去 `awesome-dsh-plugin` 提 PR 上架，按其条目格式填写。

### 待用户拍板的决定

**发布哪个版本号。** npm 的版本号一经发布即锁死内容，撤回只有 72 小时窗口且名字仍被占用。由于第 4 步的未知只能在发布之后验证，先发预发布版试通、再发 `0.1.0` 更稳；但代价是 registry 上会留下一个预发布版本。

### 验收

第 4 步在全新 `DSH_HOME` 上通过，四份 README 不再声称未发布，反转已落到票据 20、地图与 `CLAUDE.md` 三处，市场 PR 已提交（合入与否不由本仓库控制，记录 PR 链接即可）。

## Comments（评论）

### 2026-09-09 — 由用户发起，未开 Wayfinder 地图

用户问「现在我要发布，让别人也能安装要怎么做」。按 wayfinder 的判据评估后**没有开图**：路线已清晰、无雾，整件事约一个会话加一次用户侧认证即可完成，开图属于该技能自己警告的滥用。以本票据承载。

### 2026-09-10 — 现状：两个包已撤回，`dsh-quick-actions` 处于 24 小时冷却期

进展与阻塞如下，本票据仍 `claimed`。

**已完成**

1. 改名为 `dsh-quick-actions`（spec 第 19 节）。
2. 发布 `0.1.0-rc.1`（双包形态），并在全新 `DSH_HOME` 上验证单命令安装成立——本票据原本唯一的实质未知就此关闭。
3. 用户在自己 profile 上安装失败，查明是 pnpm 的 `minimumReleaseAge` 策略被**其它已装插件**的新版本触发，与本插件无关；成因与三种处理写进 README。
4. [票据 28](./28-merge-into-a-single-package.md) 合并为单包（spec 第 20 节），版本推进到 `0.1.0-rc.2`。
5. 两份 README 重写，去掉开发过程痕迹，只保留使用者需要的内容。

**当前阻塞：npm 撤回冷却**

用户撤回了两个包（UTC 2026-09-09T16:44:10 与 16:44:53）。`dsh-quick-actions-bundle` 的撤回正合意——单包合并后它已作废。但 `dsh-quick-actions` 一并被撤，触发 npm 的名字冷却：

```text
[E403] 403 Forbidden - PUT https://registry.npmjs.org/dsh-quick-actions
dsh-quick-actions cannot be republished until 24 hours have passed.
```

| 事实 | 值 |
|---|---|
| 解禁时间 | UTC 2026-09-10T16:44:53（本地 2026-09-11 00:45） |
| 名字归属 | `npm owner ls` 返回 `no admin found`；冷却期同时是名字保留期，他人抢不走 |
| 是否有绕过手段 | **没有**。这是 registry 服务端策略，`--force` 无效；唯一的外部途径是给 npm support 开工单，对自撤的新包标准答复就是等待 |
| `0.1.0-rc.1` | **永久作废**。npm 对已撤回的「名字 + 版本」组合永久拒绝，不止 24 小时。`0.1.0-rc.2` 与将来的 `0.1.0` 不受影响 |

等待期间**不要再撤回任何东西**，否则窗口从最后一次撤回重新计时。

曾评估但未采纳的两条绕行：改用带 scope 的 `@lovvvve/dsh-quick-actions`（scope 是独立命名空间，可立即发布，但推翻票据 20 的无 scope 决定，且与生态命名风格不一致）；换一个无 scope 新名字（刚为现名改过 32 个文件，且名字更差）。用户选择等待。

**窗口过后的剩余步骤**

1. `pnpm --filter dsh-quick-actions publish --no-git-checks --access public`（需 OTP，只有一条命令）。
2. 在全新 `DSH_HOME` 上复验单包形态的安装路径——此前那次验的是双包 rc。
3. 验证通过后发 `0.1.0`，README 的 tarball 文件名随之更新（`docs.spec.ts` 会强制两者同步）。
4. 去 `awesome-dsh-plugin` 提 PR 上架。

### 2026-09-10 — 上架要求已查清，条目已备好

读了策展仓库的 `contributing.md` 与其校验脚本 `scripts/check-submission.mjs`，条目存档在 [`verification/market-entry.yml`](../verification/market-entry.yml)，提交时改名为 `data/plugins/lovvvve__dsh-quick-actions--packages-composer-quick-actions.yml`。

**上架与 npm 是两条独立通道。** 指南写明 npm 发布只影响可发现性、**不影响上架资格**，所以 PR 不必等 npm 冷却窗口。但市场访客点安装走的是 npm，包不在会直接失败，因此仍应先发包再提 PR。

**monorepo 是本条目的关键约束。** 校验脚本会扫描仓库树里最多 40 个 `package.json` 找 `dsh.bundle`，但对「URL 指向仓库根而 bundle 在子包」的提交会拒绝并给出更正后的子包 URL。我们的 `dsh.bundle` 在 `packages/composer-quick-actions/package.json`，根 manifest 是私有 workspace 根，因此必须用子包形式：URL 指向子目录，`name` 加 `#<子目录名>` 后缀。后缀取子目录名而非包名，是照真实条目 `314857493/dsh-vision#vision-route` 反推；文件名的 `--packages-...` 段同样照搬其 monorepo 命名。

资格逐条核对：

| 要求 | 状态 |
|---|---|
| 子包 manifest 声明 `dsh.bundle` | 通过（票据 28 合并后正是指南给的结构） |
| 仓库至少 1 天 | 通过（首次提交 2026-09-04） |
| 真实可用代码、非占位、非纯元包 | 通过 |
| 未归档、在维护 | 通过 |
| 仓库带 `dsh-plugin` GitHub topic | **未完成，须用户在 GitHub 上添加**；本机无 `gh`，Agent 无法代劳 |

其它约束：一个 PR 最多三个条目；不得手改生成的 README；不得改动无关条目；描述须准确、无夸饰语，含 `: ` 时要加引号（本条目两条描述均不含）。`category` 取 `ui`，在其 23 个枚举值内。

### 2026-09-10 — 市场 PR 已提交；待办逐条对账

**PR：[awesome-dsh-plugin#4762](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/4762)**（OPEN、MERGEABLE，1 文件 6 行新增）。条目存档在 [`verification/market-entry.yml`](../verification/market-entry.yml)，提交时命名为 `data/plugins/lovvvve__dsh-quick-actions--packages-composer-quick-actions.yml`。

提交前用策展仓库自带的 `scripts/check-submission.mjs` 预检过。**直接跑会失败**：脚本在没有 PR 上下文时把全部 3432 条都当成新增，撞上「一个 PR 最多 3 条」的限制而退出 1。它支持 `--base <sha>`，用上游 `main` 的 sha 限定范围后得到 `checking 1 entry` → `ok` → `all checked entries pass`。

前置动作也一并完成：给 `lovvvve/dsh-quick-actions` 加了 `dsh-plugin` topic（CI 硬性检查项，此前为空），仓库描述改为一句话说明。`gh` 此前未安装，已免 root 装进 `~/.local/bin`；认证由用户经设备流完成，token 在其 keyring 中。

**CI 有一个 check 失败，与本条目无关。** `Submission gate` 通过；失败的是 `build-site`，报三个条目推导不出添加日期，全部属于 `wwweljf/dsh-plugins`，日志里不含本条目。属该仓库既有问题，等维护者处理。

#### 待办对账

| 项 | 状态 |
|---|---|
| 1、2 发布 | **未完成**，被 npm 撤回冷却挡到本地 2026-09-11 00:45 |
| 3 发布 bundle 包 | **已作废**（票据 28 合并为单包） |
| 4 全新 `DSH_HOME` 实测 | **部分完成**：`0.1.0-rc.1` 已验证单命令安装成立，但那是双包形态；单包下需在发布后复验 |
| 5 README 去掉「尚未发布」注记 | 完成，两份 README 均无此说法 |
| 6 市场 PR | 完成，见上 |

#### 验收标准对账

反转已落到票据 20、地图与 `CLAUDE.md` 三处；PR 链接已记录（本条）。仍缺两项：**单包形态在全新 `DSH_HOME` 上的安装复验**，以及**发布本身**。

### 2026-09-11 — `0.1.0-rc.3` 已发布；单包形态的陌生人安装路径复验通过

票据 29 修好并由用户在实时 DSH 上验证后，本票据解除阻塞。冷却窗口已过（解禁 UTC 2026-09-10T16:44:53）。

**发布过程有一次假失败，值得记下。** 用户执行发布时 pnpm 报 `[E409] Failed to save packument`，堆栈显示已过 `withOtpHandling`——即认证与 2FA 都成功，失败在 registry 写入。**但包其实发出去了**：

| 时刻（UTC） | packument 状态 |
|---|---|
| 2026-09-11T04:29:41 | `_rev: 3`，仍是墓碑（只记 `0.1.0-rc.1` 已撤回，无 `versions`）——这是 409 那一次 |
| 2026-09-11T04:31:05 | `created` 被重写，墓碑被全新 packument 取代 |
| 2026-09-11T04:31:06 | `_rev: 4`，`versions` 含 `0.1.0-rc.3`，`dist-tags.latest` 指向它 |

结论：**对一个被完整撤回的包名，首次重新发布会报 409，但随后仍会落库。** 遇到这个错误不要立刻重发，先查 `curl -s https://registry.npmjs.org/<name>` 的 `versions`——`npm view` 在墓碑阶段只会回 404，看不出真相。盲目重试可能造成重复发布或写坏状态。

**发布内容已核验**：把 registry 上的 tarball 下载回来，与当前 HEAD 重新 `pnpm pack` 的产物**逐字节一致**；`lib/client.js` 含 5 处 `attachmentIds` 与 10 处总读的 `Array.isArray`，即票据 29 的修复确在其中。`unpackedSize` 599.6 kB，`deps: none`，MIT。

**待办 4 关闭（本票据最后一项实质未知）。** 在全新 `DSH_HOME=/tmp/fresh-dsh` 上只跑那一条官方命令，不加 profile `overrides`、不指 tarball、不加任何标志：

```sh
DSH_HOME=/tmp/fresh-dsh dsh plugin --profile web add dsh-quick-actions
```

结果：`dsh: initialized profile web`（profile 自动创建）→ `+ dsh-quick-actions 0.1.0-rc.3` → `Done in 806ms`。`--dump-config` 能看到 `- id: composer-quick-actions` / `name: dsh-quick-actions`。profile 的 `package.json` 只有这一个依赖条目、**无 `overrides`**，`dsh.profile.bundles` 里也有它。单包形态因此确认收敛成一条命令，双包时代那条 `overrides` 彻底不需要了。

顺带澄清一个本可以写错的推断：包发布不到一小时，本以为 pnpm 的 24 小时 `minimumReleaseAge` 会挡住陌生人的首次安装。**实测不会**——pnpm 在非 strict 默认下对直接 `add` 的目标自动写一条 `minimumReleaseAgeExclude: [dsh-quick-actions@0.1.0-rc.3]` 而非报错。README 那节「被点名的包一个都不是本插件」的说法因此仍然准确，不用改。
