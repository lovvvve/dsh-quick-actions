/**
 * The centralized management panel (spec 8.3).
 *
 * Everything a user can change about Quick Actions lives here and nowhere else:
 * the shared order, a preset's hidden state and its clone, a custom action's
 * whole life cycle, and the global layout. The Composer surfaces only read the
 * projection and execute.
 *
 * ## Where the truth is
 *
 * The panel renders the authoritative snapshot the controller publishes and
 * never a local copy of it. So a new UI state appears only once the Host has
 * persisted it (spec 10) — including the order, which is why a failed reorder
 * needs no "restore the old order" path: the old order was never left.
 *
 * Each failure the controller reports is shown by name, because spec 10 asks for
 * different handling per kind:
 *
 * - a **refusal** or a **transport failure** keeps the form content and the
 *   panel open, and the control that failed is the retry;
 * - a **revision conflict** means the controller has already re-read the
 *   authoritative state, so the notice asks the user to confirm the change again
 *   against what is now on screen — this feature keeps no second offline truth;
 * - **read-only** state — an unreadable namespace, or a connection that can no
 *   longer vouch for the snapshot — disables every write and says which it is.
 *
 * No retry replays a remembered operation. The controller deliberately never
 * retries a settled write by itself (a silent replay could submit a plan the
 * user has already moved past), and a panel that replayed one would reintroduce
 * exactly that.
 *
 * Nothing here reports success: the list is the feedback, and spec 9.5 forbids an
 * extra success toast.
 */
import { useCallback, useEffect, useId, useState } from 'react'
import type { ReactElement } from 'react'
import { ActionForm } from './ActionForm.js'
import { useFocusReturn, useInitialFocus, useModalKeys } from './modal.js'
import { QUICK_ACTION_LAYOUTS, newQuickActionDraft, quickActionRefKey, validateQuickActionDraft } from '../../model/index.js'
import type {
  CustomActionId,
  ProjectedQuickAction,
  QuickActionDraft,
  QuickActionLayout,
  QuickActionRef,
} from '../../model/index.js'
import { quickActionsLocaleKey } from '../../locales/index.js'
import type { QuickActionsClientState, QuickActionsController, QuickActionWriteFailure } from '../controller.js'
import type { Translate } from '../dsh.js'

export interface ManagerPanelProps {
  readonly client: QuickActionsClientState
  readonly controller: QuickActionsController
  readonly t: Translate
}

/** Which action the form is editing, if any. */
type FormTarget = { readonly kind: 'new' } | { readonly kind: 'edit'; readonly id: CustomActionId }

interface FormState {
  readonly target: FormTarget
  readonly draft: QuickActionDraft
  /** Whether a save has already been attempted, which is what unmutes blank fields. */
  readonly attempted: boolean
}

/** Why every write is refused right now, or `undefined` when none is (spec 10). */
export type ManagerReadOnlyReason =
  /** The connection cannot vouch for the held snapshot, so it must not be written over. */
  | 'offline'
  /** No writable namespace: an unreadable first read, or a process-local page. */
  | 'storage'

export function managerReadOnlyReason(client: QuickActionsClientState): ManagerReadOnlyReason | undefined {
  if (!client.readOnly) return undefined
  // Staleness is reported first: it is the one the user can act on, and it also
  // explains why an otherwise writable namespace is refusing writes.
  return client.stale ? 'offline' : 'storage'
}

/** One write failure as a sentence, with the recovery it implies (spec 10). */
export function managerFailureMessage(failure: QuickActionWriteFailure, t: Translate): string {
  if (failure.kind === 'failed') return t('write.failed', { message: failure.message })
  const candidate = failure.kind === 'rejected' ? `write.${failure.rejection.reason}` : `write.${failure.kind}`
  return t(quickActionsLocaleKey(candidate, 'write.refused'))
}

/**
 * How one mutating control reports that it cannot be pressed.
 *
 * Only sustained, externally-imposed unavailability — a read-only namespace or a
 * connection that cannot vouch for the snapshot — uses a real `disabled`, which
 * takes the control out of the tab order entirely. Everything else uses
 * `aria-disabled` and a guarded handler, because everything else can become true
 * *as a result of the press itself*: the write this control just started, the
 * row reaching an end of the list, the layout it just selected becoming current,
 * the clone that just filled the last slot. A real `disabled` there would drop
 * the keyboard caret to the document body mid-reorder, and focus handling is a
 * hard gate of spec 8.4.
 */
function pressProps(input: {
  readonly readOnly: boolean
  readonly blocked: boolean
  readonly onPress: () => void
}): { readonly disabled: boolean; readonly 'aria-disabled': boolean; readonly onClick: () => void } {
  return {
    disabled: input.readOnly,
    'aria-disabled': input.blocked,
    onClick: () => {
      if (input.readOnly || input.blocked) return
      input.onPress()
    },
  }
}

