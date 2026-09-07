# 实现 Host Settings 与预置目录 Remote

Type: task
Mode: AFK
Blocked by: 12

## Question（问题）

实现 Host 插件入口：验证并合并内置预置与 `Config.presets`，注册 `composer-quick-actions` Settings namespace，执行兼容读取后的幂等 revision-fenced 规范重写，并发布仅含 `describeCatalog(): Promise<CatalogSnapshot>` 的生成式 `remote.composerQuickActions`。按规格第 6.1 节使用 `@deepseek-ai/dsh-settings-file` 后端；Host 独占验证与迁移权威，绝不绕过 Settings 访问原始文件或 storage backend。所有注册、观察器和 Remote 必须归 Host fiber；`settings` 缺失时进入等待，不创建替代存储。覆盖重复 ID、超过 50 个预置、无效配置、迁移冲突、重启后预置变化和 Remote JSON 契约测试；基于目标 DSH 实际生成式/运行时契约证明 Remote 装配可用，在关键装配契约核实前不声称 Remote 已可用。
