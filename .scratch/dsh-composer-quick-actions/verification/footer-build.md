# footer 核心构建阻塞诊断与解除

关联：[打通独立操作栏核心补丁的构建前置条件](../issues/41-unblock-footer-core-build.md)。本报告更新[前一轮构建限制](../core/bar-footer/verification.md)，不追改历史日志。

## 结论

**构建阻塞已解除，补丁 conversation 包的完整类型构建、Host 导入和 Host/Client 打包已通过。** 根因是隔离归档只准备了 UI 测试依赖，随后直接编译 Client，跳过了官方 Host 生成阶段。没有 footer 业务代码缺陷，不需要补写 Remote 类型、屏蔽错误或修改仓库构建脚本。

这里的通过范围是 footer 涉及的 conversation 包及其声明依赖链，不冒充整套 DSH Native/Desktop/Web 发行物构建或当前 GUI 验收。

## 反馈循环（已经运行）

工作目录为精确基线 `477b4f420553e8a52c2fbccc464d7561b239c443` 的已打补丁源码：

```text
/tmp/dsh-footer-source.gZQq0j/deepseek-harness-477b4f420553e8a52c2fbccc464d7561b239c443
```

原始失败命令：

```sh
./node_modules/.bin/tsc -b packages/client/ui-conversation/tsconfig.json
```

首次 exit 2，[错误记录](../core/bar-footer/build-repro.log)包含缺失多个 `/remote` 及其连锁错误。缩小为以下命令，连续两次同样 exit 1，秒级：

```sh
./node_modules/.bin/tsc -b packages/api/job-controller/tsconfig.client.json
```

仅两条错误：`TS2307 Cannot find module '@deepseek-ai/dsh-api-job-controller/remote'`、`TS2339 Property 'job' does not exist on type 'ClientRemote'`。该最小路径不涉及 footer 实现。

已持久化[回归脚本](../core/bar-footer/check-build.sh)，依次执行最小命令和原始命令。它在生成前确实失败，在修复后通过；不会安装依赖、启动服务或改 profile。

## 排名假设与判别结果

1. **缺少生成步骤（成立）**：包 manifest 的 `/remote` 导出指向 `lib/typert.remote-client.d.ts`，该文件起初不存在。官方 `docs/development.md:72–89` 指定 Host tsc→Host tsdown/Typert→Client tsc 顺序；根 `tsdown.config.ts:33` 也只在 Host pass 开启 Typert。
2. **有文件但路径解析错误（排除当前案例）**：目标文件本就不存在，不是存在却查错目录；生成后相同 tsconfig 命令通过。
3. **依赖链接/版本混杂（核心链接未混杂，但依赖范围不全）**：从 `api/remotes` 的实际 consumer 链接解析，job-controller 指向本归档而非旧检出。第一次 Host tsc 的 627 行错误显示 telemetry/HMR/SSH/ACP 等依赖缺失；全量锁文件安装后，未修改源码的 Host tsc 通过。
4. **版本自身的类型缺陷（未见证据）**：相同源码与配置，仅补齐依赖和生成产物后完整 conversation 类型构建通过。

## 单变量修复轨迹

1. 全量恢复隔离源码的依赖，不修改 manifest/lockfile，不执行安装脚本：

```sh
CI=true HTTPS_PROXY=http://127.0.0.1:9999 HTTP_PROXY=http://127.0.0.1:9999 \
  pnpm install --frozen-lockfile --ignore-scripts
```

335 个 workspace，exit 0。安装时出现其他平台 workspace 提示、既有循环依赖、CLI 尚未构建所以不能创建 bin 的提示；并非包缺失错误。

2. 执行官方 Host 类型阶段：

```sh
node --max-old-space-size=4096 ./node_modules/typescript/bin/tsc -b tsconfig.host.json
```

exit 0。**此时重跑最小反馈仍失败**，证明仅装齐依赖并不能替代 Remote 生成。

3. 执行官方 Host bundling 与 Typert：

```sh
./node_modules/.bin/tsdown --env.DSH_BUILD_FACE host
```

exit 0，生成 Remote 声明和 workspace Host 产物。输出有仓库既有 tsdown 选项弃用、plugin timings 提示，不是缺失模块警告。

4. 再跑[回归脚本](../core/bar-footer/check-build.sh)：两条编译命令 exit 0，见[通过记录](../core/bar-footer/build-ready.log)。相同 footer 源码未改。

5. 在 `packages/client/ui-conversation` 中执行 `../../../node_modules/.bin/tsdown`：exit 0，产出 Host/Client bundle，[日志](../core/bar-footer/build-ready-bundle.log)已不含此前 cosmokit/brand unresolved import 警告，仅有依赖内联信息提示。

## 验证产物

- 构建好的 Host 入口可经 Node ESM 直接 import，且导出 `apply` 函数。
- 源码 `ui-conversation + ui-renderer + ui-slots` 聚焦回归重跑：**55 文件，706 项通过**，见[日志](../core/bar-footer/build-ready-regression.log)。
- 两个本地 tarball 已打包，**没有安装、发布或改版本号**：
  - [DSH conversation 本地补丁包](./footer-build-artifacts/deepseek-ai-dsh-client-ui-conversation-0.1.7-rc.2.tgz)
  - [Quick Actions 本地适配包](./footer-build-artifacts/dsh-quick-actions-0.2.0-rc.2.tgz)
- [产物检查脚本](../core/bar-footer/check-artifacts.py)读取 tar 内 manifest、Host/Client JS 与核心 Slot 声明，与刚构建的源码产物逐字节比对，确认 footer 标记存在；输出[SHA-256 清单](../core/bar-footer/artifacts-manifest.json)。
- tarball 是 gitignored 的本地构建结果，脚本、补丁、报告与 hash 清单可纳入版本控制。不要把它们与相同版本号的官方 npm tarball 混同，也不要据此发布覆盖官方版本。

## 清理与下一阶段

没有新增临时 debug instrumentation，没有改应用业务源码或 tsconfig。归档中的安装与生成文件均留作部署准备；此前的本机旧源码检出、当前 GUI 安装目录和用户 profile 未改变。

**当前 GUI 仍未更新。** 下一阶段先核对现有 `http://127.0.0.1:3080` 进程的实际包加载来源、受支持的替换入口和回滚方式。不能直接假定 `dsh plugin add` 能替换核心自带包，也不能手改已安装依赖。替换运行环境或重启需要用户确认。部署后必须在同一 URL 刷新并实测独立行、左边缘误差、统计行和折叠行为；本报告没有宣称这一步已完成。
