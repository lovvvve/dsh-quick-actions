# 实现快捷动作共享领域模型

Type: task
Mode: AFK
Blocked by: 11

## Question（问题）

以测试驱动方式实现 `src/model/` 深模块，完整落实[制定快捷动作的数据结构与预置合并规则](./05-specify-action-schema-and-preset-merge.md)和[确定运行时与失败语义](./06-decide-runtime-and-failure-semantics.md)：类型、预置配置验证、Settings V1 解码、向后兼容迁移、确定性规范化、目录 revision、预置与用户状态合并、可见/暂不可用状态，以及 revision-fenced Settings mutation 计划。接口必须保持纯 JSON 输入输出，不依赖 Host、Client、React 或存储实现。覆盖预置目录最多 50、正常合计最多 50，以及升级导致既有状态被动超限但不丢数据的派生状态与 mutation 限制。
