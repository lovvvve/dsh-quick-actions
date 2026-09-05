# 将 insertText 补丁集成到 DSH 官方发布

Type: task
Mode: HITL
Blocked by: 10

## Question（问题）

将[公开 DSH 消息编辑器 insertText 接口](./10-publish-dsh-composer-insert-text-api.md)产出的已审查补丁应用或重放到 DSH 官方仓库当前目标分支，创建上游 PR，完成所需 CI 与维护者审查并合并。记录首个正式包含 `inputActions.insertText(text: string): void` 的 DSH 发布版本；随后更新快捷动作功能包的 README、兼容矩阵和最终安装验证。不得把本地补丁提交哈希冒充正式发布版本，也不得以修改已安装 `node_modules` 代替上游集成。
