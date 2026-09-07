# 实现快捷动作共享领域模型

Type: task
Mode: AFK
Blocked by: 11

## Question（问题）

以测试驱动方式实现 `src/model/` 深模块，完整落实[统一规格](../spec.md)（**首版范围以 spec 第 16 节为准**）及[制定快捷动作的数据结构与预置合并规则](./05-specify-action-schema-and-preset-merge.md)、[确定运行时与失败语义](./06-decide-runtime-and-failure-semantics.md)：类型、预置配置验证、Settings V1 解码、向后兼容迁移、确定性规范化、目录 revision、预置与用户状态合并、可见/暂不可用状态，以及 revision-fenced Settings mutation 计划。

首版只有 Send Action（发送动作），不实现能力检测、不实现兼容性抑制投影。数据契约**保留 `kind` 判别式且恒为 `'send'`**：它不是配置项，规范化统一写出该标签（spec 第 4.1、16.1 节）。非 `'send'` 值分两条路径——Host `Config.presets` 中出现即作者错误，使配置加载失败；已存储用户数据中出现则按 spec 第 5.3 节**保留为墓碑**（不显示、不计入总量、不可编辑、规范化不得删除或改写），使更高版本降级回首版时数据无损，升级回去后原样恢复。保留该标签的目的是让未来加入插入动作时无需提升 `schemaVersion`、无需改写既有用户数据。

按 spec 第 4.3 节落实：DSH 公开保留引用占位符的字段级拒绝、Unicode code point 计数、ECMAScript `trim()` 口径，以及 **Command Send Action（命令发送动作）判定** —— 首个非空白字符为 `/` 时配置有效，`confirm` 沿用发送动作的通用默认值 `true` 且用户可关闭。**规范化不得依据文本改写 `confirm`，一律透传既有值**：默认只在创建与克隆时初始化，否则用户关闭确认后每次规范重写都会被改回，既毁掉用户选择也违反幂等要求。测试须覆盖 `/` 开头、前置空白后为 `/`、非 `/` 开头的判定，以及"关闭确认后重复规范化、重启、预置升级都不改回 `true`"。按第 5.4 节落实软件包升级与 Host Config 变化共同的 50 项被动超限无损降级。

接口必须保持纯 JSON 输入输出，不依赖 Host、Client、React 或存储实现。覆盖预置目录最多 50、正常合计最多 50（隐藏与停用动作计入），以及既有状态被动超限但不丢数据的派生状态与 mutation 限制。
