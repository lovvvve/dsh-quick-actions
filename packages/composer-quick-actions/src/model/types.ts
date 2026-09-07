/**
 * Normalized Quick Action domain types (spec 4.1, 4.2) plus the field-issue
 * vocabulary every validation entry point reports through (spec 4.3).
 * Every type here is plain JSON: no cordis, React, DOM or storage handles.
 */

/** Author-assigned, package-scoped, permanent identity of a Preset Quick Action. */
export type PresetActionId = string
/** UUID minted when a Custom Quick Action is created; stable for its whole life. */
export type CustomActionId = string

/**
 * Action-type discriminant. The first release is always `'send'`; it is not a
 * configuration field. Keeping the tag lets a later Insert Action ship without
 * raising `schemaVersion` or rewriting stored user data (spec 4.1, 16.1).
 */
export type QuickActionKind = 'send'

/** The three global Quick Action Layouts (spec 8.1). */
export type QuickActionLayout = 'ribbon' | 'bar' | 'launcher'

/** Every layout value, in the order the management panel offers them. */
export const QUICK_ACTION_LAYOUTS: readonly QuickActionLayout[] = ['ribbon', 'bar', 'launcher']

/** Author-owned, user-read-only action from the Preset Catalog (spec 4.1). */
export interface PresetQuickAction {
  readonly id: PresetActionId
  readonly kind: QuickActionKind
  readonly label: string
  readonly text: string
  readonly icon?: string
  readonly confirm: boolean
}

/** User-owned action stored in Settings (spec 4.1). */
export interface CustomQuickActionValue {
  readonly kind: QuickActionKind
  readonly label: string
  readonly text: string
  readonly icon?: string
  readonly confirm: boolean
  readonly enabled: boolean
  readonly clonedFromPresetId?: PresetActionId
}

/**
 * A stored custom entry this release cannot render: its `kind` is not `'send'`
 * (real data from a higher version) or its label/text are not readable strings.
 * Preserved verbatim — never displayed, counted, edited or rewritten (spec 5.3).
 * Every field stays opaque on purpose, `kind` included: this release must hand
 * the record back to the version that wrote it exactly as it found it.
 */
export interface QuickActionTombstone {
  readonly [field: string]: unknown
}

/** One entry of `userActionsById`: either a live send action or a preserved tombstone. */
export type StoredQuickActionValue = CustomQuickActionValue | QuickActionTombstone

/** Reference into the single mixed order shared by presets and custom actions (spec 4.1). */
export type QuickActionRef =
  | { readonly source: 'preset'; readonly id: PresetActionId }
  | { readonly source: 'custom'; readonly id: CustomActionId }

/**
 * The identity of a reference as one comparable string. Source and id together
 * are the identity: the same id under a different source is a different action.
 */
export function quickActionRefKey(ref: QuickActionRef): string {
  return `${ref.source}:${ref.id}`
}

/**
 * User difference stored against one Preset Action ID (spec 4.2). `hidden` is the
 * only field this release writes; any other field belongs to the version that
 * wrote it and is carried through untouched.
 */
export interface PresetQuickActionState {
  readonly hidden?: boolean
  readonly [field: string]: unknown
}

/** The only persisted namespace shape (spec 4.2). */
export interface QuickActionSettingsV1 {
  readonly schemaVersion: 1
  readonly layout: QuickActionLayout
  readonly userActionsById: Readonly<Record<CustomActionId, StoredQuickActionValue>>
  readonly actionOrder: readonly QuickActionRef[]
  readonly presetStateById: Readonly<Record<PresetActionId, PresetQuickActionState>>
}

/** Fields a validation issue can be attached to. */
export type QuickActionField =
  | 'id'
  | 'kind'
  | 'label'
  | 'text'
  | 'icon'
  | 'confirm'
  | 'enabled'
  | 'clonedFromPresetId'

/** Why a field was rejected. Combined with `field` it addresses one dictionary entry. */
export type QuickActionIssueReason =
  | 'invalid-type'
  | 'missing'
  | 'blank'
  | 'too-long'
  | 'reserved-placeholder'
  | 'not-emoji'
  | 'duplicate'
  | 'unsupported'

/** One field-level rejection, reported identically by config loading, forms and mutations. */
export interface QuickActionFieldIssue {
  readonly field: QuickActionField
  readonly reason: QuickActionIssueReason
}
