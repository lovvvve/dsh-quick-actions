# 识别持久化配置和预置扩展点

Type: research
Mode: AFK
Status: resolved
Blocked by: 01

## Question（问题）

哪些确切的 DSH/Cordis Host 和 Client 能力可以跨本地 DSH 重启持久保存用户拥有的快捷动作，并从可安装软件包接收作者拥有的预置快捷动作？请确定受支持的配置或存储 API、Client 到 Host 的边界、生命周期约束、稳定身份要求和数据模式迁移能力，并提供确切契约和源码引用。

## Answer（答案）

引用的研究材料是[快捷动作的持久化配置和预置扩展点](../research/durable-configuration-seams.md)，记录于分支 `research/durable-configuration-seams` 的提交 `07e0b85`。

使用以 `@deepseek-ai/dsh-settings-file` 为后端的 Host `settings` 服务。将作者拥有的预置快捷动作作为不可变内容保留在软件包代码或 Host composition 配置中，并且只在一个稳定的、以小写字母和连字符命名的命名空间内持久保存按 ID 索引的用户自有快捷动作、用户明确指定的顺序以及各预置的差异。Client 通过 `settingsScope` 和生成的 `remote.settings` 调用，在修订版本栅栏保护下编辑由 Host 持有权威状态的命名空间；浏览器本地持久化不能作为受支持的权威数据源。

`storageDomain` 是一种受支持但更重量级的纯 Host 替代方案；它要求配置好后端、明确负责 `Domain.close()` 的生命周期管理，并提供自定义 Client 控制器。它提供记录级单点写入能力，但依然不提供数据迁移。Settings 同样没有验证前的数据模式迁移钩子，因此首个版本应采用可向后读取的版本化数据模式，随后执行具备幂等性且受修订版本栅栏保护的规范重写；未来若需要严格的迁移能力，则必须扩展 DSH 核心。
