/**
 * Composer Quick Actions dictionaries (spec 8.4).
 *
 * Both shipped languages carry the same key set, so a missing translation is a
 * compile error rather than a key leaking onto a surface. Keys are registered
 * under one namespace and reached through the `t` prop the Slot registration's
 * `locale` option binds; nothing here formats a date, a number or a plural.
 *
 * Two families of key are addressed by composition rather than by name — a
 * field issue (`issue.<field>.<reason>`) and a write failure (`write.<kind>`) —
 * because the model and the controller name those cases, not this file. Both go
 * through {@link quickActionsLocaleKey}, which checks the composed key against
 * the dictionary itself, so a case this release cannot phrase falls back to a
 * general sentence instead of printing a raw key at the user.
 */
import type { QuickActionFieldIssue } from '../model/index.js'

/** The locale namespace this package registers and every Slot entry binds. */
export const QUICK_ACTIONS_LOCALE_NAMESPACE = 'composer-quick-actions'

/** Every key the Composer surfaces and the management panel render. */
export type QuickActionsLocaleKey =
  | 'title'
  | 'manage'
  | 'manage.tooltip'
  | 'more'
  | 'launcher'
  | 'empty'
  | 'command.badge'
  | 'unavailable.occupied-draft'
  | 'unavailable.composer-busy'
  | 'unavailable.composer-blocked'
  | 'unavailable.session-removed'
  | 'unavailable.parent-offline'
  | 'unavailable.sending'
  | 'feedback.state-changed'
  | 'feedback.retained'
  | 'feedback.failed'
  | 'feedback.dismiss'
  | 'catalog.loading'
  | 'catalog.unreadable'
  | 'catalog.unavailable'
  | 'catalog.undecodable'
  | 'catalog.retry'
  | 'crash.title'
  | 'crash.retry'
  | 'confirm.title'
  | 'confirm.send'
  | 'confirm.cancel'
  | 'confirm.command'
  | 'panel.title'
  | 'panel.close'
  | 'panel.search'
  | 'panel.search.empty'
  | 'manager.title'
  | 'manager.close'
  | 'manager.layout'
  | 'manager.layout.ribbon'
  | 'manager.layout.bar'
  | 'manager.layout.launcher'
  | 'manager.actions'
  | 'manager.count'
  | 'manager.new'
  | 'manager.empty'
  | 'manager.overflow'
  | 'manager.limit'
  | 'manager.command.notice'
  | 'manager.preset'
  | 'manager.custom'
  | 'manager.clonedFrom'
  | 'manager.hidden'
  | 'manager.disabled'
  | 'manager.hide'
  | 'manager.restore'
  | 'manager.clone'
  | 'manager.edit'
  | 'manager.enable'
  | 'manager.disable'
  | 'manager.delete'
  | 'manager.delete.confirm'
  | 'manager.delete.cancel'
  | 'manager.moveUp'
  | 'manager.moveDown'
  | 'manager.readonly.storage'
  | 'manager.readonly.offline'
  | 'form.title.new'
  | 'form.title.edit'
  | 'form.label'
  | 'form.label.hint'
  | 'form.text'
  | 'form.text.hint'
  | 'form.icon'
  | 'form.icon.hint'
  | 'form.confirm'
  | 'form.save'
  | 'form.cancel'
  | 'form.command.warning'
  | 'issue.invalid'
  | 'issue.label.blank'
  | 'issue.label.too-long'
  | 'issue.text.blank'
  | 'issue.text.too-long'
  | 'issue.text.reserved-placeholder'
  | 'issue.icon.not-emoji'
  | 'issue.icon.too-long'
  | 'write.dismiss'
  | 'write.retry'
  | 'write.not-ready'
  | 'write.read-only'
  | 'write.refused'
  | 'write.conflict'
  | 'write.failed'
  | 'write.invalid-fields'
  | 'write.limit-reached'
  | 'write.unknown-action'
  | 'write.id-in-use'
  | 'write.invalid-order'

export type QuickActionsDictionary = Record<QuickActionsLocaleKey, string>

