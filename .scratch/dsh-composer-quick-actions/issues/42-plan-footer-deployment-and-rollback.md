# 核对独立操作栏的部署入口与回滚方案

Type: task
Status: resolved
Labels: ready-for-human
Blocked by: 41

## Question

当前运行中的 DSH 从哪里加载核心 conversation 与 Quick Actions，如何通过受支持入口部署两份本地补丁包，并在失败时恢复原环境？

## Scope

用户同意继续核对部署入口与回滚方案；实际替换、配置修改或重启前再次确认。本轮只读运行环境，不安装、不修改 profile 或已安装依赖、不起停服务器。研究限本机运行事实和官方源码。

## Initial evidence

- `lsof` 确认 3080 端口由 PID 12684 的 Node 监听，3081 当前没有监听进程。
- PID 12684 cwd 为 DSH 桌面应用的依赖安装目录；`http://127.0.0.1:3080/` 返回 HTTP 200。
- 前次构建报告末尾写成 3081 是记录错误，本轮更正。以实际活动 3080 为唯一 GUI 通道。

## Answer

已完成部署前置环境核对，[部署与回滚方案](../verification/footer-deployment-plan.md)已记录，实际操作待用户授权。

- 当前 conversation 来自桌面 DSH 安装锚点，Quick Actions 来自 `~/.dsh/profiles/web`；已从实际页面 bootstrap 获得精确模块 URL，并比对所服务 JS 与这两个来源一致（扣除 sourceURL/运输分号）。
- 当前版本支持 profile 本地普通依赖优先于安装锚点回退，可用现有 CLI `plugin --profile web add <core.tgz> <plugin.tgz>`，不需覆盖应用自带依赖。core 不声明 bundle，作为普通 dependency 覆盖；不添加第二个 Loader row。
- **首次本地覆盖核心包要求重启**：源码和当前安装的 app-boot 均有显式拒绝热替换的判断。当前进程由桌面应用管理，建议用户正常重启，不在本会话里盲杀进程或另起服务器。
- 完整 profile 约 190 MB，备份到受限权限、时间戳目录；保留锁文件、patch 和完整 node_modules 以离线回滚。部署异常时停止 DSH、保留失败树、恢复完整快照后正常启动。会话历史目录不动。
- 没有安装、备份、重启或改写运行环境；本票据只完成核对与方案，不表示页面已更新。待明确同意后才开始备份/安装，重连后须做真实 GUI 验收。