/** The form's starting draft for an existing Custom Quick Action. */
function draftOf(action: ProjectedQuickAction): QuickActionDraft {
  return { label: action.label, text: action.text, icon: action.icon ?? '', confirm: action.confirm }
}

export function ManagerPanel({ client, controller, t }: ManagerPanelProps): ReactElement {
  const close = useCallback(() => {
    controller.closeManager()
  }, [controller])

  useFocusReturn()
  const { panelRef, onKeyDown } = useModalKeys<HTMLDivElement>(close)
  const closeRef = useInitialFocus<HTMLButtonElement>()
  const titleId = useId()
  const layoutTitleId = useId()
  const listTitleId = useId()

  const [form, setForm] = useState<FormState | undefined>(undefined)
  const [pendingDelete, setPendingDelete] = useState<CustomActionId | undefined>(undefined)

  const projection = client.projection
  const managed = projection?.managed ?? []
  const counts = projection?.counts
  const readOnlyReason = managerReadOnlyReason(client)
  /** Sustained and external: the panel is genuinely inert (see {@link pressProps}). */
  const readOnly = readOnlyReason !== undefined
  /** A write is in flight; transient, and usually started by the focused control. */
  const busy = client.writing

  // An action edited in one tab and deleted in another must not leave an editor
  // open over nothing: saving it would only ever answer `unknown-action`.
  const editingId = form?.target.kind === 'edit' ? form.target.id : undefined
  const editingLives =
    editingId === undefined ||
    managed.some((action) => action.editable && action.ref.source === 'custom' && action.ref.id === editingId)
  useEffect(() => {
    if (!editingLives) setForm(undefined)
  }, [editingLives])

  const run = useCallback((write: () => Promise<unknown>): void => {
    // Every controller write answers with an outcome rather than rejecting, and
    // the failure it reports is already published on the snapshot this panel
    // renders. The catch is the belt: an unhandled rejection must not reach the
    // page from a click handler.
    void write().catch(() => undefined)
  }, [])

  const save = useCallback(async (): Promise<void> => {
    if (form === undefined) return
    // Validated here as well as by the planner, so a fixable field is reported
    // without a round trip — and through the very same shared rules (spec 4.3).
    if (!validateQuickActionDraft(form.draft).ok) {
      setForm({ ...form, attempted: true })
      return
    }
    const outcome =
      form.target.kind === 'new'
        ? await controller.createCustomAction(form.draft)
        : await controller.updateCustomAction(form.target.id, form.draft)
    // A failed write keeps the draft exactly as typed (spec 10); only a
    // persisted one closes the form.
    if (outcome.ok) setForm(undefined)
    else setForm({ ...form, attempted: true })
  }, [controller, form])

  const remove = useCallback(
    async (id: CustomActionId): Promise<void> => {
      const outcome = await controller.deleteCustomAction(id)
      if (outcome.ok) setPendingDelete(undefined)
    },
    [controller],
  )

  const move = useCallback(
    (ref: QuickActionRef, toIndex: number): void => {
      run(() => controller.moveAction(ref, toIndex))
    },
    [controller, run],
  )

  const anyCommand = managed.some((action) => action.command)

  return (
    <>
      {/*
        The backdrop closes the panel with no side effect. It paints nothing: the
        surfaces may only use DSH alias theme tokens, and this release has no
        token for a modal scrim to spend (spec 8.4).
      */}
      <div
        className="dsh-cqa-backdrop dsh-cqa-manager-backdrop"
        data-quick-actions-backdrop=""
        aria-hidden="true"
        onClick={close}
      />
      <div
        className="dsh-cqa-manager"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-quick-actions-manager=""
        onKeyDown={onKeyDown}
      >
        <div className="dsh-cqa-manager-head">
          <h2 className="dsh-cqa-manager-title" id={titleId}>
            {t('manager.title')}
          </h2>
          <button type="button" className="dsh-cqa-entry" ref={closeRef} onClick={close}>
            {t('manager.close')}
          </button>
        </div>

        {projection === undefined ? (
          <div
            className="dsh-cqa-note"
            role="status"
            data-quick-actions-catalog-error={client.catalog.status === 'error' ? client.catalog.reason : 'loading'}
          >
            <span className="dsh-cqa-note-text">
              {t(client.catalog.status === 'error' ? `catalog.${client.catalog.reason}` : 'catalog.loading')}
            </span>
            <button
              type="button"
              className="dsh-cqa-link"
              onClick={() => {
                run(() => controller.refresh())
              }}
            >
              {t('catalog.retry')}
            </button>
          </div>
        ) : null}

        {readOnlyReason === undefined ? null : (
          <div className="dsh-cqa-note" role="status" data-quick-actions-readonly={readOnlyReason}>
            <span className="dsh-cqa-note-text">{t(`manager.readonly.${readOnlyReason}`)}</span>
          </div>
        )}

        {client.failure === undefined ? null : (
          <div className="dsh-cqa-note" role="alert" data-quick-actions-write-failure={client.failure.kind}>
            <span className="dsh-cqa-note-text">{managerFailureMessage(client.failure, t)}</span>
            <button
              type="button"
              className="dsh-cqa-link"
              onClick={() => {
                controller.dismissFailure()
              }}
            >
              {t('write.dismiss')}
            </button>
          </div>
        )}

        {counts === undefined || (!counts.overflow && counts.canAdd) ? null : (
          <div
            className="dsh-cqa-note"
            role="status"
            data-quick-actions-limit={counts.overflow ? 'overflow' : 'reached'}
          >
            <span className="dsh-cqa-note-text">
              {t(counts.overflow ? 'manager.overflow' : 'manager.limit', { limit: counts.limit, total: counts.total })}
            </span>
          </div>
        )}

        {projection === undefined ? null : (
          <>
            <div className="dsh-cqa-section">
              <span className="dsh-cqa-section-title" id={layoutTitleId}>
                {t('manager.layout')}
              </span>
              <div className="dsh-cqa-group" role="group" aria-labelledby={layoutTitleId}>
                {QUICK_ACTION_LAYOUTS.map((layout: QuickActionLayout) => (
                  <button
                    key={layout}
                    type="button"
                    className="dsh-cqa-entry"
                    data-quick-actions-layout-choice={layout}
                    aria-pressed={projection.layout === layout}
                    {...pressProps({
                      readOnly,
                      blocked: busy || projection.layout === layout,
                      onPress: () => {
                        run(() => controller.setLayout(layout))
                      },
                    })}
                  >
                    {t(`manager.layout.${layout}`)}
                  </button>
                ))}
              </div>
            </div>

            <div className="dsh-cqa-section">
              <div className="dsh-cqa-section-head">
                <span className="dsh-cqa-section-title" id={listTitleId}>
                  {t('manager.actions')}
                </span>
                <span className="dsh-cqa-field-hint" data-quick-actions-count="">
                  {t('manager.count', { total: counts?.total ?? 0, limit: counts?.limit ?? 0 })}
                </span>
                <button
                  type="button"
                  className="dsh-cqa-entry"
                  data-quick-actions-new=""
                  {...pressProps({
                    readOnly,
                    blocked: busy || counts?.canAdd !== true || form?.target.kind === 'new',
                    onPress: () => {
                      setForm({ target: { kind: 'new' }, draft: newQuickActionDraft(), attempted: false })
                    },
                  })}
                >
                  {t('manager.new')}
                </button>
              </div>

              {/*
                The centralized Command Send Action explanation of spec 8.3. It
                is rendered exactly when a badge is on screen to explain, so the
                marker never appears without its meaning; a text that becomes a
                command inside the form gets the form's own live warning.
              */}
              {anyCommand ? (
                <p className="dsh-cqa-note" data-quick-actions-command-notice="">
                  <span className="dsh-cqa-note-text">{t('manager.command.notice')}</span>
                </p>
              ) : null}

              {managed.length === 0 ? (
                <div className="dsh-cqa-field-hint">{t('manager.empty')}</div>
              ) : (
                <ul className="dsh-cqa-list" aria-labelledby={listTitleId}>
                  {managed.map((action, index) => (
                    <ManagedRow
                      key={quickActionRefKey(action.ref)}
                      action={action}
                      index={index}
                      total={managed.length}
                      readOnly={readOnly}
                      busy={busy}
                      canAdd={counts?.canAdd === true}
                      deleting={
                        action.ref.source === 'custom' && pendingDelete === action.ref.id
                      }
                      t={t}
                      onMove={move}
                      onEdit={() => {
                        setForm({ target: { kind: 'edit', id: action.ref.id }, draft: draftOf(action), attempted: false })
                      }}
                      onClone={() => {
                        run(() => controller.clonePreset(action.ref.id))
                      }}
                      onToggleHidden={() => {
                        run(() => controller.setPresetHidden(action.ref.id, !action.hidden))
                      }}
                      onToggleEnabled={() => {
                        run(() => controller.setCustomActionEnabled(action.ref.id, action.hidden))
                      }}
                      onAskDelete={() => {
                        setPendingDelete(action.ref.id)
                      }}
                      onCancelDelete={() => {
                        setPendingDelete(undefined)
                      }}
                      onConfirmDelete={() => {
                        void remove(action.ref.id)
                      }}
                    />
                  ))}
                </ul>
              )}
            </div>

            {form === undefined ? null : (
              <ActionForm
                mode={form.target.kind}
                draft={form.draft}
                attempted={form.attempted}
                readOnly={readOnly}
                busy={busy}
                t={t}
                onChange={(draft) => {
                  setForm({ ...form, draft })
                }}
                onSave={() => {
                  void save()
                }}
                onCancel={() => {
                  setForm(undefined)
                }}
              />
            )}
          </>
        )}
      </div>
    </>
  )
}

