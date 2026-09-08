/**
 * One row of the management list: what the action is, and everything the user
 * may do to it (spec 3, 5.1, 5.2, 8.3).
 *
 * The two sources differ in exactly the way spec 5.1 says they must: a Preset
 * Quick Action may be reordered, hidden, restored and cloned — never edited or
 * deleted, because its definition is the author's — while a Custom Quick Action
 * has its whole life cycle here.
 *
 * A hidden or disabled action is rendered, dimmed and labelled, never removed:
 * removal from the Composer is the Hidden Quick Action projection, and this
 * panel is where it stays recoverable (spec 3).
 */
import type { ReactElement } from 'react'
import { Button, Pill } from '@deepseek-ai/dsh-client-ui-primitives'
import { pressProps } from './press.js'
import type { ManagerWriteGate } from './press.js'
import { ActionFace } from '../surfaces/ActionFace.js'
import { quickActionRefKey } from '../../model/index.js'
import type { ProjectedQuickAction, QuickActionRef } from '../../model/index.js'
import type { Translate } from '../dsh.js'

/** Everything one row can ask the panel to do. */
export interface ManagedRowHandlers {
  readonly onMove: (ref: QuickActionRef, toIndex: number) => void
  readonly onEdit: () => void
  readonly onClone: () => void
  readonly onToggleHidden: () => void
  readonly onToggleEnabled: () => void
  readonly onAskDelete: () => void
  readonly onCancelDelete: () => void
  readonly onConfirmDelete: () => void
}

export interface ManagedRowProps {
  readonly action: ProjectedQuickAction
  /** Position in the shared order, which is what the move controls address. */
  readonly index: number
  readonly total: number
  readonly gate: ManagerWriteGate
  /** Whether this row has already been asked about deleting. */
  readonly deleting: boolean
  readonly t: Translate
  readonly on: ManagedRowHandlers
}

export function ManagedRow({ action, index, total, gate, deleting, t, on }: ManagedRowProps): ReactElement {
  return (
    <li
      className="dsh-cqa-list-item"
      data-quick-action={quickActionRefKey(action.ref)}
      data-quick-action-hidden={action.hidden ? '' : undefined}
    >
      <span className="dsh-cqa-list-head">
        <ActionFace action={action} t={t} />
        <Pill className="dsh-cqa-tag">{t(action.editable ? 'manager.custom' : 'manager.preset')}</Pill>
        {action.hidden ? (
          <Pill active className="dsh-cqa-tag">
            {t(action.editable ? 'manager.disabled' : 'manager.hidden')}
          </Pill>
        ) : null}
        {action.clonedFromPresetId === undefined ? null : (
          <Pill className="dsh-cqa-tag">{t('manager.clonedFrom')}</Pill>
        )}
      </span>

      {/* A one-line preview; the whole text is in the form and in the confirmation. */}
      <span className="dsh-cqa-list-text">{action.text}</span>

      <span className="dsh-cqa-list-controls">
        <Button variant="toolbar" size="sm"
          className="dsh-cqa-entry"
          data-quick-actions-move="up"
          {...pressProps(gate, index === 0, () => {
            on.onMove(action.ref, index - 1)
          })}
        >
          {t('manager.moveUp')}
        </Button>
        <Button variant="toolbar" size="sm"
          className="dsh-cqa-entry"
          data-quick-actions-move="down"
          {...pressProps(gate, index === total - 1, () => {
            on.onMove(action.ref, index + 1)
          })}
        >
          {t('manager.moveDown')}
        </Button>

        {action.editable ? (
          <>
            <Button variant="toolbar" size="sm" className="dsh-cqa-entry" {...pressProps(gate, false, on.onEdit)}>
              {t('manager.edit')}
            </Button>
            <Button variant="toolbar" size="sm" className="dsh-cqa-entry" {...pressProps(gate, false, on.onToggleEnabled)}>
              {t(action.hidden ? 'manager.enable' : 'manager.disable')}
            </Button>
            {/*
              Deleting is the one control here that destroys user data, so it
              asks once in place rather than behind a second modal. Backing out
              is never gated: it writes nothing.
            */}
            {deleting ? (
              <>
                <Button variant="toolbar" size="sm"
                  className="dsh-cqa-entry"
                  data-quick-actions-delete="confirm"
                  {...pressProps(gate, false, on.onConfirmDelete)}
                >
                  {t('manager.delete.confirm')}
                </Button>
                <Button variant="toolbar" size="sm" className="dsh-cqa-entry" onClick={on.onCancelDelete}>
                  {t('manager.delete.cancel')}
                </Button>
              </>
            ) : (
              <Button variant="toolbar" size="sm"
                className="dsh-cqa-entry"
                data-quick-actions-delete="ask"
                {...pressProps(gate, false, on.onAskDelete)}
              >
                {t('manager.delete')}
              </Button>
            )}
          </>
        ) : (
          <>
            <Button variant="toolbar" size="sm" className="dsh-cqa-entry" {...pressProps(gate, false, on.onToggleHidden)}>
              {t(action.hidden ? 'manager.restore' : 'manager.hide')}
            </Button>
            <Button variant="toolbar" size="sm"
              className="dsh-cqa-entry"
              data-quick-actions-clone=""
              {...pressProps(gate, !gate.canAdd, on.onClone)}
            >
              {t('manager.clone')}
            </Button>
          </>
        )}
      </span>
    </li>
  )
}
