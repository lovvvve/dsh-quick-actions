# 执行集成与发布验证

Type: task
Mode: AFK
Status: resolved
Blocked by: 08, 13, 14, 15, 16, 17, 24

## Question（问题）

依据[定义验证与发布验收标准](./08-define-verification-and-release-acceptance.md)和[统一规格](../spec.md)（首版范围以 spec 第 16 节为准）执行完整自动化与 GUI 验收：构建产物、Host/Client 集成、三种布局、输入框等宽、宽窄响应式、发送确认与单飞、模型运行时 queue、失败草稿恢复、Settings 重启持久化、预置升级/降级、Host Config 变化、断线恢复、生命周期 stop/update 清理、占位符拒绝、Unicode code point/`trim()` 口径、结构化 Settings mutation outcome（成功/拒绝/conflict）、单飞窗口的公开状态判据与快速连续激活不重复发送、Resident Composer 公开判定、安装包和文档步骤。

**GUI 验证只有一个通道**：现有 `http://127.0.0.1:3080` 官方 DSH GUI，覆盖三种布局、紧凑管理入口、动作管理与持久化、发送动作经公共 `setDraft` + `submit` 完成，以及写入后失败草稿保留。首版不依赖 `insertText`，因此**不再创建隔离源码检出、不再应用核心补丁、不再启动第二个受管 GUI 服务器**；插入相关用例（选区、焦点、连续插入、撤销、能力 false→true→false 投影）随插入动作一并推迟。不得修改已安装 `node_modules`。

Command Send Action（命令发送动作）必须覆盖：`/` 开头判定、`confirm` 默认开启且可关闭、表单给出警示但不锁定、确认开启时面板包含无候选菜单说明、确认关闭时一键提交不弹面板、两种设置下执行路径与普通发送动作完全一致，以及关闭确认后重复规范化/重启/预置升级都不把 `confirm` 改回 `true`。

使用 0、1、6、25、50 个动作覆盖正常规模，并验证升级或 Host Config 变化形成的 53 个既有动作的无损超限降级；隐藏与停用动作计入这些规模。必须覆盖公开附件字段的已占用草稿判定。截图基线覆盖三种布局与桌面/窄布局。修复发现的缺陷并保存可复现证据。本票据到「自动化证据完整」为止，可全程 AFK 执行；最终人工验收由 [HITL 票据 21](./21-run-final-human-acceptance.md) 承担，地图目标由该票据而非本票据收尾。


## Comments（评论）

### 2026-09-08 — Catalog 通道改为 Settings base 层

spec 第 17 节取代第 6.2 节：目录不再经自有 Remote 发布，改由 Host 注册只读命名空间 `composer-quick-actions-catalog` 并以 composition `base` 层承载快照。本票据相应调整：

- 去掉「自有 Catalog Remote 契约、生成产物和卸载清理」验证项，改为「目录命名空间注册、`base` 快照契约与卸载清理」。
- 去掉按连接 generation 计目录 RPC 的用例，改为断言目录不产生专用 RPC。

### 2026-09-08 — 收口前需确认票据 22

票据 17 在核实 spec 第 15 节的两条前置项时发现「watch 关闭不得遗留临时 staging」（第 11.2 节）并不成立，已拆为[票据 22](./22-clean-client-staging-on-watch-close.md)。它属于第 11.2 节的发布要求，本票据的发布验证**收口之前**必须确认票据 22 已完成；`Blocked by` 未改动，因为本票据的其余验证不依赖它，可以并行推进。

**2026-09-09 补记**：票据 22 已 resolved——Client 产物改为从内存原子发布，bundler 的 scratch 目录不再参与发布并在每次构建开始与 `closeBundle` 时无条件清除，watch 失败后关闭已不留残留（真实功能包 + fixture 双向实测，四条用例加三次变异校验）。顺带修掉 `tsdown` 不 await `onSuccess` 导致发布异常打死 watcher 的既有缺陷。证据见 `verification/release-evidence.md` 的票据 22 节。本票据的收口前置条件至此全部清空。

