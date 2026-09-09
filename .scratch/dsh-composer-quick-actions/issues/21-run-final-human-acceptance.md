# 执行最终人工验收

Type: task
Mode: HITL
Status: claimed
Blocked by: 18

## Question（问题）

在[执行集成与发布验证](./18-run-integration-and-release-verification.md)的全部自动化证据完成之后，由用户在一次性测试会话中完成[统一规格](../spec.md)第 13.4 节的最终人工验收。本票据是地图目标的最后一道门槛，**不得由 Agent 代为判定通过**。

除非用户另行明确同意，不得在该流程中触发真实模型调用。验收步骤逐条执行并记录结果：

1. 安装最终 tarball，重启并刷新 DSH GUI；
2. 创建普通发送动作与命令发送动作，验证编辑、排序、停用、隐藏和克隆；
3. 检查三种布局、输入框等宽和三种视口；
4. 验证命令发送动作默认开启确认、面板提示无候选菜单；关闭确认后一键提交；两种设置下都由 DSH 正常裁决；
5. 验证空草稿发送、占用草稿禁用、确认取消和确认发送；
6. 刷新页面并重启 DSH，确认 Settings 恢复；
7. 卸载并重启，确认 UI 消失；重新安装后确认配置恢复；
8. 检查错误信息、键盘流程和无障碍名称；
9. 由用户明确回复“生产验收通过”。

Agent 在本票据中的职责限于：准备一次性 profile 与最终 tarball、按用户指示驱动步骤、把结果追加到 `verification/release-evidence.md`。第 9 步的答复只能来自用户本人；没有这句明确答复，本票据不得置为 `resolved`，Wayfinder 地图目标也不得宣告完成。

用户在任一步骤报告偏差时，按规格第 13.1 节判断严重度：内容丢失、重复发送、持久化损坏或 Composer 崩溃一律阻止发布，须回到对应实施票据修复后重跑票据 18 的自动化，再重新进入本票据。

## Comments（评论）

### 2026-09-09 — 阻塞已解除

[票据 18](./18-run-integration-and-release-verification.md) 已 `resolved`：自动化证据完整，第 13.2 节行为矩阵全部有归属，四轮真实 GUI 验证记录在 `verification/release-evidence.md`。本票据的 `Blocked by` 至此清空（该行保留历史，不删项）。

开工前必读的三处：

1. **证据文件的第 13.2 节对账表**与第四轮末尾的「第 13.2 节的剩余缺口」一节——唯一未逐字执行的是 README 升级/降级里「override 与 `add` 指向**另一个版本**的两个 tarball」，因为两个包按[票据 20](./20-choose-publishing-identity-and-license.md) 暂不发布、本地只有 `0.1.0`。
2. **三处已记录的行为发现**（票据 18 的 `## Answer`）。其中两处已立为[票据 25](./25-close-two-edge-state-ux-gaps.md)，都不阻塞本票据；用户在第 13.4 节步骤 2/8 里可能会撞上第 3 项（表单打开时按 Escape 会关掉整个管理面板），事先说明可以省掉一次误报。
3. **`tests/gui/` 的驱动**：一次性 profile 的安装与卸载已脚本化（`install.sh`、`reinstall-round.sh`、`close-window.sh`），profile 的两份文件在开窗前取 sha256、关窗后校验。本票据准备环境时应复用它们，而不是手工执行 README 步骤——手工路径已在票据 18 第一至三轮执行过，脚本路径在第四轮执行过，两者都有证据。

spec 第 13.4 节要求「除非用户另行明确同意，不得在该流程中触发真实模型调用」。票据 18 第三轮已获得用户对真实模型调用的明确许可，但**那次许可属于票据 18**，不自动延续到本票据。

### 2026-09-09 — 票据 25 已 resolved，两条 GUI 断言待本票据的窗口执行

上一条评论第 2 点里「用户在步骤 2/8 可能撞上表单 Escape 关掉整个管理面板」的预告**已失效**：[票据 25](./25-close-two-edge-state-ux-gaps.md) 让表单接管开场焦点并归还焦点，第一下 Escape 只退出表单、第二下才关面板。断线发送那一处经源码取证确认是 DSH 自己恢复草稿并给出 DSH 的错误提示，插件按 spec 9.5 不加第二条说明；步骤 8 检查错误信息时若看到的是 DSH 的 toast 而非插件的 note，这是预期。