export const zh: QuickActionsDictionary = {
  'title': '快捷动作',
  'manage': '管理',
  'manage.tooltip': '管理快捷动作',
  'more': '更多 {count}',
  'launcher': '快捷动作 {count}',
  'empty': '暂无可用快捷动作',
  'command.badge': '命令',
  'unavailable.occupied-draft': '草稿中已有内容；发送动作不会覆盖或携带它',
  'unavailable.composer-busy': '消息编辑器正在提交，请稍候',
  'unavailable.composer-blocked': '当前会话的消息编辑器已被占用',
  'unavailable.session-removed': '会话已被移除',
  'unavailable.parent-offline': '父会话不可用',
  'unavailable.sending': '正在发送',
  'feedback.state-changed': '状态已变化，请重试',
  'feedback.retained': '未发送，文本已保留',
  'feedback.failed': '未能执行：{message}',
  'feedback.dismiss': '知道了',
  'catalog.loading': '正在读取快捷动作…',
  'catalog.unreadable': '无法读取设置，快捷动作暂不可用',
  'catalog.unavailable': '未找到预置目录',
  'catalog.undecodable': '预置目录版本过新，无法读取',
  'catalog.retry': '重试',
  'crash.title': '快捷动作出错了',
  'crash.retry': '重新加载',
  'confirm.title': '确认发送',
  'confirm.send': '发送',
  'confirm.cancel': '取消',
  'confirm.command': '这条文本会按命令进入 DSH 官方裁决路径。此处不会出现输入 / 时的原生候选菜单，你看到的就是最终提交内容。',
  'panel.title': '选择快捷动作',
  'panel.close': '关闭',
  'panel.search': '搜索快捷动作',
  'panel.search.empty': '没有匹配的快捷动作',

  'manager.title': '管理快捷动作',
  'manager.close': '关闭',
  'manager.layout': '布局',
  'manager.layout.ribbon': '上方动作带',
  'manager.layout.bar': '下方操作栏',
  'manager.layout.launcher': '单入口面板',
  'manager.actions': '快捷动作',
  'manager.count': '共 {total} / {limit} 项',
  'manager.new': '新建快捷动作',
  'manager.empty': '还没有任何快捷动作',
  'manager.overflow':
    '动作总数为 {total} 项，已超过 {limit} 项上限。现有动作全部保留，但在恢复到上限以内之前无法新增或克隆。',
  'manager.limit': '已达 {limit} 项上限，无法新增或克隆。',
  'manager.command.notice':
    '标有「命令」的动作以 / 开头，会按命令进入 DSH 官方裁决路径。确认面板只展示最终提交的文本，不会出现原生 / 候选菜单；关闭确认后，命令将一键提交且没有任何预览。',
  'manager.preset': '预置',
  'manager.custom': '自定义',
  'manager.clonedFrom': '克隆自预置',
  'manager.hidden': '已隐藏',
  'manager.disabled': '已停用',
  'manager.hide': '隐藏',
  'manager.restore': '恢复',
  'manager.clone': '克隆',
  'manager.edit': '编辑',
  'manager.enable': '启用',
  'manager.disable': '停用',
  'manager.delete': '删除',
  'manager.delete.confirm': '确认删除',
  'manager.delete.cancel': '不删除',
  'manager.moveUp': '上移',
  'manager.moveDown': '下移',
  'manager.readonly.storage': '设置存储当前不可用，管理界面为只读。',
  'manager.readonly.offline': '连接已断开，管理界面为只读；连接恢复后可继续修改。',

  'form.title.new': '新建快捷动作',
  'form.title.edit': '编辑快捷动作',
  'form.label': '标签',
  'form.label.hint': '按钮上显示的名称，最长 {max} 个字符',
  'form.text': '发送文本',
  'form.text.hint': '原样提交的静态文本，保留换行，最长 {max} 个字符',
  'form.icon': '图标（可选）',
  'form.icon.hint': '1–{max} 个 emoji，仅作装饰',
  'form.confirm': '发送前确认',
  'form.save': '保存',
  'form.cancel': '取消',
  'form.command.warning':
    '这条文本以 / 开头，是命令发送动作：它会按命令进入 DSH 官方裁决路径；确认面板不会展示原生 / 候选菜单；关闭确认后，该命令将一键提交且没有任何预览。确认开关仍由你自行设置。',

  'issue.invalid': '这个字段不符合要求',
  'issue.label.blank': '请填写标签',
  'issue.label.too-long': '标签超出长度上限',
  'issue.text.blank': '发送文本至少要有一个非空白字符',
  'issue.text.too-long': '发送文本超出长度上限',
  'issue.text.reserved-placeholder': '发送文本包含 DSH 保留的引用占位符，无法作为静态文本提交',
  'issue.icon.not-emoji': '图标只能由 emoji 组成',
  'issue.icon.too-long': '图标的 emoji 数量超出上限',

  'write.dismiss': '知道了',
  'write.retry': '重试',
  'write.not-ready': '设置尚未就绪，改动没有保存。',
  'write.read-only': '当前无法写入设置，改动没有保存。',
  'write.refused': '保存被拒绝，没有写入任何内容；请重试。',
  'write.conflict': '设置已在别处被修改，已刷新到最新状态；请核对后重新确认这次修改。',
  'write.failed': '保存失败：{message}；请重试。',
  'write.invalid-fields': '有字段不符合要求，改动没有保存。',
  'write.limit-reached': '已达动作数量上限，无法新增或克隆。',
  'write.unknown-action': '这个动作已经不存在了，请核对当前列表后重试。',
  'write.id-in-use': '生成的标识发生重复，请重试。',
  'write.invalid-order': '顺序已经变化，请核对当前列表后重试。',
}