同时，票据 17 已按 spec 第 13.1 节建立 `verification/release-evidence.md`，其中记录了本票据需要接续的内容：两个 tarball 的可复现解析方式、隔离 `DSH_HOME` 下的安装/卸载证据，以及尚未做的真实 GUI 实测清单。本票据应向该文件追加证据，而不是另起一份。

### 2026-09-08 — 打包验证不得改写工作树

票据 23 的独立审查发现 `pnpm test` 会删掉并重建工作树里线上的 `lib/`（`prepack` → `build` → `rmSync('lib')`，而打包契约在真实包目录执行 `pnpm pack`）。本票据要一边 `pnpm watch:client` 对着 `127.0.0.1:3080` 实测 watcher 与页面加载的关系、一边跑验证，带着这个缺陷开工会浪费一轮，因此已加入 `Blocked by`，见[票据 24](./24-isolate-pack-from-the-working-tree.md)。

**2026-09-08 补记**：票据 24 已 resolved——打包契约改为在仓库外的 workspace 副本里 `pnpm pack`，工作树 `lib/` 在 `pnpm test` 前后内容与 mtime 均不变；`pnpm watch:client` 与 `pnpm test` 并存已实测（watcher 存活、`lib` 指纹不变、`node --check lib/client.js` 通过），证据见 `verification/release-evidence.md` 的票据 24 节。本票据的 `Blocked by` 至此全部 resolved（`Blocked by` 行保留历史，不删项），可以直接开工；票据 22 仍须在收口前完成。

### 2026-09-09 — 第一轮：非发送项已在真实 DSH 上通过

按用户指示本轮不触发真实模型调用，只做非发送项。**票据仍为 `claimed`，未完成。**

已交付：`@playwright/test` + `pnpm verify:gui`（`tests/gui/`，不在 vitest include 内），36 条 = 12 条 × 桌面 / 768 / 360。结果 35 条一次过、1 条导航偶发重试即过。安装形态按 README 离线流程在**用户实时 DSH**（`npx @deepseek-ai/dsh@latest`，运行时 0.1.2-rc.1）上执行并逐条核对，收尾按用户指示卸载并核对回滚。完整证据见 `verification/release-evidence.md` 的票据 18 一节。

本轮关闭的两个历史挂起项：票据 14 的「Client 读 catalog `base` 端到端」（3 条预置真实渲染）与票据 23 的「primitives 在真实浏览器可用」（按钮同时带 primitives 哈希类与 `dsh-cqa-action`）。

下一轮开工前必读证据里的两节：**「下一轮必须先修的 harness 卫生问题」**（本轮测试误建了 2 条克隆动作，管理面板用例须改为严格只读，否则规模矩阵会被污染）与**卸载一节的 GUI 混淆说明**。

仍未覆盖：全部发送项、0/1/6/25/50 与 53 项超限降级、跨 DSH 重启持久化、重装恢复、生命周期 stop/update 清理、截图基线。

### 2026-09-09 — 第二轮：规模矩阵与跨重启持久化通过

**票据仍为 `claimed`。** 本轮新增 `scale.spec.ts` + `seed-scale.mjs` + `scale-round.sh`（规模按 spec 的成因写存量状态再启动 profile）与 `restart.spec.ts` + `restart-round.sh`（两趟之间真重启）。

结果：**规模六行 0/1/6/25/50/53 全部通过**——53 项被动超限渲染全部动作、`limit="overflow"` 且禁新增，50 项为 `reached`；**跨 DSH 重启后 Client 取回存储布局**。全套回归 45 通过 / 6 skipped / 0 失败，4.0 分钟。

上一轮列的两个前置坑已闭合：管理面板用例现在自带洁净断言与残留清理（克隆污染不会再累积）；卸载核对本轮在受控服务下重做了一遍，profile 两份配置与安装前逐字一致。

仍未覆盖（都需要许可或新决策）：**全部发送动作项**（单飞、确认面板、失败草稿保留、命令动作两种确认设置、queue —— 需真实模型调用许可）、重装后配置恢复、生命周期 stop/update 清理、截图基线。

