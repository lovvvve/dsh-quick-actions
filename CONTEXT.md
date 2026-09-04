# Composer Quick Actions（消息编辑器快捷动作）

此上下文定义了在 DSH 消息编辑器附近提供的可复用消息动作，以及用于区分插件提供动作与用户自有动作的归属术语。

## 术语

**Quick Action（快捷动作）**：
一种可从 DSH 消息编辑器使用，并由可点击控件表示的可复用消息意图。
_避免使用_：Quick Button（快捷按钮）、快捷按钮（仅在指代视觉控件时除外）

**Preset Quick Action（预置快捷动作）**：
归作者所有并随插件分发的 Quick Action（快捷动作）。
_避免使用_：Default Button（默认按钮）、Built-in Button（内置按钮）

**Custom Quick Action（自定义快捷动作）**：
归用户所有、从头创建或从 Preset Quick Action（预置快捷动作）克隆而来的 Quick Action（快捷动作）。
_避免使用_：Override（覆盖项）、Edited Preset（已编辑的预置项）

**Preset Action ID（预置动作 ID）**：
由作者分配给预置快捷动作、且不随标签或文本变化的稳定身份。
_避免使用_：标签派生 ID、位置 ID

**Custom Action ID（自定义动作 ID）**：
在创建自定义快捷动作时分配、并在其整个生命周期内保持不变的用户动作身份。
_避免使用_：标签派生 ID、数组索引 ID

**Clone Provenance（克隆来源）**：
记录自定义快捷动作最初由哪个预置快捷动作克隆而来的说明性关联；它不表示持续同步或共享所有权。
_避免使用_：继承关系、实时分叉

**Insert Action（插入动作）**：
其文本会成为当前草稿的一部分而不提交草稿的 Quick Action（快捷动作）。
_避免使用_：Append Button（追加按钮）、Fill Button（填充按钮）

**Send Action（发送动作）**：
其文本会作为消息提交的 Quick Action（快捷动作）。
_避免使用_：Reply Button（回复按钮）、Submit Button（提交按钮）
