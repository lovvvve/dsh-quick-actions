/**
 * The single set of Quick Action field rules (spec 4.3). Preset config loading,
 * the management form, migration and Settings mutations all validate here, so a
 * text the model accepts is exactly a text the Composer may submit unchanged.
 */
import {
  containsReservedReferencePlaceholder,
  countCodePoints,
  isBlankQuickActionText,
  scanEmojiClusters,
} from './text.js'
import type { QuickActionFieldIssue } from './types.js'

/** Label limit, in Unicode code points, measured after trimming (spec 4.3). */
export const QUICK_ACTION_LABEL_MAX_CODE_POINTS = 40
/** Static text limit, in Unicode code points, measured without trimming (spec 4.3). */
export const QUICK_ACTION_TEXT_MAX_CODE_POINTS = 4000
/** Icon limit, in emoji grapheme clusters (spec 4.3). */
export const QUICK_ACTION_ICON_MAX_CLUSTERS = 4

/** What the management form edits; an empty `icon` means the action has no icon. */
export interface QuickActionDraft {
  readonly label: string
  readonly text: string
  readonly icon: string
  readonly confirm: boolean
}

/** The stored content of a validated draft, shared by preset and custom actions. */
export interface QuickActionContent {
  readonly label: string
  readonly text: string
  readonly icon: string | undefined
  readonly confirm: boolean
}

/** Either the content to persist, or every field that has to be fixed first. */
export type QuickActionDraftResult =
  | { readonly ok: true; readonly value: QuickActionContent }
  | { readonly ok: false; readonly issues: readonly QuickActionFieldIssue[] }

/** Trimmed label, or the reason it cannot be stored. */
export function labelIssue(label: string): QuickActionFieldIssue | undefined {
  const trimmed = label.trim()
  if (trimmed.length === 0) return { field: 'label', reason: 'blank' }
  if (countCodePoints(trimmed) > QUICK_ACTION_LABEL_MAX_CODE_POINTS) {
    return { field: 'label', reason: 'too-long' }
  }
  return undefined
}

/** The reason a static text cannot be stored, if any. */
export function textIssue(text: string): QuickActionFieldIssue | undefined {
  if (isBlankQuickActionText(text)) return { field: 'text', reason: 'blank' }
  if (countCodePoints(text) > QUICK_ACTION_TEXT_MAX_CODE_POINTS) return { field: 'text', reason: 'too-long' }
  if (containsReservedReferencePlaceholder(text)) return { field: 'text', reason: 'reserved-placeholder' }
  return undefined
}

/** The reason a non-empty icon cannot be stored, if any. */
export function iconIssue(icon: string): QuickActionFieldIssue | undefined {
  const { clusters, emojiOnly } = scanEmojiClusters(icon)
  if (!emojiOnly) return { field: 'icon', reason: 'not-emoji' }
  if (clusters > QUICK_ACTION_ICON_MAX_CLUSTERS) return { field: 'icon', reason: 'too-long' }
  return undefined
}

/**
 * Validate one edited or created action. Issues come back in field declaration
 * order — label, text, icon — so the form can render them deterministically.
 */
export function validateQuickActionDraft(draft: QuickActionDraft): QuickActionDraftResult {
  const issues = [labelIssue(draft.label), textIssue(draft.text), draft.icon === '' ? undefined : iconIssue(draft.icon)]
    .filter((issue): issue is QuickActionFieldIssue => issue !== undefined)
  if (issues.length > 0) return { ok: false, issues }
  return {
    ok: true,
    value: {
      label: draft.label.trim(),
      text: draft.text,
      icon: draft.icon === '' ? undefined : draft.icon,
      confirm: draft.confirm,
    },
  }
}
