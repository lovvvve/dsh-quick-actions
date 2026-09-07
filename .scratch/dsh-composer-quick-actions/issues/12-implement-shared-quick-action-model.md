# 实现快捷动作共享领域模型

Type: task
Mode: AFK
Status: resolved
Blocked by: 11

## Question（问题）

以测试驱动方式实现 `src/model/` 深模块，完整落实[统一规格](../spec.md)（**首版范围以 spec 第 16 节为准**）及[制定快捷动作的数据结构与预置合并规则](./05-specify-action-schema-and-preset-merge.md)、[确定运行时与失败语义](./06-decide-runtime-and-failure-semantics.md)：类型、预置配置验证、Settings V1 解码、向后兼容迁移、确定性规范化、目录 revision、预置与用户状态合并、可见/暂不可用状态，以及 revision-fenced Settings mutation 计划。

首版只有 Send Action（发送动作），不实现能力检测、不实现兼容性抑制投影。数据契约**保留 `kind` 判别式且恒为 `'send'`**：它不是配置项，规范化统一写出该标签（spec 第 4.1、16.1 节）。非 `'send'` 值分两条路径——Host `Config.presets` 中出现即作者错误，使配置加载失败；已存储用户数据中出现则按 spec 第 5.3 节**保留为墓碑**（不显示、不计入总量、不可编辑、规范化不得删除或改写），使更高版本降级回首版时数据无损，升级回去后原样恢复。保留该标签的目的是让未来加入插入动作时无需提升 `schemaVersion`、无需改写既有用户数据。

按 spec 第 4.3 节落实：DSH 公开保留引用占位符的字段级拒绝、Unicode code point 计数、ECMAScript `trim()` 口径，以及 **Command Send Action（命令发送动作）判定** —— 首个非空白字符为 `/` 时配置有效，`confirm` 沿用发送动作的通用默认值 `true` 且用户可关闭。**规范化不得依据文本改写 `confirm`，一律透传既有值**：默认只在创建与克隆时初始化，否则用户关闭确认后每次规范重写都会被改回，既毁掉用户选择也违反幂等要求。测试须覆盖 `/` 开头、前置空白后为 `/`、非 `/` 开头的判定，以及"关闭确认后重复规范化、重启、预置升级都不改回 `true`"。按第 5.4 节落实软件包升级与 Host Config 变化共同的 50 项被动超限无损降级。

接口必须保持纯 JSON 输入输出，不依赖 Host、Client、React 或存储实现。覆盖预置目录最多 50、正常合计最多 50（隐藏与停用动作计入），以及既有状态被动超限但不丢数据的派生状态与 mutation 限制。

## Answer（答案）

共享领域模型落在 `packages/composer-quick-actions/src/model/`，为纯 JSON 输入输出的深模块，不依赖 Host、Client、React、cordis 或任何存储实现（`src/` 下无 `node:` 内建导入，只用 `Intl.Segmenter`、`TextEncoder`、`BigInt` 这类 Host/Client 双端都具备的平台能力）。九个文件按关注点切开：`types.ts`（领域类型与 issue 词汇）、`text.ts`（Unicode 原语）、`validation.ts`（唯一校验规则源）、`catalog.ts`（预置目录合并与 revision）、`settings.ts`（V1 解码）、`normalize.ts`（确定性规范化）、`projection.ts`（派生投影与计数）、`mutations.ts`（revision-fenced 写入计划）、`index.ts`（桶）。

**`kind` 判别式**：规范化统一写出 `kind: 'send'`，它不是配置项。非 `'send'` 值按 spec 第 16.1 节分两条路径——Host `Config.presets` 中出现使 `buildPresetCatalog` 返回 `{ scope: 'preset', field: 'kind', reason: 'unsupported' }` 并令配置加载失败；已存储用户数据中出现则按 `QuickActionTombstone` 原样保留，`decodeStoredQuickAction` 对墓碑按引用返回，不显示、不计数、不可编辑、规范化不删不改。降级往返测试覆盖「更高版本快照 → 读取 → 新建 + 排序 + 换布局 → 墓碑值与顺序位置逐字节不变」。任何可读记录都保留为墓碑（含 `kind` 非字符串的畸形值），只有非对象值无法表达而丢弃。

**`confirm` 透传**：默认值只在 `newQuickActionDraft()`（创建）与 `planClonePresetQuickAction`（克隆按原样复制）初始化。规范化绝不依据文本改写；测试固定「关闭确认后重复规范化、预置目录升级都不改回 `true`」，以及「预置声明 `confirm: false` 的命令动作按声明值保留」。

**Command Send Action 判定**：`isCommandSendActionText` 用 `trimStart().startsWith('/')`，覆盖 `/` 开头、前置空白后为 `/`、非 `/` 开头三种；投影以 `ProjectedQuickAction.command` 暴露给表单与确认面板。

**校验口径**：标签去首尾空白后 1–40 Unicode code point，文本保留空白但非全空白且 ≤4000 code point，空白一律用 ECMAScript `trim()`，图标 1–4 个 emoji 字素簇（`Intl.Segmenter` 分簇 + Extended_Pictographic / keycap / regional-indicator 判定）。保留引用占位符集合为 `U+E100–U+E11D` 与 `U+FFFC`，取自实机 `@deepseek-ai/dsh-client-ui-conversation` 的 `REFERENCE_PLACEHOLDER_RE`（`setDraft` 在重建草稿前套用它），在 0.1.1-rc.2 与 0.1.2-rc.1 中一致；`lib/types/client/input/machine.d.ts` 公开了其尾项 `PLACEHOLDER = "\uFFFC"`。出处已写进 `text.ts` 的注释，支持的 DSH 版本区间变动时须复核。

