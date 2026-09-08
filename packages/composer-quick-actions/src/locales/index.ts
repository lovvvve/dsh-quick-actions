/**
 * Composer Quick Actions dictionaries (spec 8.4).
 *
 * Both shipped languages carry the same key set, so a missing translation is a
 * compile error rather than a key leaking onto a surface. Keys are registered
 * under one namespace and reached through the `t` prop the Slot registration's
 * `locale` option binds; nothing here formats a date, a number or a plural.
 */

/** The locale namespace this package registers and every Slot entry binds. */
export const QUICK_ACTIONS_LOCALE_NAMESPACE = 'composer-quick-actions'

/** Every key the Composer surfaces render. */
export type QuickActionsLocaleKey =
  | 'title'
  | 'manage'
  | 'manage.aria'
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

export type QuickActionsDictionary = Record<QuickActionsLocaleKey, string>

export const zh: QuickActionsDictionary = {
  'title': '快捷动作',
  'manage': '管理',
  'manage.aria': '管理快捷动作',
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
}

export const en: QuickActionsDictionary = {
  'title': 'Quick Actions',
  'manage': 'Manage',
  'manage.aria': 'Manage Quick Actions',
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
}

/** The dictionaries as `ctx.locale.register` takes them. */
export const quickActionsDictionaries: Record<string, QuickActionsDictionary> = { zh, en }
