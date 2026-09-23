# 把 GUI round 驱动移植到 profile 承载的 Settings

Type: task
Mode: AFK
Status: open
Blocked by: 31

## Question（问题）

`tests/gui/` 的 round 驱动（`settings-namespace.mjs`、`scale-round.sh`、`send-round.sh`、`support.ts`、`acceptance.spec.ts` 等）按 DSH `0.1.5` 线的布局编写：种子数据与备份/还原都读写 `<DSH_HOME>/settings.yaml` 的 `composer-quick-actions` section，目录断言依赖只读命名空间 `composer-quick-actions-catalog`。票据 31 把插件改到 DSH `0.1.7` 的 Settings 表单模型之后（spec 第 22 节），这套驱动在新线上不再对应任何真实存储。

要做：

1. 种子、备份、还原改为操作 active profile 的 `cordis.patch.yml` 里 `id: composer-quick-actions` 那一行的 `config`（五个状态字段；`presets` 另行处理），并保持「收尾逐字还原 profile 与 patch」的指纹校验。
2. 去掉对 `composer-quick-actions-catalog` 的一切引用；目录断言改为读 Client 重建的目录。
3. 补一轮旧文档导入的验证：预置 `settings.yaml` → 首次启动 → `settings.yaml.imported` + profile patch 出现该行。

### 前置条件

唯一的 GUI 通道 `http://127.0.0.1:3080`（非本项目启动）运行的必须是 DSH `0.1.7` 线。票据 31 收尾时它仍是 `0.1.5` 线（2026-09-18 以 `npx @deepseek-ai/dsh@latest` 启动），切换由用户决定。

## Comments
