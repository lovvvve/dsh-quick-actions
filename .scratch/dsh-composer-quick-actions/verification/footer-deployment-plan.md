# 独立下方操作栏：部署与回滚方案（待授权执行）

关联：[核对独立操作栏的部署入口与回滚方案](../issues/42-plan-footer-deployment-and-rollback.md)。本轮只读运行环境；未安装、未改 profile、未重启。

## 已核对的当前环境

- GUI 为 `http://127.0.0.1:3080/`，HTTP 200。3081 没有监听；此前报告中的 3081 已更正。
- 监听进程为 PID 12684（当时快照），由桌面应用管理；cwd 是 `/Users/lovvvve/Library/Application Support/dsh-tauri/dependencies/dsh`。
- 进程的 `DSH_HOME=/Users/lovvvve/.dsh`，启动参数指定 `--profile web --port 3080`。不切换 home 或端口。
- 核心 conversation 由桌面依赖安装目录供应，版本 `0.1.7-rc.2`。profile 中目前没有同名本地包。
- Quick Actions 由 `/Users/lovvvve/.dsh/profiles/web/node_modules/dsh-quick-actions` 供应，版本 `0.2.0-rc.2`；它是 profile 的直接依赖和已启用 bundle。
- 从真实页面 bootstrap 的模块表读取精确 bundle URL 并下载验证：conversation rev=`da71fb918a5c`，Quick Actions rev=`a8a9fdac7358`。去掉运输层追加的 source URL 注释和末尾分隔分号后，所服务 JS 与上述磁盘文件一致。直接省略 rev 请求 `/plugins/??…` 返回 404，部署验收应使用新 bootstrap 给出的 URL，不猜缓存地址。
- 完整 web profile 约 190 MB；所在卷可用空间约 679 GiB。部署时重新检查，不能使用本轮 PID 直接结束进程。

## 受支持的入口与为什么需要重启

当前版本的 `apps/cli/src/plugin.ts:62–75` 把 `dsh plugin --profile web add …` 交给 profile 包管理器；`packages/boot/plugin-manager/src/operations.ts:88–112` 明确允许没有 `dsh.bundle` 的包作为普通依赖安装，不自动把它加入 bundle 层。

`packages/boot/app-boot/src/profile.ts:16–20,476–481` 及 `profile-resolution/resolver.ts:468–504,557–563` 表明 profile 内由 pnpm 管理的本地依赖优先于安装锚点回退。`tests/profile-resolution.spec.ts:533–560` 同时覆盖 CJS/ESM 的本地优先。因此在 web profile 加入本地 conversation 包，可在重启后替代该 profile 的原核心包，而无需覆盖桌面应用安装目录。

**重启不能省略。** 源码 `profile-resolution/resolver.ts:379–397` 明确拒绝运行中新增本地覆盖；并已只读核对实际安装的 app-boot bundle 中同样存在 `overriding … locally requires a process restart` 判断。新安装不等于新核心立即生效。

此结论由当前运行包、精确版本源码和已有测试支持；本轮没有实际安装来试验。最终成功须以重启后的真实 bundle 内容与 GUI 断言为准。

## 执行顺序（获得授权后）

1. **建立短维护窗口**：暂停其他插件安装、Settings 修改和任务发送。确认当前应用可以短暂断连；不要杀进程树或另起服务器。
2. **先备份**：创建时间戳命名、权限 0700 的备份目录，完整复制 `~/.dsh/profiles/web`（包括 manifest、两个 pnpm 文件、patch、node_modules，保留符号链接）。记录文件 hash。只备份 profile，不移动/清空 `~/.dsh/sessions` 或工作区会话历史。
3. **固定本地包来源**：将下列两个已验证 tarball 复制到 `~/.dsh/local-packages/quick-actions-footer-<timestamp>/`，逐字节校验 [SHA-256 清单](../core/bar-footer/artifacts-manifest.json)。不要依赖临时源码目录，或把有本地补丁的同版本 tarball 当成官方 npm 包。
4. **经当前安装的 CLI 安装到 web profile**（不是源码 CLI，也不是直接 `npm install` 到桌面依赖目录）：

