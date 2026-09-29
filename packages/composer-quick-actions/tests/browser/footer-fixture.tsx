import { createRoot } from 'react-dom/client'
import { QuickActionsSurface } from '../../src/client/surfaces/QuickActionsSurface.js'
import { QUICK_ACTIONS_CSS } from '../../src/styles/index.js'
import { zh } from '../../src/locales/index.js'
import type { ProjectedQuickAction } from '../../src/model/index.js'
import type { Translate } from '../../src/client/dsh.js'

const actions: ProjectedQuickAction[] = Array.from({ length: 6 }, (_, i) => ({
  ref: { source: 'preset', id: `action-${i}` }, label: `动作 ${i + 1}`, text: `text ${i + 1}`,
  icon: undefined, confirm: false, command: false, editable: false, hidden: false,
  clonedFromPresetId: undefined,
}))
const t: Translate = (key, params) => {
  const template = (zh as Record<string, string>)[key] ?? key
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => String(params?.[name] ?? whole))
}
const style = document.createElement('style')
style.textContent = QUICK_ACTIONS_CSS
document.head.append(style)
const root = document.getElementById('root')
if (root === null) throw new Error('missing fixture root')
createRoot(root).render(
  <div className="dsh-cqa-footer">
    <QuickActionsSurface layout="bar" actions={actions}
      session={{ unavailable: undefined, confirming: undefined, sending: false, activeRef: undefined, feedback: undefined }}
      t={t} onActivate={() => {}} onConfirm={() => {}} onCancelConfirm={() => {}}
      onDismissFeedback={() => {}} onManage={() => {}} />
  </div>,
)
