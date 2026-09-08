/**
 * The Custom Quick Action form (spec 8.3).
 *
 * It edits exactly four things — label, static text, optional emoji and the send
 * confirmation — and validates them through the shared model, so a draft this
 * form accepts is a draft the Host will accept (spec 4.3).
 *
 * ## What this form deliberately does not have
 *
 * - **An action-type selector.** `kind` is not a configuration field: the first
 *   release is always `'send'`, and no user path may change it (spec 4.1, 16.1).
 * - **Any control the Command Send Action warning locks.** When the text becomes
 *   a command the form warns and nothing else (spec 8.3, 16.1): the warning
 *   states that the text enters DSH's own adjudication path, that the
 *   confirmation panel shows no native `/` suggestion menu, and that with
 *   confirmation off the command is submitted in one click with no preview. The
 *   confirmation switch stays editable throughout.
 * - **Any rewrite of `confirm` in response to the text.** The default is applied
 *   once, when a draft is created or cloned (`newQuickActionDraft`, the clone
 *   planner). Deriving it from the text here would silently undo the user's own
 *   choice every time they edited the text — the same reason spec 4.3 forbids
 *   normalization from touching it.
 *
 * The draft lives in the caller's state, which is what makes "a failed write
 * keeps the form content" (spec 10) structural rather than incidental.
 */
import { useId } from 'react'
import type { ReactElement } from 'react'
import {
  QUICK_ACTION_ICON_MAX_CLUSTERS,
  QUICK_ACTION_LABEL_MAX_CODE_POINTS,
  QUICK_ACTION_TEXT_MAX_CODE_POINTS,
  isCommandSendActionText,
  validateQuickActionDraft,
} from '../../model/index.js'
import type { QuickActionDraft, QuickActionField, QuickActionFieldIssue } from '../../model/index.js'
import { quickActionIssueKey } from '../../locales/index.js'
import type { Translate } from '../dsh.js'

export interface ActionFormProps {
  /** `new` for a creation, `edit` for an existing Custom Quick Action. */
  readonly mode: 'new' | 'edit'
  readonly draft: QuickActionDraft
  /**
   * Whether the user has already tried to save. Blank fields only report
   * themselves after that, so a freshly opened form does not open shouting.
   */
  readonly attempted: boolean
  /** Sustained, external unavailability: the fields themselves go inert. */
  readonly readOnly: boolean
  /**
   * A write is in flight. The buttons report it with `aria-disabled` rather than
   * `disabled`, so the Save the user just pressed keeps the keyboard caret; the
   * fields stay live, because a momentary write must not eat a keystroke.
   */
  readonly busy: boolean
  readonly t: Translate
  readonly onChange: (draft: QuickActionDraft) => void
  readonly onSave: () => void
  readonly onCancel: () => void
}

/**
 * The issues to render for one draft.
 *
 * Every rule comes from the shared model; the only presentation decision is that
 * a blank field stays quiet until the user has tried to save it.
 */
export function visibleQuickActionIssues(
  draft: QuickActionDraft,
  attempted: boolean,
): readonly QuickActionFieldIssue[] {
  const validated = validateQuickActionDraft(draft)
  if (validated.ok) return []
  return attempted ? validated.issues : validated.issues.filter((issue) => issue.reason !== 'blank')
}

/** One labelled field, whose hint slot carries the field's issue when it has one. */
function Field(props: {
  readonly field: QuickActionField
  readonly label: string
  readonly hint: string
  readonly issue: QuickActionFieldIssue | undefined
  readonly t: Translate
  readonly children: (bound: { readonly id: string; readonly describedBy: string; readonly invalid: boolean }) => ReactElement
}): ReactElement {
  const { field, label, hint, issue, t, children } = props
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  // The label element carries the field name and nothing else: a wrapping label
  // would fold the hint into the control's accessible name, and the hint is a
  // description (spec 8.4 wants a visible text label, not a paragraph for a name).
  //
  // The hint stays on screen beside an error rather than being replaced by it:
  // the hint is where the limits are stated, and the limits come from the model's
  // own constants — an error sentence that restated them would be a second copy
  // free to drift.
  return (
    <div className="dsh-cqa-field">
      <label className="dsh-cqa-field-label" htmlFor={id}>
        {label}
      </label>
      {children({ id, describedBy: issue === undefined ? hintId : `${hintId} ${errorId}`, invalid: issue !== undefined })}
      <span className="dsh-cqa-field-hint" id={hintId}>
        {hint}
      </span>
      {issue === undefined ? null : (
        <span className="dsh-cqa-field-error" id={errorId} data-quick-actions-issue={field}>
          {t(quickActionIssueKey(issue))}
        </span>
      )}
    </div>
  )
}

