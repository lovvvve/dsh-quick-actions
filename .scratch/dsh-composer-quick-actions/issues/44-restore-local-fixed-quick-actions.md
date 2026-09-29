# 安装本机最新的 Quick Actions 修复包

Type: task
Status: resolved
Labels: ready-for-human
Blocked by: 43

## Question

用户重启后核心 footer 已加载，但 Quick Actions 被移出了 profile。如何按用户新授权安装本机已验证的修复包，保留当前核心和配置，不恢复旧 profile？

## Authorization

用户明确要求「安装本机最新的修复版本」。只安装 Quick Actions 本地包，不重装核心、不回滚整个 profile、不重启、不发布。先备份当前状态，避免使用已过时的首次安装快照覆盖用户后续操作。

## Answer

安装成功，当前服务已同时提供核心 footer 与 Quick Actions 修复代码；尚不冒充视觉验收通过。

- 使用已校验的本地 `0.2.0-rc.2` 修复 tarball，SHA-256 与原构建清单一致，Client 字节也与当前工作区构建一致；不是 registry 上的同版本原包。
- 安装前完整备份当前 profile，32,610 项三方清单一致。新备份位于 `/Users/lovvvve/.dsh/backups/quick-actions-restore-20260929T020122Z`，没有使用首次安装快照回滚用户后续变更。
- 经当前 DSH CLI 只 `add` Quick Actions 本地 tarball，exit 0；安装日志在新备份目录。没有放宽供应链或版本策略。
- 只新增 Quick Actions 直接依赖和单一 bundle；其他依赖与原 bundle 相对顺序不变，核心 JS 与安装前一致。
- Settings patch 新增一个默认 `composer-quick-actions` 行，布局为 bar，之前没有该行；所有既有配置行逐项相同，workspace 策略和共同 lock snapshots 不变。没有恢复或覆盖旧设置。
- 当前 3080 模块表：核心 rev=`452ad05ef96c`，Quick Actions rev=`f6db199a0cbd`；两者实际提供的代码均与本地修复文件匹配，含 footer 逻辑。无需为了这次插件恢复再重装核心或重启。

机器可读状态见[恢复安装 receipt](../verification/footer-restore-receipt.json)。用户可以刷新页面查看；独立行/左对齐/窄屏行为的真实视觉验收仍须单独记录。