### 2026-09-09 — 第三轮：发送路径与其余六项完成

用户明确许可真实模型调用（默认模型 GPT-5.6 Luna），上一轮列出的 **9 项全部闭合**，证据见 `verification/release-evidence.md` 第三轮一节。**票据仍为 `claimed`**——见下方剩余项。

本轮交付：`send.spec.ts` + `seed-send.mjs` + `send-round.sh`（6 条发送用例，含同 tick 只发一次、queue、占用草稿）、`lifecycle.spec.ts` + `lifecycle-round.sh`（断线只读 + 失败草稿保留 + 重连后无重复注册）、`host-config.spec.ts` + `host-config-round.sh`（`dsh --patch` overlay 声明预置，不改用户文件）、`screenshots.spec.ts` + 9 张裁剪基线。第二轮的审查修复也已在真实 DSH 上复验通过。

两个行为发现（记录而非判缺陷）：断线时插件不发布结果反馈（`retained` 只在 `submit()` 抛错时发布，而断线时 DSH 的 submit 既不抛也不落地）；Composer 动作控件用原生 `disabled` 而非 `aria-disabled` 表达不可用——CLAUDE.md 那条规则记的是管理面板键盘重排场景，不覆盖此处。

**收口前仍缺的四项**（都不需要模型调用，需再开一次安装窗口）：

1. **重装恢复**：卸载 → 重装 → 用户配置恢复（Settings 命名空间在卸载后保留、重装即回）。
2. **预置升级/降级的完整往返**：预置移除后既有数据保留为墓碑、重新加入后恢复、行为签名换 ID 的处理——模型层已有用例，GUI 层只验了「新增」这一半。
3. **结构化 mutation outcome 的 conflict 分支**：成功与拒绝（只读）已验，revision 冲突的 GUI 分类未验。
4. **占位符拒绝与 Unicode code point / `trim()` 口径**在集成运行里各跑一遍（模型层已覆盖，票据要求集成层也过一遍）。

### 2026-09-09 — 第四轮：最后四项闭合，本票据收口

第三轮列出的四项全部完成，均未触发模型调用，共开一次安装窗口：**重装恢复**（三段各一次启动）、**预置升级/降级的完整往返**（四段各一次启动）、**结构化 mutation outcome 的 conflict 分支**、**占位符拒绝与 Unicode code point / `trim()` 口径**。安装窗口本身已脚本化。详见 `verification/release-evidence.md` 的第四轮一节；结论见下面的 `## Answer`。

### 2026-09-09 — 票据 25 更正缺口 1 的成因

下面 `## Answer` 第 1 项行为发现（「执行机停在观察阶段，两个 `retained` 发布点都不触发」）经[票据 25](./25-close-two-edge-state-ux-gaps.md)对 `dsh-client-ui-conversation@0.1.2-rc.1` 的源码取证**不成立**：`submit()` 没有连接态检查，对普通文本一律同步执行 `default-sink` + `commit-draft`，草稿在 sink 失败之前就被乐观清空；引擎读到空草稿后按 spec 9.5 正常关闭单飞，文本随后由 DSH 自己的 `restoreFailedDrafts` 放回并伴随 DSH 的 error notice。结论也随之改变：插件行为正确，不加任何补充反馈。正文保留原记录不改，以票据 25 的 `## Answer` 为准。

## Answer（答案）

**自动化证据完整，本票据到此为止。** 第 13.2 节的行为矩阵已在模型 / Host / Client 三层加真实 GUI 四层全部有归属，没有需要真实 GUI 或模型调用的剩余项。最终人工验收仍归[票据 21](./21-run-final-human-acceptance.md)，它需要用户在一次性会话里亲自确认。

四轮的分工与结果：

