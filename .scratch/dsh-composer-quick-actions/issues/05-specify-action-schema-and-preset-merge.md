# 制定快捷动作的数据结构与预置合并规则

Type: grilling
Mode: HITL
Status: resolved
Blocked by: 03

## Question（问题）

快捷动作的确切领域数据模式及所有权/合并契约是什么？请确定稳定身份、标签、静态文本、插入动作与发送动作的行为、确认策略、顺序、启用/隐藏状态、预置快捷动作的只读语义、克隆来源、验证限制、重复项处理方式，以及插件升级新增、移除或更改预置快捷动作时的处理方式。

## Answer（答案）

快捷动作使用稳定身份和判别联合。预置快捷动作由作者分配永久的包作用域 ID；自定义快捷动作在创建时生成 UUID。标签不是身份的一部分，因此允许重复。

预置定义由软件包内置清单后接 Host composition 的 `Config.presets` 附加项组成；任何重复预置 ID 都使配置加载失败。两种动作变体为：

```ts
type PresetQuickAction =
  | { id: PresetActionId; kind: 'insert'; label: string; text: string; icon?: string }
  | { id: PresetActionId; kind: 'send'; label: string; text: string; icon?: string; confirm: boolean }

type CustomQuickActionValue =
  | { kind: 'insert'; label: string; text: string; icon?: string; enabled: boolean; clonedFromPresetId?: PresetActionId }
  | { kind: 'send'; label: string; text: string; icon?: string; confirm: boolean; enabled: boolean; clonedFromPresetId?: PresetActionId }
```

用户层只持久化以下动作与布局状态，不复制不可变预置，也不保存时间戳、颜色、分组或快捷键：

```ts
interface QuickActionSettingsV1 {
  schemaVersion: 1
  layout: 'ribbon' | 'bar' | 'launcher'
  userActionsById: Record<CustomActionId, CustomQuickActionValue>
  actionOrder: Array<{ source: 'preset' | 'custom'; id: string }>
  presetStateById: Record<PresetActionId, { hidden?: boolean }>
}
```

全局 `layout` 的默认值为 `ribbon`，其三个值及交互含义由[选择快捷动作的放置方式和管理流程](./04-choose-placement-and-management-flow.md)确定，并随同一 Settings 命名空间跨重启保存。

预置只允许用户隐藏、排序或克隆；自定义动作允许创建、编辑、启停、排序和删除。克隆会复制当时的内容并生成新的自定义动作，只以可选 `clonedFromPresetId` 保留说明性来源，之后不再同步。自定义动作 `enabled` 默认 `true`，预置 `hidden` 默认 `false`，发送动作 `confirm` 默认 `true`。

标签去除首尾空白后保存，长度为 1–40 个 Unicode 字符；文本保留原始换行和首尾空白，但必须至少含一个非空白字符且最多 4000 个 Unicode 字符；可选图标只允许 1–4 个 emoji 字素簇。标签可以重复，ID 不可重复。

统一 `actionOrder` 允许预置与自定义动作混排。初始顺序为内置清单声明顺序后接 Host 配置声明顺序；新建自定义动作和升级新增预置均追加到现有顺序末尾。规范化时，重复引用只取首次出现，不存在的自定义引用会删除，未知预置引用与状态会保留但不显示，未列入顺序的已知动作按声明顺序追加；UUID 碰撞时重新生成。

同一预置 ID 可以更新标签、emoji 和文本，但 `kind` 与发送动作的 `confirm` 共同构成不可改变的安全行为签名；改变任一字段都必须使用新 ID。被删除的预置不显示但保留其引用与状态，降级或重新加入时恢复用户偏好。首版不支持预置 ID 重命名或别名推断。

持久化根对象从 `schemaVersion: 1` 开始。未来版本必须保持对所有已发布旧版本的兼容读取，并在加载后执行幂等、带 Settings 修订号保护的规范重写。
