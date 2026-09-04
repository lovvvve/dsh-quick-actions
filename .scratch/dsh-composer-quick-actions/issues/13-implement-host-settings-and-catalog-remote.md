# 实现 Host Settings 与预置目录 Remote

Type: task
Mode: AFK
Blocked by: 12

## Question（问题）

实现 Host 插件入口：验证并合并内置预置与 `Config.presets`，注册 `composer-quick-actions` Settings namespace，执行兼容读取后的幂等 revision-fenced 规范重写，并发布仅含 `describeCatalog(): Promise<CatalogSnapshot>` 的生成式 `remote.composerQuickActions`。所有注册、观察器和 Remote 必须归 Host fiber；`settings` 缺失时进入等待，不创建替代存储。覆盖重复 ID、无效配置、迁移冲突、重启后预置变化和 Remote JSON 契约测试。
