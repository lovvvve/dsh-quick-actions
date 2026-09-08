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
 * ## Failure, and the one retry
 *
 * Every write goes through one funnel, which also remembers how to run it again.
 * That is spec 10's 「提供明确重试」: the failure banner offers the retry, and
 * pressing it *re-plans* rather than replaying — the controller builds each plan
 * from the snapshot it holds at that moment, and a create mints a fresh Custom
 * Action ID per attempt. Nothing ever retries on its own; a silent replay could
 * submit a plan the user has already moved past.
 *
 * Each failure is named, because spec 10 asks for different handling per kind: a
 * refusal or a transport failure keeps the form content and the panel open,
 * while a revision conflict means the controller has already re-read the
 * authoritative state, so the notice asks the user to confirm the change again
 * against what is now on screen — this feature keeps no second offline truth.
 *
 * Nothing here reports success: the list is the feedback, and spec 9.5 forbids an
 * extra success toast.
 */
import { useCallback, useEffect, useId, useState } from 'react'
import type { ReactElement } from 'react'
import { ActionForm } from './ActionForm.js'
import { ManagedRow } from './ManagedRow.js'
import { pressProps } from './press.js'
import type { ManagerWriteGate } from './press.js'
import { managerFailureMessage, managerReadOnlyReason } from './status.js'
import { useFocusReturn, useInitialFocus, useModalKeys } from '../modal.js'
import {
  QUICK_ACTION_LAYOUTS,
  newQuickActionDraft,
  quickActionRefKey,
  validateQuickActionDraft,
} from '../../model/index.js'
import type {
  CustomActionId,
  ProjectedQuickAction,
  QuickActionDraft,
  QuickActionLayout,
  QuickActionRef,
} from '../../model/index.js'
import type { QuickActionsClientState, QuickActionsController, QuickActionWriteOutcome } from '../controller.js'
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

/** One controller write, as this panel runs it. */
type ManagerWrite = () => Promise<QuickActionWriteOutcome>

/**
 * How to run the last failed write again.
 *
 * A form save is remembered as a *kind* rather than as a closure, so the retry
 * saves whatever the form holds now: a user who fixed a field after the failure
 * must not have their earlier draft resubmitted behind their back.
 */
type PendingWrite = { readonly kind: 'form' } | { readonly kind: 'write'; readonly run: ManagerWrite }

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
  const [pending, setPending] = useState<PendingWrite | undefined>(undefined)

  const projection = client.projection
  const managed = projection?.managed ?? []
  const counts = projection?.counts
  const readOnlyReason = managerReadOnlyReason(client)
  const gate: ManagerWriteGate = {
    readOnly: readOnlyReason !== undefined,
    busy: client.writing,
    canAdd: counts?.canAdd === true,
  }

  // An action edited in one tab and deleted in another must not leave an editor
  // open over nothing: saving it would only ever answer `unknown-action`.
  const editingId = form?.target.kind === 'edit' ? form.target.id : undefined
  const editingLives =
    editingId === undefined ||
    managed.some((action) => action.editable && action.ref.source === 'custom' && action.ref.id === editingId)
  useEffect(() => {
    if (!editingLives) setForm(undefined)
  }, [editingLives])

  /**
   * The one funnel every write goes through: remember it, run it, and answer
   * whether it landed.
   *
   * The `catch` is the belt. A controller write answers with an outcome rather
   * than rejecting, so this arm should be unreachable — but an unhandled
   * rejection must never reach the page from a click handler, and the failure
   * the user sees comes from the snapshot the controller publishes either way.
   */
  const write = useCallback(async (remember: PendingWrite, run: ManagerWrite): Promise<boolean> => {
    setPending(remember)
    try {
      const outcome = await run()
      if (outcome.ok) setPending(undefined)
      return outcome.ok
    } catch {
      return false
    }
  }, [])

  /** Start a write from a click handler, with no outcome to react to. */
  const fire = useCallback(
    (run: ManagerWrite): void => {
      void write({ kind: 'write', run }, run)
    },
    [write],
  )

  const save = useCallback(async (): Promise<void> => {
    if (form === undefined) return
    // Validated here as well as by the planner, so a fixable field is reported
    // without a round trip — and through the very same shared rules (spec 4.3).
    if (!validateQuickActionDraft(form.draft).ok) {
      setForm({ ...form, attempted: true })
      return
    }
    const { target, draft } = form
    const landed = await write({ kind: 'form' }, () =>
      target.kind === 'new'
        ? controller.createCustomAction(draft)
        : controller.updateCustomAction(target.id, draft),
    )
    // A failed write keeps the draft exactly as typed (spec 10); only a
    // persisted one closes the form.
    if (landed) setForm(undefined)
    else setForm({ ...form, attempted: true })
  }, [controller, form, write])

  const retry = useCallback((): void => {
    if (pending === undefined) return
    if (pending.kind === 'form') {
      void save()
      return
    }
    void write(pending, pending.run)
  }, [pending, save, write])

  const remove = useCallback(
    (id: CustomActionId): void => {
      const run: ManagerWrite = () => controller.deleteCustomAction(id)
      void write({ kind: 'write', run }, run).then((landed) => {
        if (landed) setPendingDelete(undefined)
      })
    },
    [controller, write],
  )

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
                // The controller reports a failed re-read through the catalog
                // state it publishes, and deliberately lets the promise reject;
                // swallowing it here is what keeps a retry from raising an
                // unhandled rejection on the page.
                controller.refresh().catch(() => undefined)
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
            {pending === undefined ? null : (
              <button type="button" className="dsh-cqa-link" data-quick-actions-write-retry="" onClick={retry}>
                {t('write.retry')}
              </button>
            )}
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
                    {...pressProps(gate, projection.layout === layout, () => {
                      fire(() => controller.setLayout(layout))
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
                  {...pressProps(gate, !gate.canAdd || form?.target.kind === 'new', () => {
                    setForm({ target: { kind: 'new' }, draft: newQuickActionDraft(), attempted: false })
                  })}
                >
                  {t('manager.new')}
                </button>
              </div>

              {/*
                The centralized Command Send Action explanation spec 8.3 requires.
                It stands whether or not a badge happens to be on screen: it is
                what the marker *means*, and a user about to write their first
                command text needs it before any marker exists. The form adds its
                own live warning on top of it.
              */}
              <p className="dsh-cqa-note" data-quick-actions-command-notice="">
                <span className="dsh-cqa-note-text">{t('manager.command.notice')}</span>
              </p>

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
                      gate={gate}
                      deleting={action.ref.source === 'custom' && pendingDelete === action.ref.id}
                      t={t}
                      on={{
                        onMove: (ref: QuickActionRef, toIndex: number) => {
                          fire(() => controller.moveAction(ref, toIndex))
                        },
                        onEdit: () => {
                          setForm({
                            target: { kind: 'edit', id: action.ref.id },
                            draft: draftOf(action),
                            attempted: false,
                          })
                        },
                        onClone: () => {
                          fire(() => controller.clonePreset(action.ref.id))
                        },
                        onToggleHidden: () => {
                          fire(() => controller.setPresetHidden(action.ref.id, !action.hidden))
                        },
                        onToggleEnabled: () => {
                          fire(() => controller.setCustomActionEnabled(action.ref.id, action.hidden))
                        },
                        onAskDelete: () => {
                          setPendingDelete(action.ref.id)
                        },
                        onCancelDelete: () => {
                          setPendingDelete(undefined)
                        },
                        onConfirmDelete: () => {
                          remove(action.ref.id)
                        },
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
                gate={gate}
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
