# 合并为单包

Type: task
Mode: AFK
Status: resolved
Blocked by: none

## Question（问题）

把安装 bundle 并回功能包，只发布一个 `dsh-quick-actions`。

**本票据推翻[票据 07](./07-select-plugin-architecture-and-package-contract.md) 的双包架构。** 那张票据把「双面功能包 + 安装 bundle」直接写成结论，**没有给出必须拆开的理由**，也没有记录考察过单包方案；此后每张票据都沿用它，从未被质疑。

### 触发与取证

用户问「为什么我们有两个包，别的插件只装一个」。调查其 web profile 里全部七个第三方插件，**无一例外都是单包**：同一个包同时声明 `dsh.bundle.patch` 与 `dsh.client`，patch 插入的行 `name` 直接指向自己。

| 插件 | `dsh.bundle` | `dsh.client` | 含 patch | 含实现 |
|---|---|---|---|---|
| `dshmarket@1.45.1` | 有 | 有 | 是 | 是 |
| `dsh-context@0.47.0` | 有 | 有 | 是 | 是 |
| `dsh-better-sidebar@0.18.1` | 有 | 有 | 是 | 是 |
| `dsh-codex-connect@0.1.0-alpha.4.30` | 有 | 有 | 是 | 是 |
| `@linxin666/dsh-remote-web-ui@0.3.19` | 有 | 有 | 是 | 是 |
| `@linxin666/dsh-client-ui-skill-explorer@0.3.19` | 有 | 有 | 是 | 是 |
| `@xmanrui/dsh-im@4.18.0` | 有 | 有 | 是 | 是 |

```yaml
# dshmarket 的 cordis.patch.yml —— 行的 name 就是这个包自己
- insert:
    - id: dsh-market
      name: 'dshmarket'
```

单包在技术上成立，DSH 没有任何机制要求拆开。

### 双包的代价（已发生，非假设）

- **离线安装必须处理两个 tarball 外加一条 profile `overrides`**——直接依赖不满足传递依赖。四份 README 里那整段排障，单包情况下不存在。
- 两个包要版本同步，打包契约得专门加断言防漂移。
- npm 上多占一个名字，每次发布跑两遍、过两次 OTP。

收益侧找不到实质对应物。理论上的「功能包可被别的 bundle 复用」在本插件不存在该场景，其余七个插件也都没这么用。

### 目标状态

唯一的包 `dsh-quick-actions` 同时承载：`dsh.bundle.patch` 指向自带的 `cordis.patch.yml`（行的 `name` 指向自己）、`dsh.client`、Host 主入口与 `./client` / `./types` 导出。`packages/composer-quick-actions-bundle` 整个删除。

装载条目 id 仍是 `composer-quick-actions`，两个 Settings 命名空间与本地化命名空间同样不动——[spec 第 19 节](../spec.md)已定的边界在此照旧。

### 待办

1. `cordis.patch.yml` 迁进功能包，行的 `name` 改指自己，注释重写。
2. 功能包 `package.json` 增加 `dsh.bundle.patch`，`files` 收录该 patch。
3. 删除 `packages/composer-quick-actions-bundle` 整个目录（含其两份 README）。
4. 打包契约 `packaging.spec.ts` / `docs.spec.ts` / `support.ts` 改为单包，删掉版本同步断言（不再有第二个包会漂移）。
5. `tests/gui/install.sh` 与 `profile-override.mjs`：override 与第二个 tarball 的处理整体删除。
6. 四份 README 收为两份，安装章节大幅简化。
7. `CLAUDE.md` 的三包表改为两包；spec 新增一节承载本次反转，不改写第 11.1 节正文。
8. 处理已发布的 `dsh-quick-actions-bundle@0.1.0-rc.1`（弃养或撤回，须用户执行）。

### 时机

只在首次发布 `0.1.0` 之前成立。`0.1.0` 尚未发布，registry 上只有两个包的 `0.1.0-rc.1`。拖到正式版之后，合并就得靠废弃一个已发布包来收场。

## Comments（评论）

### 2026-09-10 — 在票据 27 的分支内完成

[票据 27](./27-publish-to-npm-and-list-in-market.md) 的发布被本票据阻塞：不应该把一个马上要作废的结构发成 `0.1.0`。因此本票据在票据 27 的分支上完成，提交彼此独立，本票据先 resolved。

## Answer（答案）

已合并。唯一发布的包是 `dsh-quick-actions`，它同时承载 `dsh.bundle.patch`（指向自带的 `cordis.patch.yml`，插入行的 `name` 指向本包）、`dsh.client`、Host 主入口与三个导出。`packages/composer-quick-actions-bundle` 整个删除。变更本身与其边界记在 [spec 第 20 节](../spec.md)，[票据 07](./07-select-plugin-architecture-and-package-contract.md)原文保留。

### 落地清单

| 处 | 改动 |
|---|---|
| `cordis.patch.yml` | 迁进功能包，行的 `name` 改指自己，注释写明单包理由与旧结构的代价 |
| `package.json` | 增加 `dsh.bundle.patch`，`files` 收录该 patch |
| 打包契约 | `install bundle` 一节重写为 `bundle patch`；新增「装载条目 id 不随包名走」与「无需第二个包，一个 tarball 就是全部安装」两条；删掉版本同步断言——不再有第二个包会漂移 |
| `docs.spec.ts` / `support.ts` | 收为单包，README 版本断言的正则去掉 `-bundle` 分支 |
| `tests/gui/install.sh` | override 与第二个 tarball 的整套逻辑删除，`qa_install` 变成一条 `add`；`profile-override.mjs` 删除 |
| README | 四份收为两份。安装章节从「打两个包 → 写 override → add bundle → 重启」四步加一段必要性解释，缩为一条命令 |
| `CLAUDE.md` | 三包表改两包，并写明**不要**再拆出第二个包及其理由 |

### 验证

`pnpm test` 22 文件 / **485 通过**（较合并前 499 少 14 条，全部是第二个包专属断言），typecheck 两遍与 lint 通过。`publish --dry-run` 为单个 `dsh-quick-actions@0.1.0`；打包后 tarball 自带 `cordis.patch.yml`（行的 `name` 为 `dsh-quick-actions`）、`dsh.bundle.patch` 声明就位、`dependencies` 为空。

**未做**：陌生人安装路径尚未在新形态下实测。票据 27 第 4 步验的是双包 rc，结论（一条命令即可）在单包下只会更强，但仍应在发 `0.1.0` 之后复验一次。

**遗留**：已发布的 `dsh-quick-actions-bundle@0.1.0-rc.1` 需弃养或撤回，须用户执行，归票据 27 收尾。