```sh
# 这些变量均在执行阶段核对；现在不执行。
DSH_BIN='/Users/lovvvve/Library/Application Support/dsh-tauri/dependencies/dsh/node_modules/@deepseek-ai/dsh/lib/bin.js'
LOCAL_PACKAGES="$HOME/.dsh/local-packages/quick-actions-footer-<timestamp>"
DSH_HOME="$HOME/.dsh" /opt/homebrew/bin/node "$DSH_BIN" plugin --profile web add \
  "$LOCAL_PACKAGES/deepseek-ai-dsh-client-ui-conversation-0.1.7-rc.2.tgz" \
  "$LOCAL_PACKAGES/dsh-quick-actions-0.2.0-rc.2.tgz"
```

`conversation` 被提示「plain dependency, not a profile layer」是预期结果；不要手工插入第二个 conversation bundle/Loader row。Quick Actions 原 bundle 保留。若兼容拒绝、年龄门槛或非预期依赖升级出现，先停止分析，不自行批准任意版本、不全局关闭限制。

5. **安装后先检查**：命令 exit 0；只允许预期直接依赖变更；profile 中 conversation 指向本地补丁产物；Quick Actions 指向本地适配产物；bundle 列表不增加 conversation；用户 Settings patch 不因安装被改写。发生异常则不要重启进新状态。
6. **通过桌面应用正常重启当前 DSH 一次**：建议由用户点击桌面端的重启入口，不从承载本会话的工具里杀自己的后端。该步骤会短暂断开会话；重新连接后再进行验收。若安装过程要求重启，不能把该提示误判为新 footer 已生效。
7. **同一页面验收**：仍是 3080，不启动替代端口。刷新后读取新 bootstrap 模块表，比较提供的两份 JS 与 tarball 内容（忽略 transport sourceURL/分号）。确认核心 footer 声明与插件新代码实际加载，再检查：
   - bar 仅一份，在统计行下方，左缘与输入框误差 ≤1 CSS px；
   - 原统计信息与 ContextMeter 保持原行；
   - 窄屏折叠/变宽恢复、管理面板可打开、其他布局无空行；
   - 不发真实模型请求、不改用户动作或布局数据。若需切换布局验证，先备份 Settings 并在结束后逐字还原。

## 回滚（预先准备，不依赖网络）

- 若 CLI 安装失败或预检不符：停止后续步骤，保留失败树与诊断日志，不追加第二轮盲目安装。
- 若重启后加载/布局异常：先通过桌面应用停止该 DSH，再将失败 profile 移至独立时间戳目录，完整恢复备份到原 `~/.dsh/profiles/web` 路径；不要只还原 manifest 后指望旧 node_modules 自行恢复。
- 检查备份的 manifest、锁文件、workspace 配置和 patch hash；保留原符号链接语义。重新正常启动同一 profile、端口，确认 GUI HTTP 200、原两份 bundle 代码恢复、用户动作和设置恢复。
- 新的本地包目录可暂保留供排查；未修改桌面依赖目录，因此恢复原 profile 会自然回到官方 conversation 供应源。不要删除备份、会话目录或应用安装目录来“清理”。

## 本轮读取时的 profile 指纹（执行时重新取样）

| 文件 | SHA-256 |
|---|---|
| package.json | `4b3f188edeb2faeb72fffa1ca5a559bd91640801da2fb9796b984357e1ec553a` |
| pnpm-lock.yaml | `d5f7ffa80787977d7d966c70e1eb58f4ae653a716c0d66027a922d847e554822` |
| pnpm-workspace.yaml | `01a4c8955e741a4964e4daa90cb549a76359a01b1dbeb32a216ace892dc82e45` |
| cordis.patch.yml | `b447cce87c723f73daef2980c87a56519f7660a5fdc19f1049d9f8e8a0aea8ed` |

备份未在本轮创建，安装命令未执行，重启未发生。确认授权后从执行顺序第一步开始。
