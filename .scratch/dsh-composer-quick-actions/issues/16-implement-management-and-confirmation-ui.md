# 实现管理、动作面板与发送确认

Type: task
Mode: AFK
Blocked by: 14, 15

## Question（问题）

实现集中式管理面板、B/C 共用的可搜索动作面板、自定义动作新建/编辑表单，以及发送确认面板。落实预置排序/隐藏/克隆、自定义 CRUD/启停、布局选择、1–4 emoji、验证限制、确认时重验、设置写入失败和 revision 冲突恢复。首版只有发送动作，表单**没有动作类型选择器**，也没有兼容性抑制相关的列表过滤或提示（spec 第 16 节）。

表单必须实时识别 Command Send Action（命令发送动作）：文本首个非空白字符变为 `/` 时给出**警示但不锁定任何控件**——说明该动作会按命令进入官方裁决路径、说明确认面板不会展示 DSH 原生 `/` 候选菜单、说明关闭确认后命令将一键提交且无预览。确认开关始终可编辑，表单不得因文本变化自行改写用户已设定的 `confirm`（spec 第 4.3、8.3 节）。确认面板在启用时必须在完整命令文本之外包含同一条无候选菜单说明（spec 第 9.3、16.2 节）。不得自制候选菜单。

使用 DSH UI primitives、主题 token、CSS module 与中英文 `locale`，保证键盘操作、焦点恢复、可见文本标签及可补充的 `aria-label`、宽窄布局和局部错误隔离；成功操作不得产生额外 toast。所有动作必须复用共享模型的校验；隐藏与停用动作计入总量，合计达到 50 时禁用新增和克隆，因预置升级或 Host Config 变化被动超限时保留全部动作、显示超限警告，并在恢复到 50 以内前持续禁用新增和克隆。基于 14 提供的结构化 Settings mutation outcome 实现写入拒绝与 conflict（重读后要求用户重确认）的精确 UX。确认面板与执行单飞共享票据 15 的每 Session 状态契约，不维护私有第二把锁。

## Comments（评论）

票据 15 已落地并交接以下内容，实施本票据时请在其上继续，不要重建：

- **执行与确认状态契约**：`src/client/session/execution.ts` 的每 Session 引擎发布
  `{ unavailable, confirming, sending, activeRef, feedback }`，并拥有单飞锁与最终重验。
  确认面板必须复用它（`activate` / `confirm` / `cancel`），**不得维护第二把锁**。
- **确认面板已存在**：`src/client/session/ConfirmPanel.tsx`，含命令发送动作的「无候选菜单」
  说明、Esc / 遮罩 / 取消三条无副作用取消路径与焦点返回。本票据只需按需打磨文案与模态语义。
- **可搜索动作面板仍属本票据**：`bar` 的「更多」与 `launcher` 入口当前打开的是
  `surfaces/QuickActionsSurface.tsx` 里的 `ActionList`——同一顺序的普通弹出列表，**没有搜索框**。
  本票据交付共享可搜索面板后，请把这两个入口改接过去并删除 `ActionList`。搜索字段、大小写与
  Unicode 归一化策略需由本票据统一定义并以测试固定（spec 第 8.1 节）。
- **词典**：`src/locales/index.ts` 已有 `QuickActionsLocaleKey` 联合与中英两份字典，新增键请
  同时补两种语言（缺键是编译错误）。
- **样式**：`src/styles/index.ts` 的 `dsh-cqa-` 前缀样式串 + `<style data-plugin-css>` 注入，
  只用 DSH alias 主题 token；新面板沿用同一机制，不引入 CSS Modules（理由见票据 15 `## Answer`）。
- **管理入口**：三种布局的「管理」按钮已调用 `controller.openManager()`，控制器的
  `manager.open` 即本票据面板的开合状态。