/** One row of the management list: what it is, and everything the user may do to it. */
function ManagedRow(props: {
  readonly action: ProjectedQuickAction
  readonly index: number
  readonly total: number
  readonly readOnly: boolean
  readonly busy: boolean
  readonly canAdd: boolean
  readonly deleting: boolean
  readonly t: Translate
  readonly onMove: (ref: QuickActionRef, toIndex: number) => void
  readonly onEdit: () => void
  readonly onClone: () => void
  readonly onToggleHidden: () => void
  readonly onToggleEnabled: () => void
  readonly onAskDelete: () => void
  readonly onCancelDelete: () => void
  readonly onConfirmDelete: () => void
}): ReactElement {
  const { action, index, total, readOnly, busy, canAdd, deleting, t } = props
  const key = quickActionRefKey(action.ref)

  return (
    <li className="dsh-cqa-list-item" data-quick-action={key} data-quick-action-hidden={action.hidden ? '' : undefined}>
      <span className="dsh-cqa-list-head">
        {action.icon === undefined ? null : (
          <span className="dsh-cqa-icon" aria-hidden="true">
            {action.icon}
          </span>
        )}
        <span className="dsh-cqa-label">{action.label}</span>
        {action.command ? <span className="dsh-cqa-badge">{t('command.badge')}</span> : null}
        <span className="dsh-cqa-tag">{t(action.editable ? 'manager.custom' : 'manager.preset')}</span>
        {action.hidden ? (
          <span className="dsh-cqa-tag" data-quick-actions-state="hidden">
            {t(action.editable ? 'manager.disabled' : 'manager.hidden')}
          </span>
        ) : null}
        {action.clonedFromPresetId === undefined ? null : (
          <span className="dsh-cqa-tag">{t('manager.clonedFrom')}</span>
        )}
      </span>

      {/* A one-line preview; the whole text is in the form and in the confirmation. */}
      <span className="dsh-cqa-list-text">{action.text}</span>

      <span className="dsh-cqa-list-controls">
        <button
          type="button"
          className="dsh-cqa-entry"
          data-quick-actions-move="up"
          {...pressProps({
            readOnly,
            blocked: busy || index === 0,
            onPress: () => {
              props.onMove(action.ref, index - 1)
            },
          })}
        >
          {t('manager.moveUp')}
        </button>
        <button
          type="button"
          className="dsh-cqa-entry"
          data-quick-actions-move="down"
          {...pressProps({
            readOnly,
            blocked: busy || index === total - 1,
            onPress: () => {
              props.onMove(action.ref, index + 1)
            },
          })}
        >
          {t('manager.moveDown')}
        </button>

        {action.editable ? (
          <>
            <button
              type="button"
              className="dsh-cqa-entry"
              {...pressProps({ readOnly, blocked: busy, onPress: props.onEdit })}
            >
              {t('manager.edit')}
            </button>
            <button
              type="button"
              className="dsh-cqa-entry"
              {...pressProps({ readOnly, blocked: busy, onPress: props.onToggleEnabled })}
            >
              {t(action.hidden ? 'manager.enable' : 'manager.disable')}
            </button>
            {/*
              Deleting is the one control here that destroys user data, so it
              asks once in place rather than behind a second modal.
            */}
            {deleting ? (
              <>
                <button
                  type="button"
                  className="dsh-cqa-entry"
                  data-quick-actions-delete="confirm"
                  {...pressProps({ readOnly, blocked: busy, onPress: props.onConfirmDelete })}
                >
                  {t('manager.delete.confirm')}
                </button>
                <button type="button" className="dsh-cqa-entry" onClick={props.onCancelDelete}>
                  {t('manager.delete.cancel')}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="dsh-cqa-entry"
                data-quick-actions-delete="ask"
                {...pressProps({ readOnly, blocked: busy, onPress: props.onAskDelete })}
              >
                {t('manager.delete')}
              </button>
            )}
          </>
        ) : (
          <>
            <button
              type="button"
              className="dsh-cqa-entry"
              {...pressProps({ readOnly, blocked: busy, onPress: props.onToggleHidden })}
            >
              {t(action.hidden ? 'manager.restore' : 'manager.hide')}
            </button>
            <button
              type="button"
              className="dsh-cqa-entry"
              data-quick-actions-clone=""
              {...pressProps({ readOnly, blocked: busy || !canAdd, onPress: props.onClone })}
            >
              {t('manager.clone')}
            </button>
          </>
        )}
      </span>
    </li>
  )
}
