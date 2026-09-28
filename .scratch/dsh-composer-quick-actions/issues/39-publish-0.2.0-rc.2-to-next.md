# 把 0.2.0-rc.2 发到 npm 的 next dist-tag

Type: task
Mode: HITL
Status: claimed
Blocked by: none

## Question（问题）

用户要求「发 0.2.0-rc.2」。npm `next` 上的 `0.2.0-rc.1` 带着[票据 37](./37-restore-the-bar-width-on-dsh-0.1.7.md) 修掉的缺陷：DSH `0.1.6-alpha.2` 起 bar 在 composer dock 行里内容宽，窄屏需要折叠时会振荡，窗口变宽也放不回动作。本版带上票据 37 的修复（spec 22.9）；票据 38 只动 GUI 测试驱动，不进 tarball。

流程同[票据 36](./36-publish-0.2.0-rc.1-to-next.md)：`package.json` 与两份 README 的 tarball 名改到 `0.2.0-rc.2`（`packaging.spec.ts` 的版本线断言已覆盖 `0.2.0(-rc.N)`），跑全部可自动化验证与 `publish --dry-run`；发布需要 OTP，由用户执行：

```sh
npm whoami   # 先确认登录没过期（票据 36 首次发布即因 token 失效报 E404）
pnpm --filter dsh-quick-actions publish --no-git-checks --tag next
```

发布后核验 `dist-tags`（`next` 为 `0.2.0-rc.2`、`latest` 仍为 `0.1.0`）与 tarball 逐字节一致，再 resolve。

## Comments

### 2026-09-28：`0.2.0-rc.2` 已备好，只差用户执行发布

**改动**（commit `🔖 release: 0.2.0-rc.2`）：`package.json` 版本 `0.2.0-rc.1` → `0.2.0-rc.2`；两份 README 的本地 tarball 名同步。

| 检查 | 结果 |
|---|---|
| `pnpm typecheck` / `pnpm lint` | exit=0 |
| `pnpm test` | 23 文件 / 496 用例全过 |
| `pnpm peers check` | `No peer dependency issues found` |
| `publish --dry-run --no-git-checks --tag next` | `📦 dsh-quick-actions@0.2.0-rc.2 → https://registry.npmjs.org/` |

**打包内容**：48 个文件（同 rc.1），解包 627,162 B（rc.1 为 621,540 B，差额来自票据 37）；`lib/client.js` 含 `data-quick-actions-overflow`（票据 37 的折叠修复）；packed manifest：MIT、`repository` 含 `directory`、无 `publishConfig`、无 `dependencies`。registry 上 `0.2.0-rc.2` 未被占用。
