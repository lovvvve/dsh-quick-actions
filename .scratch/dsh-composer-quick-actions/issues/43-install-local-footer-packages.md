# 备份 web profile 并安装独立操作栏本地包

Type: task
Status: resolved
Labels: ready-for-human
Blocked by: 42

## Question

如何在保留完整可离线回滚的 web profile 快照后，经现有 DSH 包管理入口安装已验证的 conversation 核心补丁和 Quick Actions 适配包，并保持用户 Settings 与当前服务不被擅自重启？

## Authorization

用户明确回复「确认，按你刚才说的做」，授权先备份并安装；安装后请用户在桌面端重启，重连后另行真实 GUI 验收。本轮不重启、不另起服务器，不覆盖桌面安装依赖，不删除会话历史，不发布。

## Initial checks

本轮重新确认 3080 仍由 PID 12684 监听，GUI HTTP 200，可用空间约 679 GiB。执行依据为[部署与回滚方案](../verification/footer-deployment-plan.md)，安装前重新取样 profile 而不盲用前一轮指纹。

## Answer

**完整备份与安装已完成，等待用户在桌面端重启；不是 GUI 验收通过。**

- 完整 profile 快照已保存，18,361 项文件/目录/链接复制与安装后复核一致；备份权限 0700，可在停服后离线恢复。
- tarball 已固定到 Harness home 的独立本地目录，并再次按构建 SHA-256 校验。
- 现有 DSH CLI `plugin --profile web add` 安装两包 exit 0；core 为普通依赖，没有新增 bundle row，Quick Actions bundle 顺序不变。
- 实际安装 JS 与构建 hash 一致；Settings patch、workspace 配置和桌面应用安装锚点指纹不变。未发真实模型请求，未动会话历史，未重启。
- 当前核心仍是旧 rev `da71fb918a5c`，新插件已热加载为 `04f16d465557` 并回退旧位置。用户正常重启后再核对新核心和真实布局。

完整命令、依赖变动解释、备份路径与回滚入口见[安装记录](../verification/footer-install.md)；机器可读状态见[安装 receipt](../verification/footer-install-receipt.json)。不要在下一轮重复安装或盲目还原，先根据当前运行状态接续验收。
