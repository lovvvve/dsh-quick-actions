/**
 * The shared searchable action panel (spec 8.1).
 *
 * One panel serves both entries that need a list rather than a row: the `bar`
 * layout's "more" overflow and the `launcher` layout's single entry. Sharing it
 * is a spec requirement, not a convenience — the two entries must not drift into
 * offering different search behaviour or different keyboard handling.
 *
 * The search itself is `./search.js`: it really filters, it keeps the matches in
 * their `actionOrder` relative order, and its field, case and Unicode policy is
 * stated and pinned there. The panel adds only the UI around it — a search field
 * with a visible text label, the same disabled-with-a-reason projection the
 * layouts use (spec 3), and the modal semantics of spec 8.4.
 *
 * Nothing here executes anything: activation is handed straight to the caller's
 * per-Session engine, which owns the single flight and the final re-verification
 * (spec 9.3, 9.5). The panel never mints a second lock.
 */
import { useState } from 'react'
import type { ReactElement } from 'react'
import { filterQuickActions, hasQuickActionQuery } from './search.js'
import { Input } from '@deepseek-ai/dsh-client-ui-primitives'
import { useInitialFocusIn, useModalKeys } from '../modal.js'
import { ActionFace } from '../surfaces/ActionFace.js'
import { unavailableReasonFor } from '../session/availability.js'
import type { QuickActionSessionState } from '../session/execution.js'
import { quickActionRefKey } from '../../model/index.js'
import type { ProjectedQuickAction } from '../../model/index.js'
import type { Translate } from '../dsh.js'

/**
 * The search field's glyph: the official `IconSearchOutlineRegular` artwork,
 * drawn here rather than imported. DSH renamed its icon exports between lines
 * (`IconSearchOutline16` is gone as of 0.1.7) and the shell's seed table serves
 * only the running line's names, so an imported icon breaks the whole panel the
 * next time a name moves (spec 22.5). Stroke follows `currentColor`, so it
 * themes with the field like the official one.
 */
function SearchIcon(): ReactElement {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true" strokeWidth={1}>
      <path
        d="M6.58727 11.8586C9.55061 11.8586 11.9529 9.45637 11.9529 6.49304C11.9529 3.5297 9.55061 1.12744 6.58727 1.12744C3.62394 1.12744 1.22168 3.5297 1.22168 6.49304C1.22168 9.45637 3.62394 11.8586 6.58727 11.8586Z"
        stroke="currentColor"
      />
      <path d="M10.2991 10.3933L14.7783 14.8725" stroke="currentColor" />
    </svg>
  )
}

export interface ActionPanelProps {
  /** The actions this entry offers, already in the shared order. */
  readonly actions: readonly ProjectedQuickAction[]
  readonly session: QuickActionSessionState
  readonly t: Translate
  /** Id of the element naming this dialog. */
  readonly labelledBy: string
  readonly onActivate: (action: ProjectedQuickAction) => void
  readonly onClose: () => void
}

export function ActionPanel(props: ActionPanelProps): ReactElement {
  const { actions, session, t, labelledBy, onActivate, onClose } = props
  const [query, setQuery] = useState('')
  const { panelRef, onKeyDown } = useModalKeys<HTMLDivElement>(onClose)
  useInitialFocusIn(panelRef, '[data-quick-actions-search]')

  const matches = filterQuickActions(actions, query)
  // "Nothing to run" and "nothing matched what you typed" are different answers,
  // and telling them apart is the difference between a broken panel and an empty
  // search.
  const emptyKey = hasQuickActionQuery(query) ? 'panel.search.empty' : 'empty'

  return (
    <>
      {/* The backdrop: clicking outside the panel closes it, with no side effect. */}
      <div className="dsh-cqa-backdrop" data-quick-actions-backdrop="" aria-hidden="true" onClick={onClose} />
      <div
        className="dsh-cqa-panel"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        data-quick-actions-panel=""
        onKeyDown={onKeyDown}
      >
        <div className="dsh-cqa-panel-head">
          <span className="dsh-cqa-panel-title" id={labelledBy}>
            {t('panel.title')}
          </span>
          {/*
            Escape, the backdrop and the entry itself all close this panel, but
            none of them is visible. A pointer user needs a control they can see
            (spec 8.4).
          */}
          <button type="button" className="dsh-cqa-link" data-quick-actions-panel-close="" onClick={onClose}>
            {t('panel.close')}
          </button>
        </div>

        <label className="dsh-cqa-field">
          <span className="dsh-cqa-field-label">{t('panel.search')}</span>
          <Input
            icon={<SearchIcon />}
            type="search"
            value={query}
            data-quick-actions-search=""
            onChange={(event) => {
              setQuery(event.target.value)
            }}
          />
        </label>

        {matches.length === 0 ? <div className="dsh-cqa-panel-title">{t(emptyKey)}</div> : null}
        {matches.map((action) => {
          const reason = unavailableReasonFor(action, session)
          return (
            <button
              key={quickActionRefKey(action.ref)}
              type="button"
              className="dsh-cqa-panel-item"
              data-quick-action={quickActionRefKey(action.ref)}
              disabled={reason !== undefined}
              title={reason === undefined ? action.text : t(`unavailable.${reason}`)}
              onClick={() => {
                onActivate(action)
                onClose()
              }}
            >
              <ActionFace action={action} t={t} />
            </button>
          )
        })}
      </div>
    </>
  )
}
