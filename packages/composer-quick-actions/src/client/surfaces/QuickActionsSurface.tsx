/**
 * The three Quick Action Layouts and the control they share (spec 8.1, 8.2).
 *
 * | layout     | Slot                        | body                                                        |
 * |------------|-----------------------------|-------------------------------------------------------------|
 * | `ribbon`   | `conversation.input.dock`   | title, the actions in shared order, and "manage" on one line |
 * | `bar`      | `conversation.composer.dock`| the leading actions that fit, then "more", then "manage"     |
 * | `launcher` | `conversation.input.dock`   | one compact entry carrying the Composer projection's count   |
 *
 * Three rules hold across all of them:
 *
 * - the management entry is always rendered, so hiding or disabling every action
 *   still leaves a compact, operable entry rather than an empty strip;
 * - controls keep a visible text label at every width — a narrow surface drops
 *   the section title and tightens spacing, and nothing else (spec 8.2, 8.4);
 * - an action that cannot run right now is shown disabled with its reason, never
 *   removed. Removal is the Hidden Quick Action projection, and that is the
 *   management panel's business (spec 3).
 */
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, MutableRefObject, ReactElement } from 'react'
import { densityFor, fitActionCount } from './layout.js'
import type { SurfaceDensity } from './layout.js'
import { ConfirmPanel } from '../session/ConfirmPanel.js'
import type { QuickActionSessionState } from '../session/execution.js'
import type { QuickActionUnavailableReason } from '../session/guards.js'
import { quickActionRefKey } from '../../model/index.js'
import type { ProjectedQuickAction, QuickActionLayout } from '../../model/index.js'
import type { Translate } from '../dsh.js'

/** Gap between adjacent controls; mirrors `--gap` in the stylesheet. */
const CONTROL_GAP = 8

export interface QuickActionsSurfaceProps {
  readonly layout: QuickActionLayout
  /** The Composer projection, in the shared order (hidden actions already gone). */
  readonly actions: readonly ProjectedQuickAction[]
  readonly session: QuickActionSessionState
  readonly t: Translate
  readonly onActivate: (action: ProjectedQuickAction) => void
  readonly onConfirm: () => void
  readonly onCancelConfirm: () => void
  readonly onDismissFeedback: () => void
  readonly onManage: () => void
}

/** Which control a Quick Action renders as, given the Session's execution state. */
function reasonFor(
  action: ProjectedQuickAction,
  session: QuickActionSessionState,
): QuickActionUnavailableReason | undefined {
  if (session.unavailable === 'sending') {
    // Only the action holding the flight explains itself as "sending"; the rest
    // are simply unavailable while the Composer is busy with it.
    return session.activeRef !== undefined && quickActionRefKey(session.activeRef) === quickActionRefKey(action.ref)
      ? 'sending'
      : 'composer-busy'
  }
  return session.unavailable
}

function ActionControl(props: {
  readonly action: ProjectedQuickAction
  readonly reason: QuickActionUnavailableReason | undefined
  readonly t: Translate
  readonly onActivate: (action: ProjectedQuickAction) => void
  readonly measure?: (key: string, width: number) => void
}): ReactElement {
  const { action, reason, t, onActivate, measure } = props
  const key = quickActionRefKey(action.ref)
  const ref = useRef<HTMLButtonElement | null>(null)

  useLayoutEffect(() => {
    if (measure === undefined) return
    const width = ref.current?.offsetWidth ?? 0
    if (width > 0) measure(key, width)
  }, [key, measure, action.label, action.icon])

  return (
    <button
      type="button"
      ref={ref}
      className="dsh-cqa-action"
      data-quick-action={key}
      disabled={reason !== undefined}
      title={reason === undefined ? action.text : t(`unavailable.${reason}`)}
      onClick={() => {
        onActivate(action)
      }}
    >
      {action.icon === undefined ? null : (
        <span className="dsh-cqa-icon" aria-hidden="true">
          {action.icon}
        </span>
      )}
      <span className="dsh-cqa-label">{action.label}</span>
      {action.command ? <span className="dsh-cqa-badge">{t('command.badge')}</span> : null}
    </button>
  )
}

/**
 * The list behind `bar`'s "more" and `launcher`'s entry.
 *
 * It is the layouts' own overflow affordance: a plain list of the same actions
 * in the same order. The searchable action panel spec 8.1 asks these two entries
 * to share is the management task's to build; when it lands, both entries move
 * onto it and this list goes away.
 */
