/**
 * The visible face of one Quick Action — the shared action control of spec 14's
 * `src/client/surfaces/` boundary.
 *
 * Three places offer an action to the user: a layout's control, the shared
 * searchable action panel's list item, and the management list's row. All three
 * must read the same, because the Command marker is only meaningful if it looks
 * and means the same wherever it appears, and the emoji is only decoration if it
 * is `aria-hidden` in every one of them (spec 8.4).
 *
 * It renders a fragment, not an element: each caller owns its own control — a
 * `<button>`, a list row — and its own layout box.
 */
import type { ReactElement } from 'react'
import { Pill } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ProjectedQuickAction } from '../../model/index.js'
import type { Translate } from '../dsh.js'

export interface ActionFaceProps {
  readonly action: ProjectedQuickAction
  readonly t: Translate
}

export function ActionFace({ action, t }: ActionFaceProps): ReactElement {
  return (
    <>
      {action.icon === undefined ? null : (
        // Decoration only: never an accessible name, never a label's substitute.
        <span className="dsh-cqa-icon" aria-hidden="true">
          {action.icon}
        </span>
      )}
      <span className="dsh-cqa-label">{action.label}</span>
      {action.command ? <Pill className="dsh-cqa-badge">{t('command.badge')}</Pill> : null}
    </>
  )
}
