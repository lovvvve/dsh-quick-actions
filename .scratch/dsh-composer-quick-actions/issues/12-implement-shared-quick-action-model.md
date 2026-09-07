# 实现快捷动作共享领域模型

Type: task
Mode: AFK
Blocked by: 11

## Question（问题）

以测试驱动方式实现 `src/model/` 深模块，完整落实[统一规格](../spec.md)及[制定快捷动作的数据结构与预置合并规则](./05-specify-action-schema-and-preset-merge.md)、[确定运行时与失败语义](./06-decide-runtime-and-failure-semantics.md)、[将 insertText 补丁集成到 DSH 官方发布](./19-upstream-insert-text-and-record-release.md)记录的能力自适应边界：类型、预置配置验证、Settings V1 解码、向后兼容迁移、确定性规范化、目录 revision、预置与用户状态合并、可见/暂不可用/兼容性抑制状态，以及 revision-fenced Settings mutation 计划。按 spec 第 4.3 节落实 DSH 公开保留引用占位符的字段级拒绝、Unicode code point 计数和 ECMAScript `trim()` 口径，按第 5.4 节落实软件包升级与 Host Config 变化共同的 50 项被动超限无损降级。接口必须保持纯 JSON 输入输出，不依赖 Host、Client、React 或存储实现；兼容性抑制插入动作仍允许配置并计入动作总量，但不进入 Composer 可执行动作投影，能力可用后自动恢复。覆盖预置目录最多 50、正常合计最多 50，以及既有状态被动超限但不丢数据的派生状态与 mutation 限制。