export function ActionForm(props: ActionFormProps): ReactElement {
  const { mode, draft, attempted, readOnly, busy, t, onChange, onSave, onCancel } = props
  const issues = visibleQuickActionIssues(draft, attempted)
  const issueFor = (field: QuickActionField): QuickActionFieldIssue | undefined =>
    issues.find((issue) => issue.field === field)
  const command = isCommandSendActionText(draft.text)
  const titleId = useId()

  return (
    <div className="dsh-cqa-form" role="group" aria-labelledby={titleId} data-quick-actions-form={mode}>
      <span className="dsh-cqa-section-title" id={titleId}>
        {t(mode === 'new' ? 'form.title.new' : 'form.title.edit')}
      </span>

      <Field
        field="label"
        label={t('form.label')}
        hint={t('form.label.hint', { max: QUICK_ACTION_LABEL_MAX_CODE_POINTS })}
        issue={issueFor('label')}
        t={t}
      >
        {({ id, describedBy, invalid }) => (
          <input
            className="dsh-cqa-input"
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            disabled={readOnly}
            value={draft.label}
            onChange={(event) => {
              onChange({ ...draft, label: event.target.value })
            }}
          />
        )}
      </Field>

      <Field
        field="text"
        label={t('form.text')}
        hint={t('form.text.hint', { max: QUICK_ACTION_TEXT_MAX_CODE_POINTS })}
        issue={issueFor('text')}
        t={t}
      >
        {({ id, describedBy, invalid }) => (
          <textarea
            className="dsh-cqa-textarea"
            id={id}
            rows={4}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            disabled={readOnly}
            value={draft.text}
            onChange={(event) => {
              onChange({ ...draft, text: event.target.value })
            }}
          />
        )}
      </Field>

      {/*
        The Command Send Action warning. `role="status"` rather than `alert`: it
        is a consequence of what the user typed, not an error, and it locks
        nothing — including the confirmation switch right below it.
      */}
      {command ? (
        <p className="dsh-cqa-note" role="status" data-quick-actions-command-warning="">
          <span className="dsh-cqa-note-text">{t('form.command.warning')}</span>
        </p>
      ) : null}

      <Field
        field="icon"
        label={t('form.icon')}
        hint={t('form.icon.hint', { max: QUICK_ACTION_ICON_MAX_CLUSTERS })}
        issue={issueFor('icon')}
        t={t}
      >
        {({ id, describedBy, invalid }) => (
          <input
            className="dsh-cqa-input"
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            disabled={readOnly}
            value={draft.icon}
            onChange={(event) => {
              onChange({ ...draft, icon: event.target.value })
            }}
          />
        )}
      </Field>

      <label className="dsh-cqa-switch">
        <input
          type="checkbox"
          disabled={readOnly}
          checked={draft.confirm}
          data-quick-actions-confirm-switch=""
          onChange={(event) => {
            onChange({ ...draft, confirm: event.target.checked })
          }}
        />
        <span className="dsh-cqa-field-label">{t('form.confirm')}</span>
      </label>

      <div className="dsh-cqa-form-actions">
        <button
          type="button"
          className="dsh-cqa-entry"
          disabled={readOnly}
          aria-disabled={busy}
          onClick={() => {
            if (readOnly || busy) return
            onCancel()
          }}
        >
          {t('form.cancel')}
        </button>
        <button
          type="button"
          className="dsh-cqa-entry"
          disabled={readOnly}
          aria-disabled={busy}
          onClick={() => {
            if (readOnly || busy) return
            onSave()
          }}
        >
          {t('form.save')}
        </button>
      </div>
    </div>
  )
}