本票据开安装窗口时顺带执行票据 25 新增却尚未在真实 GUI 跑过的断言：`sh tests/gui/verify-round.sh validation.spec.ts`（编辑表单聚焦 → Escape → 面板仍在）与 `sh tests/gui/lifecycle-round.sh`（断线时 DSH 自己的 toast 出现、插件无 feedback note；`down` 半程会停掉 profile）。两者都不触发模型调用。若 `lifecycle` 的 toast 断言失败，按票据 25 的结论那是 DSH 侧缺口（rejection message 为空），记录即可，不回插件补反馈。

### 2026-09-09 — 已认领；安装窗口已打开，等待用户执行步骤 1–8

Agent 侧的准备工作已完成，证据在 `verification/release-evidence.md` 的「票据 21」一节：

1. 最终候选提交 `b5959d2` 上 `pnpm typecheck` / `pnpm lint` / `pnpm test`（22 文件 / 496 通过）全部新鲜通过。
2. 用 `reinstall-round.sh` 打包最终 tarball（功能包 `0.1.0` 167 KB、bundle 3 KB）并装进 web profile，重装恢复三段通过。
3. 窗口内重跑了**全部无模型调用的 GUI round**（常规套件三视口 40 通过 / 83 跳过、restart、scale 六行、presets 四段、host-config、screenshots 九张、lifecycle `down` 半程），13 次 profile 启动无一失败无一重试。票据 25 留下的两条断言都在真实 GUI 首次成立；toast 断言通过，DSH 侧缺口分支未触发。
4. profile 已再次启动并保持运行，命名空间为全新安装状态，供用户在浏览器中执行第 13.4 节步骤 1–8。

**上一条评论的一处更正**：`lifecycle-round.sh` 的 `up` 半程末尾会真实发送「回复 ok」一次，「两者都不触发模型调用」只对 `down` 半程成立。本票据未取得模型调用许可，故 `send-round.sh`（6 条）与 `up` 半程均未执行；若用户许可，可在同一窗口内补跑。

第 9 步仍待用户本人答复。关窗命令 `sh tests/gui/close-window.sh` 须在 worktree `ticket-21-final-acceptance` 根目录执行，且关窗前不得删除该 worktree（profile 的 `file:` 引用指向其中的 tarball）。

### 2026-09-09 — 用户指示「你来验证」，步骤 1–8 已由 Agent 执行并通过

新增 `tests/gui/acceptance.spec.ts` 与 `tests/gui/acceptance-round.sh` 驾驭第 13.4 节步骤 1–8（`walk` 段走步骤 2/3/4/5/8 与步骤 6 的刷新，`persist` 段做重启与卸载 / 重装各带一次重启），逐条观察与 19 张裁剪截图记在 `verification/release-evidence.md` 与 `verification/acceptance-21/`。**未花费任何真实模型调用**：三次真实提交都用未知命令 `/qa-acceptance-unknown-command`，由 DSH 自己裁决；普通文本的真实发送仍留给用户。

全部通过，要点：三布局 × 三视口九种组合的等宽误差均为 0.00 px；命令动作默认确认、确认面板给出无候选菜单说明、关闭确认后一键提交、两种设置下都由 DSH 裁决；占用草稿禁用且草稿逐字保留；刷新、重启、卸载、重装后配置逐项恢复；Escape 两级作用域、Tab 顺序与可访问名称均符合 spec 8.3 / 8.4。

**一处新发现，不阻止发布**：shell 的侧栏拖拽把手（`wSkVaW_widthHandle`，z-index 8、x 425–465 全高，非本插件元素）压住管理表单里 13×13 的原生复选框，精确点方框会被它截获；点开关文字与 Tab+空格均正常。成因是 `.dsh-cqa-manager`（`position: fixed; z-index: 31`）渲染在输入坞子树内、被祖先层叠上下文困住，即[票据 23](./23-adopt-dsh-ui-primitives.md) 备注里「`ManagerPanel` 的 portal 化」候选项所指的症状。按 spec 第 13.1 节判级不属阻断项，建议另开票据。

`walk` 段前三次失败均为本轮 harness 断言过严（`setChecked` 净变化为零、误判保存后焦点、可访问名称未计入「命令」徽标），已逐条修正并在证据里写明，不是插件行为。

窗口保持打开供用户核对；第 9 步仍只能由用户本人答复。