function ActionList(props: {
  readonly actions: readonly ProjectedQuickAction[]
  readonly session: QuickActionSessionState
  readonly t: Translate
  readonly labelledBy: string
  readonly onActivate: (action: ProjectedQuickAction) => void
  readonly onClose: () => void
}): ReactElement {
  const { actions, session, t, labelledBy, onActivate, onClose } = props
  const first = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    first.current?.focus()
  }, [])

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      onClose()
    },
    [onClose],
  )

  return (
    <div
      className="dsh-cqa-panel"
      role="dialog"
      aria-labelledby={labelledBy}
      data-quick-actions-panel=""
      onKeyDown={onKeyDown}
    >
      <div className="dsh-cqa-panel-title" id={labelledBy}>
        {t('panel.title')}
      </div>
      {actions.length === 0 ? <div className="dsh-cqa-panel-title">{t('empty')}</div> : null}
      {actions.map((action, index) => {
        const reason = reasonFor(action, session)
        return (
          <button
            key={quickActionRefKey(action.ref)}
            type="button"
            ref={index === 0 ? first : undefined}
            className="dsh-cqa-panel-item"
            data-quick-action={quickActionRefKey(action.ref)}
            disabled={reason !== undefined}
            title={reason === undefined ? action.text : t(`unavailable.${reason}`)}
            onClick={() => {
              onActivate(action)
              onClose()
            }}
          >
            {action.icon === undefined ? null : (
              <span className="dsh-cqa-icon" aria-hidden="true">
                {action.icon}
              </span>
            )}
            <span className="dsh-cqa-label">{action.label}</span>
            {action.command ? <span className="dsh-cqa-badge">{t('command.badge')}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Measure one element's inner width, republishing on every resize. Used twice:
 * on the whole row for the density rule, and on the action region alone for the
 * bar's overflow split — the region is `flex: 1 1 auto`, so its width is already
 * what is left after the controls that must stay visible.
 */
function useElementWidth(): [MutableRefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (element === null || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      setWidth(element.clientWidth)
    })
    observer.observe(element)
    setWidth(element.clientWidth)
    return () => {
      observer.disconnect()
    }
  }, [])

  return [ref, width]
}

export function QuickActionsSurface(props: QuickActionsSurfaceProps): ReactElement {
  const { layout, actions, session, t, onActivate, onConfirm, onCancelConfirm, onDismissFeedback, onManage } = props
  const [rowRef, width] = useElementWidth()
  const [fitRef, fitWidth] = useElementWidth()
  const density: SurfaceDensity = densityFor(width)
  const [panelOpen, setPanelOpen] = useState(false)
  const panelTriggerRef = useRef<HTMLButtonElement | null>(null)
  const panelTitleId = useId()

  // Measured control widths, cached by action identity: they depend on the
  // label, not on the container, so a resize re-runs only the arithmetic.
  const widths = useRef(new Map<string, number>())
  const [measured, setMeasured] = useState(0)
  const measure = useCallback((key: string, value: number) => {
    if (widths.current.get(key) === value) return
    widths.current.set(key, value)
    setMeasured((seen) => seen + 1)
  }, [])

  const shown = useMemo(() => {
    if (layout !== 'bar') return actions.length
    const keys = actions.map((action) => quickActionRefKey(action.ref))
    const known = keys.map((key) => widths.current.get(key) ?? 0)
    // A control whose width is not cached yet keeps every action on screen for
    // one frame rather than folding a measured-as-zero action into "more".
    if (known.some((value) => value <= 0)) return actions.length
    return fitActionCount({ available: fitWidth, widths: known, reserved: 0, gap: CONTROL_GAP })
    // `measured` is the cache's revision: it is what makes this recompute.
  }, [layout, actions, fitWidth, measured])

  const overflow = layout === 'bar' ? actions.slice(shown) : actions
  const closePanel = useCallback(() => {
    setPanelOpen(false)
    panelTriggerRef.current?.focus()
  }, [])

  // Focus return after the confirmation closes (spec 8.4): the control that
  // opened it gets the caret back. The opener is captured in the activation
  // itself, because by the time an effect runs the panel has already claimed
  // focus for its own confirm button.
  const confirmOpener = useRef<HTMLElement | null>(null)
  const confirming = session.confirming
  const activate = useCallback(
    (action: ProjectedQuickAction) => {
      confirmOpener.current = document.activeElement as HTMLElement | null
      onActivate(action)
    },
    [onActivate],
  )
  const manageRef = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    if (confirming !== undefined) return
    const opener = confirmOpener.current
    confirmOpener.current = null
    if (opener === null) return
    // The opener is often unusable by the time the panel closes: confirming a
    // send disables it for the flight, and an action picked from the overflow
    // list is unmounted with the list. The management entry is the one control
    // every layout always has, so focus lands there rather than on the body.
    const usable = opener.isConnected && !(opener as HTMLButtonElement).disabled
    ;(usable ? opener : manageRef.current)?.focus()
  }, [confirming])

  // A layout switch, or an emptied overflow, must not leave a panel open over
  // an entry that no longer exists.
  useEffect(() => {
    if (overflow.length === 0) setPanelOpen(false)
  }, [overflow.length])

  const manage = (
    <button type="button" ref={manageRef} className="dsh-cqa-entry" data-quick-actions-manage="" onClick={onManage}>
      <span className="dsh-cqa-label">{t('manage')}</span>
    </button>
  )

  const rootClass = layout === 'bar' ? 'dsh-cqa-bar' : layout === 'launcher' ? 'dsh-cqa-launcher' : 'dsh-cqa-ribbon'

  return (
    <div className={rootClass} data-quick-actions-layout={layout} data-quick-actions-density={density}>
      <div className="dsh-cqa-row" ref={rowRef} data-density={density}>
        {layout === 'ribbon' && density === 'wide' ? <span className="dsh-cqa-title">{t('title')}</span> : null}

        {layout === 'ribbon' ? (
          <div className="dsh-cqa-scroll">
            {actions.length === 0 ? <span className="dsh-cqa-title">{t('empty')}</span> : null}
            {actions.map((action) => (
              <ActionControl
                key={quickActionRefKey(action.ref)}
                action={action}
                reason={reasonFor(action, session)}
                t={t}
                onActivate={activate}
              />
            ))}
          </div>
        ) : null}

        {layout === 'bar' ? (
          <div className="dsh-cqa-fit" ref={fitRef}>
            {actions.length === 0 ? <span className="dsh-cqa-title">{t('empty')}</span> : null}
            {actions.slice(0, shown).map((action) => (
              <ActionControl
                key={quickActionRefKey(action.ref)}
                action={action}
                reason={reasonFor(action, session)}
                t={t}
                onActivate={activate}
                measure={measure}
              />
            ))}
          </div>
        ) : null}

        <div className="dsh-cqa-trailing">
          {layout === 'launcher' || (layout === 'bar' && overflow.length > 0) ? (
            <span className="dsh-cqa-anchor">
              <button
                type="button"
                ref={panelTriggerRef}
                className="dsh-cqa-entry"
                data-quick-actions-entry={layout}
                aria-expanded={panelOpen}
                aria-haspopup="dialog"
                disabled={layout === 'launcher' && actions.length === 0}
                onClick={() => {
                  setPanelOpen((open) => !open)
                }}
              >
                <span className="dsh-cqa-label">
                  {layout === 'launcher'
                    ? t('launcher', { count: actions.length })
                    : t('more', { count: overflow.length })}
                </span>
              </button>
              {panelOpen ? (
                <ActionList
                  actions={overflow}
                  session={session}
                  t={t}
                  labelledBy={panelTitleId}
                  onActivate={activate}
                  onClose={closePanel}
                />
              ) : null}
            </span>
          ) : null}
          <span className="dsh-cqa-anchor">
            {manage}
            {session.confirming === undefined ? null : (
              <ConfirmPanel pending={session.confirming} t={t} onConfirm={onConfirm} onCancel={onCancelConfirm} />
            )}
          </span>
        </div>
      </div>

      {session.feedback === undefined ? null : (
        <div className="dsh-cqa-note" role="status" data-quick-actions-feedback={session.feedback.kind}>
          <span className="dsh-cqa-note-text">
            {session.feedback.kind === 'failed'
              ? t('feedback.failed', { message: session.feedback.message })
              : t(`feedback.${session.feedback.kind}`)}
          </span>
          <button type="button" className="dsh-cqa-link" onClick={onDismissFeedback}>
            {t('feedback.dismiss')}
          </button>
        </div>
      )}
    </div>
  )
}
