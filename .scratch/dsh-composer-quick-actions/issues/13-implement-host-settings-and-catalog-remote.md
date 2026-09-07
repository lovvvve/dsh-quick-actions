# 实现 Host Settings 与预置目录 Remote

Type: task
Mode: AFK
Blocked by: 12

## Question（问题）

实现 Host 插件入口：验证并合并内置预置与 `Config.presets`，注册 `composer-quick-actions` Settings namespace，执行兼容读取后的幂等 revision-fenced 规范重写，并发布仅含 `describeCatalog(): Promise<CatalogSnapshot>` 的生成式 `remote.composerQuickActions`。按规格第 6.1 节使用 `@deepseek-ai/dsh-settings-file` 后端；Host 独占验证与迁移权威，绝不绕过 Settings 访问原始文件或 storage backend。所有注册、观察器和 Remote 必须归 Host fiber；`settings` 缺失时进入等待，不创建替代存储。预置校验复用票据 12 的共享模型：预置不声明 `kind`，规范化统一写出 `'send'`；`Config.presets` 中出现非 `'send'` 的 `kind`（含 `'insert'`）时按 spec 第 5.1 节使插件配置加载失败，不得静默忽略；声明 `/` 开头文本的预置为 Command Send Action（命令发送动作），其 `confirm` 按作者声明值保留——包括显式的 `false`，规范化不得依据文本改写它（spec 第 4.3、16.1 节）。覆盖重复 ID、超过 50 个预置、无效配置、迁移冲突、重启后预置变化和 Remote JSON 契约测试；基于目标 DSH 实际生成式/运行时契约证明 Remote 装配可用，在关键装配契约核实前不声称 Remote 已可用。
