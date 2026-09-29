# 打通独立操作栏核心补丁的构建前置条件

Type: task
Status: resolved
Labels: ready-for-human
Blocked by: 40

## Question

如何把已交付 footer 核心补丁所在精确版本源码构建成无缺失 Remote 声明、无 workspace 产物解析警告的可验证产物，为后续正式部署准备？

## Comments

- 用户在 Ask Matt 推荐下一步后调用 `/diagnosing-bugs`，允许诊断并打通核心构建；替换运行环境或重启前另行确认。
- 基线：`dsh-v0.1.7-rc.2` / `477b4f420553e8a52c2fbccc464d7561b239c443`。隔离源码位于 `/tmp/dsh-footer-source.gZQq0j/deepseek-harness-477b4f420553e8a52c2fbccc464d7561b239c443`。
- 不改 GUI 安装目录、用户 profile，不起停服务器，不发布 npm；不修改已解决 footer 布局决定。

## Feedback loop

原始命令（已经复现，exit 2）：

```sh
./node_modules/.bin/tsc -b packages/client/ui-conversation/tsconfig.json
```

最小反馈命令（已经复现，exit 1，秒级）：

```sh
./node_modules/.bin/tsc -b packages/api/job-controller/tsconfig.client.json
```

输出：

```text
packages/api/job-controller/src/client/index.ts(11,21): error TS2307: Cannot find module '@deepseek-ai/dsh-api-job-controller/remote' or its corresponding type declarations.
packages/api/job-controller/src/client/index.ts(34,11): error TS2339: Property 'job' does not exist on type 'ClientRemote'.
```

最小反馈不包含 footer 实现包，因此可用于区分构建前置条件和 footer 代码变更；修复后仍须重跑原始 ui-conversation 构建，而不以单个 API 包通过代替整条链通过。

## Answer

**构建阻塞已解除；没有修改 footer 或核心业务代码。** 根因是隔离目录仅装 UI 测试依赖，直接运行 Client tsc，跳过官方 Host bundling/Typert 的生成前置阶段。

按锁文件安装完整依赖后 Host tsc 转绿，但最小 Client 复现仍红；执行官方 Host tsdown/Typert 后，相同最小命令及完整 conversation 类型构建都转绿。再次构建 conversation 包，之前 cosmokit/brand 的解析警告消失。此因果顺序证明是构建准备缺失，而非用类型断言或手写声明掩盖代码问题。

- [诊断、完整命令与验证边界](../verification/footer-build.md)
- [可重复的构建回归脚本](../core/bar-footer/check-build.sh)：已观察红→绿。
- 核心相关回归重跑 706 项通过；构建好的 Host 可直接 import。
- conversation 核心补丁包与插件适配包已在本地打包；tar 内 manifest、核心 Slot 声明、Host/Client 字节均验证，hash 已持久化。**没有安装或发布。**

本票据完成的是 footer 所需 conversation 包及声明依赖链的构建和本地产物准备，不是整套 DSH Native/Desktop/Web 发行构建。`ready-for-human` 指后续运行环境切换授权：当前 GUI 安装目录和用户 profile 未动。部署前须核对真实加载来源、替换入口和回滚方案，用户确认后才能替换或重启；上线验收尚未进行。