export const en: QuickActionsDictionary = {
  'title': 'Quick Actions',
  'manage': 'Manage',
  'manage.tooltip': 'Manage Quick Actions',
  'more': 'More {count}',
  'launcher': 'Quick Actions {count}',
  'empty': 'No Quick Actions available',
  'command.badge': 'Command',
  'unavailable.occupied-draft': 'The draft already has content; a send action never overwrites or carries it',
  'unavailable.composer-busy': 'The composer is submitting; try again in a moment',
  'unavailable.composer-blocked': 'Another feature owns this session’s composer',
  'unavailable.session-removed': 'This session was removed',
  'unavailable.parent-offline': 'The parent session is unavailable',
  'unavailable.sending': 'Sending',
  'feedback.state-changed': 'Something changed — try again',
  'feedback.retained': 'Not sent; the text was kept in the draft',
  'feedback.failed': 'Could not run: {message}',
  'feedback.dismiss': 'Dismiss',
  'catalog.loading': 'Loading Quick Actions…',
  'catalog.unreadable': 'Settings could not be read, so Quick Actions are unavailable',
  'catalog.unavailable': 'No Preset Catalog was published',
  'catalog.undecodable': 'The Preset Catalog is newer than this release can read',
  'catalog.retry': 'Retry',
  'crash.title': 'Quick Actions hit an error',
  'crash.retry': 'Reload',
  'confirm.title': 'Confirm send',
  'confirm.send': 'Send',
  'confirm.cancel': 'Cancel',
  'confirm.command':
    'This text enters DSH’s own command adjudication path. The native “/” suggestion menu does not appear here, so what you see is exactly what is submitted.',
  'panel.title': 'Pick a Quick Action',
  'panel.close': 'Close',
  'panel.search': 'Search Quick Actions',
  'panel.search.empty': 'No Quick Action matches that',

  'manager.title': 'Manage Quick Actions',
  'manager.close': 'Close',
  'manager.layout': 'Layout',
  'manager.layout.ribbon': 'Action ribbon',
  'manager.layout.bar': 'Action bar',
  'manager.layout.launcher': 'Single launcher',
  'manager.actions': 'Quick Actions',
  'manager.count': '{total} of {limit}',
  'manager.new': 'New Quick Action',
  'manager.empty': 'No Quick Actions yet',
  'manager.overflow':
    'There are {total} actions, over the limit of {limit}. Everything you have is kept, but creating and cloning stay disabled until the total is back within the limit.',
  'manager.limit': 'The limit of {limit} actions is reached, so creating and cloning are disabled.',
  'manager.command.notice':
    'Actions marked “Command” start with “/” and enter DSH’s own command adjudication path. The confirmation panel shows only the text that will be submitted — the native “/” suggestion menu does not appear — and with confirmation off the command is submitted in one click with no preview.',
  'manager.preset': 'Preset',
  'manager.custom': 'Custom',
  'manager.clonedFrom': 'Cloned from a preset',
  'manager.hidden': 'Hidden',
  'manager.disabled': 'Disabled',
  'manager.hide': 'Hide',
  'manager.restore': 'Restore',
  'manager.clone': 'Clone',
  'manager.edit': 'Edit',
  'manager.enable': 'Enable',
  'manager.disable': 'Disable',
  'manager.delete': 'Delete',
  'manager.delete.confirm': 'Confirm delete',
  'manager.delete.cancel': 'Keep it',
  'manager.moveUp': 'Move up',
  'manager.moveDown': 'Move down',
  'manager.readonly.storage': 'Settings storage is unavailable right now, so management is read-only.',
  'manager.readonly.offline': 'The connection is down, so management is read-only until it is back.',

  'form.title.new': 'New Quick Action',
  'form.title.edit': 'Edit Quick Action',
  'form.label': 'Label',
  'form.label.hint': 'The name on the button, up to {max} characters',
  'form.text': 'Text to send',
  'form.text.hint': 'Static text submitted as-is, line breaks kept, up to {max} characters',
  'form.icon': 'Icon (optional)',
  'form.icon.hint': '1–{max} emoji, decoration only',
  'form.confirm': 'Confirm before sending',
  'form.save': 'Save',
  'form.cancel': 'Cancel',
  'form.command.warning':
    'This text starts with “/”, which makes it a Command Send Action: it enters DSH’s own command adjudication path, the confirmation panel shows no native “/” suggestion menu, and with confirmation off the command is submitted in one click with no preview at all. The confirmation switch stays yours to set.',

  'issue.invalid': 'This field is not acceptable',
  'issue.label.blank': 'Enter a label',
  'issue.label.too-long': 'The label is over the length limit',
  'issue.text.blank': 'The text needs at least one non-whitespace character',
  'issue.text.too-long': 'The text is over the length limit',
  'issue.text.reserved-placeholder': 'The text holds a DSH-reserved reference placeholder and cannot be submitted as static text',
  'issue.icon.not-emoji': 'An icon may only be made of emoji',
  'issue.icon.too-long': 'The icon has too many emoji',

  'write.dismiss': 'Dismiss',
  'write.retry': 'Retry',
  'write.not-ready': 'Settings are not ready yet, so nothing was saved.',
  'write.read-only': 'Settings cannot be written right now, so nothing was saved.',
  'write.refused': 'The write was refused and nothing was saved; try again.',
  'write.conflict':
    'Settings changed elsewhere and have been refreshed; check what is on screen and confirm your change again.',
  'write.failed': 'The write failed: {message}. Try again.',
  'write.invalid-fields': 'Some fields are not acceptable, so nothing was saved.',
  'write.limit-reached': 'The action limit is reached, so creating and cloning are disabled.',
  'write.unknown-action': 'That action no longer exists; check the current list and try again.',
  'write.id-in-use': 'The generated id collided; try again.',
  'write.invalid-order': 'The order has changed; check the current list and try again.',
}

/** The dictionaries as `ctx.locale.register` takes them. */
export const quickActionsDictionaries: Record<string, QuickActionsDictionary> = { zh, en }

/**
 * Every key this package ships, taken from the dictionary rather than restated,
 * so a composed key is checked against what actually exists.
 */
const SHIPPED_KEYS: ReadonlySet<string> = new Set(Object.keys(zh))

/**
 * Narrow a composed key to one this package ships, falling back when it does
 * not. Composed keys come from names the model and the controller own — a field
 * issue, a mutation refusal, a write failure — so a case added upstream shows a
 * general sentence instead of leaking `write.something-new` onto a surface.
 */
export function quickActionsLocaleKey(candidate: string, fallback: QuickActionsLocaleKey): QuickActionsLocaleKey {
  return SHIPPED_KEYS.has(candidate) ? (candidate as QuickActionsLocaleKey) : fallback
}

/** The dictionary entry naming one field issue (spec 4.3). */
export function quickActionIssueKey(issue: QuickActionFieldIssue): QuickActionsLocaleKey {
  return quickActionsLocaleKey(`issue.${issue.field}.${issue.reason}`, 'issue.invalid')
}
