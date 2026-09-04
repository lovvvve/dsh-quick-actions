# Composer Quick Actions

This context defines reusable message actions exposed near the DSH composer and the ownership language used to distinguish plugin-provided actions from user-owned actions.

## Language

**Quick Action（快捷动作）**:
A reusable message intent available from the DSH composer and represented by a clickable control.
_Avoid_: Quick Button, 快捷按钮（仅用于指代视觉控件时除外）

**Preset Quick Action（预置快捷动作）**:
An author-owned Quick Action distributed by the plugin.
_Avoid_: Default Button, Built-in Button

**Custom Quick Action（自定义快捷动作）**:
A user-owned Quick Action created from scratch or cloned from a Preset Quick Action.
_Avoid_: Override, Edited Preset

**Insert Action（插入动作）**:
A Quick Action whose text becomes part of the current draft without submitting it.
_Avoid_: Append Button, Fill Button

**Send Action（发送动作）**:
A Quick Action whose text is submitted as a message.
_Avoid_: Reply Button, Submit Button
