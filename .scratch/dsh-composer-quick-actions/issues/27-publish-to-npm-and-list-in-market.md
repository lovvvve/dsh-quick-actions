# 发布到 npm 并在插件市场上架

Type: task
Mode: HITL
Status: claimed
Blocked by: none

## Question（问题）

把两个包真正发布出去，使任何人都能用[功能包 README](../../../packages/composer-quick-actions/README.md)「正式安装」一节那条命令装上：

```sh
dsh plugin --profile web add dsh-composer-quick-actions-bundle
```

**本票据推翻[票据 20](./20-choose-publishing-identity-and-license.md) 的「暂不发布」。** 那条决定当时的理由是「只定身份不推包，试用走本地 tarball，不让发布阻塞票据 17/18/21」；首版验收既已通过（票据 21），该理由不再成立。反转须逐处落到文档，不得默默执行：票据 20 的 `## Answer`、地图的决策索引、根 `CLAUDE.md`「环境与陷阱」里那条「**不要**给任何包加 `publishConfig` 或执行 `npm publish`」。

### 开工前已确认的事实

| 事实 | 依据 |
|---|---|
| 两个包名在 npm 均未被占用 | `npm view` 对二者都返回 404 |
| 打包契约已为发布备好 | 票据 17 定身份与 `files`，票据 24 把 pack 隔离到工作树外；`workspace:*` 在打包时替换为真实版本，根 `LICENSE` 自动带入 |
| 正式安装本就是一条命令 | README「正式安装」一节已写好，并注明当前会 404 |
| 发现与安装是**两条**通道 | npm 负责安装；插件市场的目录来自策展仓库 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 的 `plugins.json`，上架须去那里提 PR，市场本身不收插件条目的 PR |

### 待办

1. **（HITL）** 用户本机 `npm login`，含 2FA。只有用户能做。
2. `pnpm --filter dsh-composer-quick-actions publish --dry-run` 核对将要上传的内容，再正式发布。**功能包必须先发**——bundle 依赖它。
3. 发布 bundle 包。
4. **在全新 `DSH_HOME` 里实测陌生人的安装路径**：只用那条官方命令，不加 profile `overrides`、不指 tarball。本地流程当初需要 override 加两个 tarball（票据 17），从 registry 装能否收敛成一条命令**尚无人验证**，这是本票据唯一的实质未知。
5. 删掉四份 README 里的「尚未发布」注记，正式安装一节改为可直接执行。
6. 去 `awesome-dsh-plugin` 提 PR 上架，按其条目格式填写。

### 待用户拍板的决定

**发布哪个版本号。** npm 的版本号一经发布即锁死内容，撤回只有 72 小时窗口且名字仍被占用。由于第 4 步的未知只能在发布之后验证，先发预发布版试通、再发 `0.1.0` 更稳；但代价是 registry 上会留下一个预发布版本。

### 验收

第 4 步在全新 `DSH_HOME` 上通过，四份 README 不再声称未发布，反转已落到票据 20、地图与 `CLAUDE.md` 三处，市场 PR 已提交（合入与否不由本仓库控制，记录 PR 链接即可）。

## Comments（评论）

### 2026-09-09 — 由用户发起，未开 Wayfinder 地图

用户问「现在我要发布，让别人也能安装要怎么做」。按 wayfinder 的判据评估后**没有开图**：路线已清晰、无雾，整件事约一个会话加一次用户侧认证即可完成，开图属于该技能自己警告的滥用。以本票据承载。
