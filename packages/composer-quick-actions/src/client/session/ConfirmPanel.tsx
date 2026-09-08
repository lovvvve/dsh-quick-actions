/**
 * The send confirmation panel (spec 9.3).
 *
 * It shows the action's label and the complete text that will be submitted, and
 * for a Command Send Action it also carries the notice spec 9.3 and 16.2 make
 * mandatory: the text goes to DSH's own command adjudication path, and no native
 * `/` suggestion menu appears here, so what is on screen is exactly what will be
 * submitted. Nothing in this panel imitates that menu.
 *
 * Opening it does not touch the draft; cancelling — the button, Escape, or a
 * click on the backdrop — has no side effect at all. The re-verification that
 * follows a confirmation lives in the execution engine, not here.
 */
import type { ReactElement } from 'react'
import type { PendingQuickActionConfirmation } from './execution.js'
import { useInitialFocus, useModalKeys } from '../modal.js'
import type { Translate } from '../dsh.js'

export interface ConfirmPanelProps {
  readonly pending: PendingQuickActionConfirmation
  readonly t: Translate
  readonly onConfirm: () => void
  readonly onCancel: () => void
}

export function ConfirmPanel({ pending, t, onConfirm, onCancel }: ConfirmPanelProps): ReactElement {
  // Escape cancellation, the Tab boundary and the opening focus are the shared
  // modal semantics of spec 8.4; this panel adds no rule of its own. Focus
  // return is the surface's, not this panel's: the control that opened a
  // confirmation is usually disabled or unmounted by the time it closes, so the
  // surface owns the fallback (spec 8.4).
  const { panelRef, onKeyDown } = useModalKeys<HTMLDivElement>(onCancel)
  const confirmRef = useInitialFocus<HTMLButtonElement>()

  return (
    <>
      {/* The backdrop: clicking outside the panel cancels, with no side effect. */}
      <div
        className="dsh-cqa-backdrop"
        data-quick-actions-backdrop=""
        aria-hidden="true"
        onClick={onCancel}
      />
      <div
        className="dsh-cqa-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('confirm.title')}
        data-quick-actions-confirm=""
        onKeyDown={onKeyDown}
      >
        <div className="dsh-cqa-panel-title">{pending.label}</div>
        <div className="dsh-cqa-confirm-text">{pending.text}</div>
        {pending.command ? (
          <p className="dsh-cqa-note" data-quick-actions-command-notice="">
            <span className="dsh-cqa-note-text">{t('confirm.command')}</span>
          </p>
        ) : null}
        <div className="dsh-cqa-confirm-actions">
          <button type="button" className="dsh-cqa-entry" onClick={onCancel}>
            {t('confirm.cancel')}
          </button>
          <button type="button" className="dsh-cqa-entry" ref={confirmRef} onClick={onConfirm}>
            {t('confirm.send')}
          </button>
        </div>
      </div>
    </>
  )
}