| 轮次 | 覆盖 | 结果 |
|---|---|---|
| 第一轮 | 安装形态在真实 DSH 上逐条执行；Catalog `base` 端到端、常驻判定、三布局、等宽、窄视口、键盘与无障碍 | 36 条（12 × 三视口）通过；关闭了票据 14 与票据 23 的两个挂起项 |
| 第二轮 | 规模矩阵 0/1/6/25/50 与 53 项被动超限、跨 DSH 重启持久化 | 六行全过；harness 加上命名空间备份/还原 |
| 第三轮 | 发送路径六条（真实模型）、Host Config 变化、断线只读与失败草稿保留、生命周期 stop/update 清理、9 张截图基线 | 全过；修掉 `boot.sh` 一直静默失效的 `stop_ours` |
| 第四轮 | 重装恢复、预置往返、conflict 分支、占位符与 Unicode/`trim()` 口径 | 全过；安装窗口脚本化，关窗后 profile 逐字还原 |

### 本轮交付

| 文件 | 作用 |
|---|---|
| `tests/gui/install.sh` | 把 README 的本地 tarball 安装/卸载流程做成可复现驱动，并对 profile 的两份文件取 sha256 指纹 |
| `tests/gui/profile-override.mjs` | profile `overrides` 的唯一写入口：先逐字备份，再经 yaml 文档 API 写入，原子替换 |
| `tests/gui/close-window.sh` | 关窗：停服务 → 卸载 → 指纹校验 |
| `tests/gui/reinstall.spec.ts` + `reinstall-round.sh` | 重装恢复三段 |
| `tests/gui/presets.spec.ts` + `presets-round.sh` | 预置往返四段（overlay 经 `dsh --patch`，不改用户文件） |
| `tests/gui/conflict.spec.ts` | revision 冲突的竞态判据、刷新到权威、显式重试 |
| `tests/gui/validation.spec.ts` | 占位符拒绝、code point 与 `trim()` 口径 |
| `tests/gui/verify-round.sh` | 常规套件的驱动（种入已知命名空间 → 启动 → 跑 → 还原），可转发参数重跑单个 spec |
| `tests/gui/support.ts` | `enterSession(page, 'plugin' \| 'history')`、`storedNamespace()` |

### 三个记录在案的行为发现（都不改本版行为）

1. **断线时插件不发布结果反馈**（第三轮）。`retained` 的两个发布点是「`submit()` 抛错」与「提交后的下一次 Input 提交里草稿仍未清空」；断线时 submit 不抛错，DSH 也不再发布任何 Input 提交，于是执行机停在观察阶段，用户看到文本留在草稿里却没有说明。第 9.5 节的零内容丢失不受影响。
2. **Composer 动作控件用原生 `disabled` 而非 `aria-disabled`**（第三轮）。CLAUDE.md 那条规则记的是票据 16 的管理面板键盘重排场景，不覆盖此处，故不判偏离。
3. **管理面板的表单不接管开场焦点**（第四轮）。于是点「编辑」/「新建」后按 Escape 会关掉整个面板而不是只退出表单——`modal.ts` 注释所述的意图只在焦点已在表单内时成立。

第 1 与第 3 项是可改进的用户可见缺口，已合并立为[票据 25](./25-close-two-edge-state-ux-gaps.md)；两者都不阻塞票据 21。

### 唯一未逐字执行的步骤

README 升级/降级里的「override 与 `add` 指向**另一个版本**的两个 tarball」需要第二个版本，而两个包按[票据 20](./20-choose-publishing-identity-and-license.md) 的决定**暂不发布**，本地只有 `0.1.0`。该步骤的机械部分（override 改指向、重复 `add` 的幂等、重启）本轮已执行，其数据侧后果（目录增删、墓碑、往返无损）由第四轮的预置往返四段覆盖。发布之后应补这一条。

### 环境归还

每一轮都在用户自己的实时 DSH 上开临时窗口并在收尾关闭。第四轮关窗后核对：`profiles/web/package.json` 与 `pnpm-workspace.yaml` 的 sha256 与开窗前**逐条匹配**、功能包已移出 profile `node_modules`、`cordis.patch.yml` 零引用、`<DSH_HOME>/settings.yaml` 只剩用户自己的 4 个命名空间、harness 备份已消费删除、端口 3080 关闭。
