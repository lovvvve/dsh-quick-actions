# 议题跟踪器：本地 Markdown

本仓库的议题和规格以 Markdown 文件形式存放在 `.scratch/` 中。

## 约定

- 每项功能使用一个目录：`.scratch/<feature-slug>/`
- 规格文件为 `.scratch/<feature-slug>/spec.md`
- 实施议题按工单一项一文件，路径为 `.scratch/<feature-slug>/issues/<NN>-<slug>.md`，编号从 `01` 开始——不得合并为单个工单汇总文件
- 分诊状态记录在每个议题文件顶部附近的 `Status:` 行中
- 评论和对话历史追加在 `## Comments` 标题下

## 当技能指示“发布到议题跟踪器”时

在 `.scratch/<feature-slug>/` 下创建一个新文件。

## 当技能指示“获取相关工单”时

读取所引用路径下的文件。

## Wayfinding operations（导航操作）

- **地图（Map）**：`.scratch/<effort>/map.md`
- **子工单（Child ticket）**：`.scratch/<effort>/issues/NN-<slug>.md`；`Type:` 为 `research`/`prototype`/`grilling`/`task`，`Status:` 为 `claimed`/`resolved`
- **阻塞关系（Blocking）**：`Blocked by: NN, NN`
- **前沿工单（Frontier）**：处于开放、未阻塞且未认领状态的工单；编号最小者优先
- **认领（Claim）**：开始工作前将 `Status:` 设为 `claimed`
- **解决（Resolve）**：追加 `## Answer`，将 `Status:` 设为 `resolved`，然后在地图的 `Decisions-so-far`（截至目前的决策）部分添加摘要和链接
