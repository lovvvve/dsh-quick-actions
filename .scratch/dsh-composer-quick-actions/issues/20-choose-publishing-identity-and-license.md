# 确定插件发布身份与许可证

Type: grilling
Mode: HITL
Status: resolved
Blocked by: 11

## Question（问题）

在[完成安装 Bundle 与发布文档](./17-finish-install-bundle-and-release-docs.md)之前，由发布所有者确定两个 npm 包的正式名称或 scope、目标 registry 与访问级别、初始语义版本，以及许可证和 copyright holder。同步确定 README、安装命令、`dsh.bundle` 依赖与兼容矩阵中使用的唯一发布身份；不得把脚手架的无 scope 名称、`0.0.0` 或 DSH 核心仓库的许可证自动当成发布决策。

## Answer（答案）

发布所有者于 2026-09-08 拍板，四项决策全部定案。本票据只产出决策，不改动任何装配文件。

**发布身份**

| 项 | 决策 |
|---|---|
| 功能包名 | `dsh-composer-quick-actions`（无 scope） |
| 安装 bundle 名 | `dsh-composer-quick-actions-bundle`（无 scope） |
| 目标 registry / 访问级别 | 暂不发布；不设 `publishConfig`，不执行 `npm publish` |
| 初始语义版本 | 两个包同为 `0.1.0` |
| 许可证 | MIT |
| copyright holder | lovvvve |

包名是**正式采纳**而非脚手架沿用——写出来与现值相同，但性质不同：此后它就是唯一发布身份，README、安装命令、`cordis.patch.yml` 的 `name` 与 `dsh.bundle` 依赖一律用它，spec 第 405 行的禁止条款自此解除。

**「暂不发布」的确切含义与取舍**

指定身份但不推包：`package.json` 写入正式名称、`0.1.0` 与 `license`，试用走本地 `pnpm pack` 的两个 tarball（票据 17 的本地安装验证照常执行）。真发布的时机与形态由发布所有者日后另定，**不再阻塞票据 17/18/21**。

已知取舍：npm 没有名称预留机制，**未发布即未占位**。2026-09-08 实测两个目标名在 `registry.npmjs.org` 均为 404（未占用），但在真正 publish 之前不排除被他人抢注；接受该风险是本决策的一部分。若日后发生抢注，须回到本票据重新决策，不得沿用已被占用的名称——research 已记录硬约束：浏览器模块标识就是解析后的 manifest 包名，重复包标识直接导致激活失败。

**被排除的方案及取证**

- `@deepseek-ai/*`——DeepSeek 官方 scope（`@deepseek-ai/cordis@4.0.2`、`@deepseek-ai/dsh-client-ui-conversation` 等均在其下）。第三方插件使用构成冒充，排除。
- `@dsh-plugins/*`——GitHub org「DeepSeek Harness Plugins」（2026-08-15 创建，17 个公开 repo，含 `dsh-plugin-market` 插件市场）已实际占用该名，属第三方社区组织而非本项目所有，排除。**遗留问题**：`tools/dsh-client-bundle` 当前私有包名 `@dsh-plugins/dsh-client-bundle` 与该 org 撞名；它是 `private: true` 的构建适配器、不发布，故无法律与激活风险，但名称易致误解，建议后续清理时改为不撞名的私有名。
- `@lovvvve/*` 个人 scope——技术上更优（scope 天然唯一，注册账号即占住整个命名空间、无需发包），但与 DSH 插件生态惯例不一致，未采纳。
- GitHub Packages——强制 scope 等于 owner，且安装方需自配 `.npmrc`，对插件使用者不友好，未采纳。
- 私有 registry——与「插件应可被 DSH 用户安装」的产品意图不符，未采纳。

**生态佐证**（2026-09-08 实测）

同生态第三方插件 `dsh-code-review@0.1.0`（Apache-2.0）与 `dsh-network-settings@0.3.3`（MIT）均以无 scope 的 `dsh-<功能>` 形态发布到公共 npmjs，印证了本票据采纳的命名形态与 `0.1.0` 首发版本惯例。DSH 本体当前为 `0.1.1-rc.2`，尚未 1.0，故不选 `1.0.0`：首版已按 spec 第 16 节收缩为仅发送动作，公共契约仍可能变，`0.x` 如实反映该状态，并为 v2 加入插入动作留出 `0.2.0`。

**日后真发布时的前置条件**（本票据不执行）

本机 npm 未登录（`ENEEDAUTH`），无项目级或用户级 `.npmrc`，registry 为默认公共源。真发布前需发布所有者自行 `npm login`（新账号强制 2FA）。npm 用户名 `lovvvve` 的可用性无法远程判定（user endpoint 401、网页 403、maintainer 搜索仅能证明未发过包、不能证明未注册），仅在日后改选 scope 方案时才需到注册页实测。

**落地归属**

本票据新增根 `LICENSE`（MIT，holder lovvvve）——它是许可证决策的规范载体，与装配契约无关。其余 8 处身份字面量全部归**票据 17** 统一落地，本票据不碰：`cordis.patch.yml` 的 `name`、两个 `package.json` 的 `name`/`version`/`license`、bundle 的 `dependencies`、两个 README 的标题与安装命令。在票据 17 完成之前，仓库内仍是 `0.0.0` 且 `package.json` 无 `license` 字段，属预期状态而非遗漏。

### 2026-09-09 — 包名已由票据 27 在首次发布前缩短

本票据正文与 `## Answer` 记录的 `dsh-composer-quick-actions` / `dsh-composer-quick-actions-bundle` 是 2026-09-08 当时的决定，**原文保留不改**。用户在真正发布前要求缩短为与仓库同名，[票据 27](./27-publish-to-npm-and-list-in-market.md) 已执行：

| 角色 | 本票据定的名 | 现名 |
|---|---|---|
| 功能包 | `dsh-composer-quick-actions` | `dsh-quick-actions` |
| 安装 bundle | `dsh-composer-quick-actions-bundle` | `dsh-quick-actions-bundle` |

身份的其余部分（无 scope、`0.1.0`、MIT、copyright holder lovvvve、不设 `publishConfig`、已排除 `@deepseek-ai` 与 `@dsh-plugins`）全部沿用本票据的结论。变更本身与其边界记在 [spec 第 19 节](../spec.md)，该节优先级高于本票据的包名。**改的只有 npm 包名**：Cordis 装载条目 id 与两个 Settings 命名空间不动。
