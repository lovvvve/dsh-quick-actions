# 独立操作栏本地包安装记录

关联：[备份 web profile 并安装独立操作栏本地包](../issues/43-install-local-footer-packages.md)。用户明确授权先备份并安装，重启由用户在桌面端执行。本次**已安装，等待重启与 GUI 验收**。

## 备份与固定包来源

- 完整备份目录：`/Users/lovvvve/.dsh/backups/quick-actions-footer-20260928T100220Z/`，权限 0700。
- 原 profile 在其 `web/` 子目录，包含 node_modules、manifest、lockfile、workspace 配置与 Settings patch；保留符号链接文本。`inventory.json` 保存文件哈希、模式、链接目标。
- 复制前后原目录、复制结果三方清单一致：**18,361 项**。安装后再次核对备份清单仍一致；12 个外部插件链接文本未变。外部链接不跟随复制，恢复原 profile 路径时恢复其原有解析语义。
- 两份已验证 tarball 固定在 `/Users/lovvvve/.dsh/local-packages/quick-actions-footer-20260928T100220Z/`，逐字节匹配[构建 hash 清单](../core/bar-footer/artifacts-manifest.json)。不依赖临时源码路径。
- 结构化指纹与安装状态见[安装 receipt](./footer-install-receipt.json)。没有移动、删除或恢复任何会话历史目录。

## 实际安装

使用当前桌面 DSH 安装的 CLI（不是源码 CLI）执行：

```sh
DSH_HOME='/Users/lovvvve/.dsh' CI=true \
HTTPS_PROXY=http://127.0.0.1:9999 HTTP_PROXY=http://127.0.0.1:9999 \
/opt/homebrew/bin/node \
  '/Users/lovvvve/Library/Application Support/dsh-tauri/dependencies/dsh/node_modules/@deepseek-ai/dsh/lib/bin.js' \
  plugin --profile web add \
  '/Users/lovvvve/.dsh/local-packages/quick-actions-footer-20260928T100220Z/deepseek-ai-dsh-client-ui-conversation-0.1.7-rc.2.tgz' \
  '/Users/lovvvve/.dsh/local-packages/quick-actions-footer-20260928T100220Z/dsh-quick-actions-0.2.0-rc.2.tgz'
```

命令 **exit 0**，实际 DSH 管理的 pnpm 为 `11.22.0`；供应链策略通过，没有绕过年龄门槛或版本兼容审批。完整日志在备份目录的 `install.log`，权限受限。

输出中「conversation declares no dsh.bundle — installed as a plain dependency, not a profile layer」为预期：它覆盖原 profile 的包解析，但不新增第二个 Loader/bundle 条目。还有既有 peer 警告和 node-domexception 弃用提示，未自动放行额外版本。

## 安装后验证

- 仅两项直接依赖变化：新增本地 conversation tarball；Quick Actions 从 registry spec 改为本地 tarball。**bundle 列表及其顺序不变**。
- 两份实际安装的 `lib/client.js` SHA-256 与构建清单相同；不是只校验文件名或版本号。
- `cordis.patch.yml`、`pnpm-workspace.yaml` 与备份逐字相同。桌面安装锚点的 manifest、锁文件、原 conversation JS 哈希均不变。
- 其他直接插件可从备份比较的 11 个 manifest/Client 文件不变；外部插件链接另以符号链接文本检查，12 项全部不变。
- CLI 显示 `Packages: +3 -33`。已进一步检查 lockfile：只移除 registry Quick Actions key、加入两个本地 tarball key；所有共同 snapshot 条目不变。唯一其他 metadata 差异是 `dsh-prompt-history@1.2.15` 补入显式 `version: 1.2.15`，原 integrity/peer/engine 全相同，**没有升级或替换其内容**。
- GUI HTTP 200，监听 PID 仍是 12684；未执行重启、停止或另起服务。

## 当前加载状态与下一步

安装后的实际 bootstrap 模块表和 bundle 内容已只读核对：

| 模块 | 当前 rev | 当前来源 |
|---|---|---|
| conversation | `da71fb918a5c` | 仍是桌面安装的旧核心，尚无 footer |
| Quick Actions | `04f16d465557` | 已热加载本地新插件，含 footer 兼容逻辑 |

这是预期的重启前状态：新插件会回退旧核心的原位置。**页面位置未完成验收，不能宣称已经独立换行。**

请用户通过桌面应用正常重启 DSH 一次；可能短暂断连。重新连接后确认仍为 3080，读取新的 bootstrap 精确 URL，核对两份 bundle 来自已安装本地包，然后验收 bar 在统计行下方、左对齐输入框且仅一份、原统计信息保留、窄屏折叠稳定。不要对旧 rev 的响应作假成功判断，也不要通过真正发送模型请求来验证布局。

## 回滚入口

已有完整快照，不依赖重新下载 registry 包。若重启后启动或界面异常：通过桌面应用停止该 DSH，保留失败 profile 到独立目录，将备份的 `web/` 完整恢复至原 profile 路径，核对 receipt 中原始四文件哈希，再正常启动。**不能在后端仍运行时直接覆盖整棵 profile**，不能只还原 manifest 而保留新 node_modules。细节沿用[回滚方案](./footer-deployment-plan.md)。