**目录与 revision**：内置清单声明顺序在前、Host `Config.presets` 在后；无效预置、重复 Preset Action ID、目录超过 50 项都使配置加载失败并给出 `source`/`index`/`id`/`field`/`reason`。`revision` 为规范目录逐字段规范序列化后的 FNV-1a 128 位十六进制，测试固定「同目录稳定」与「标签/文本/图标/confirm/ID/顺序任一变化都改变 revision」。内置清单的具体数据属 Host territory（票据 13），模型只合并被交进来的内容。

**规范化**：重复引用取首次、失效自定义引用删除、未知预置引用与其 `presetStateById` 保留、墓碑不新铸引用、缺失的已知动作按「预置目录顺序 → 自定义存储顺序」追加；结果幂等且对同一输入与目录稳定。规范化同时把每个存活动作重述为显式 `kind`/`confirm`/`enabled`（spec 第 4.3 节要求落在规范化层，而不仅是解码层）。预置状态保留更高版本写入的未知字段，只把 `hidden` 归一。

**计数与被动超限**：`total` 计已知预置加全部存活自定义动作（隐藏与停用计入），未知预置与墓碑不计入而单列 `preserved`；`canAdd` 在 50 处关闭新增与克隆，`overflow` 在被动超限时为真且不丢任何数据，编辑/停用/删除/隐藏/排序继续可用。矩阵覆盖 0/1/6/25/50 与「50 自定义 + 升级新增 3 预置 = 53」。`projectQuickActions` 先对入参规范化，因此调用方递进非规范快照时计数仍是真实总量，不会有动作绕过上限。

**Mutation 计划**：九个 planner 返回 `{ expectedRevision, next, changed }` 或结构化 refusal（`invalid-fields` / `limit-reached` / `unknown-action` / `id-in-use` / `invalid-order`）。模型不生成身份：Custom Action ID 由调用方铸造，重复时以 `id-in-use` 退回让调用方重铸，规范化绝不改写既有合法 ID。排序把保留引用钉在原下标上，因此重排不扰动更高版本拥有的数据。

### 审查处置

两轴独立审查（Standards / Spec）的处理：已修 —— `counts.tombstones` 改名 `preserved`（未知预置不是墓碑）、`refKey` 四处重复收敛为导出的 `quickActionRefKey`、`planReorderQuickActions` 重复建集合、create/clone/update 的值构造与身份守卫抽公共、`record` 改名 `asRecord`、6 个导出类型补 JSDoc、`unknownAction` 统一为函数声明、测试 fixture 抽到 `tests/model/support.ts`（并把 `tsconfig.test.json` 的 include 扩到 `packages/**/tests/**/*.ts` 使其受类型检查）、预置状态未知字段保留、占位符出处写入注释。

以下经核实后**不采纳**并记录理由：

- 「预置 `confirm` 缺省应响亮失败」——spec 第 4.2 节明确规定发送动作 `confirm` 默认 `true`，第 5.1 节约束的是同一 ID 不得**改变**该值，而非作者必须声明。缺省填默认是规范要求。
- 「模型应强制预置的不可变安全行为签名」——模型没有上一版目录，也不允许把预置定义或其签名复制进用户状态（spec 第 4.2 节禁止新增未定义字段）。首版数据契约下无法检测同 ID 的 `confirm` 翻转，这是作者契约，不是模型可执行的约束。
- 「模型应提供 Unavailable Quick Action 投影」——spec 第 3 节的暂不可用取决于当前草稿占用、原生 guard 与提交阶段，需要活的 Input snapshot，而票据 12 要求接口不依赖 Client 运行时；第 16.4 节又把该判据的查证与测试固定交给票据 15。已在 `projection.ts` 注释中显式记录这条边界：`hidden` 只承担 Hidden 投影，Composer 列表由会话层叠加禁用态。
- 「`PresetActionId`/`CustomActionId` 应做成品牌类型」——spec 第 4.1 节把二者声明为 `string`，品牌化会在每个 JSON 边界引入断言，且现有 planner 用具名字段传参（`{ presetId, id }`），误用需要主动写错标签。
- 「`deepEqual` 属过度泛化，应改为规范 JSON 比较」——墓碑携带的是更高版本写入时的键序，结构比较正是为了不依赖键序回答「这次写入是否会改变什么」。已在注释中说明理由。

`src/types.ts` 依审查意见收敛为纯类型入口（`export type *`），运行期规则暂留包内：Host 与 Client 从 `src/model/` 引用，是否发布为运行时导出交给发布面决策（票据 17/20）。已在隔离目录用 `tsc --noEmit` 验证下游可从 `lib/types/types.d.ts` 消费该契约。

### 新鲜验证

`pnpm test` 140/140 通过（含 `tools/dsh-client-bundle` 的 12 条构建契约测试）、`pnpm typecheck` 通过（生产、测试、fixture 与 `tsdown.config.ts` 两遍）、`pnpm lint` 0 warning / 0 error、清理 `lib/` 后 `pnpm build` 通过。
