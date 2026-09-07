/**
 * Revision-fenced Settings mutation planning (spec 5.2, 5.4, 6.3, 10).
 *
 * A planner is pure: it takes the last Host-confirmed snapshot and returns the
 * canonical snapshot to persist together with the revision the write must be
 * fenced to. It performs no I/O and mints no identity — the caller supplies each
 * new Custom Action ID, so a UUID collision comes back as a refusal to retry
 * rather than as a silent overwrite.
 */
import { deepEqualJson } from './json.js'
import { normalizeQuickActionSettings } from './normalize.js'
import { isLiveQuickAction } from './settings.js'
import { projectQuickActions } from './projection.js'
import { quickActionRefKey } from './types.js'
import { validateQuickActionDraft } from './validation.js'
import type { PresetCatalog } from './catalog.js'
import type { QuickActionDraft } from './validation.js'
import type {
  CustomActionId,
  CustomQuickActionValue,
  PresetActionId,
  PresetQuickActionState,
  QuickActionFieldIssue,
  QuickActionLayout,
  QuickActionRef,
  QuickActionSettingsV1,
  StoredQuickActionValue,
} from './types.js'

/** What every planner reads: the confirmed snapshot, the catalog it was read against, and its revision. */
export interface QuickActionMutationContext {
  readonly settings: QuickActionSettingsV1
  readonly catalog: PresetCatalog
  /** The Settings namespace revision the resulting write must carry (spec 6.3). */
  readonly revision: string
}

/** What to persist, and the fence the write must carry. */
export interface QuickActionMutationPlan {
  readonly expectedRevision: string
  readonly next: QuickActionSettingsV1
  /** False when the plan would persist exactly what is already stored. */
  readonly changed: boolean
}

/** Why a planner refused; each reason maps to one management-panel response (spec 10). */
export type QuickActionMutationRejectionReason =
  /** One or more fields failed the shared validation rules. */
  | 'invalid-fields'
  /** Creating or cloning while the action total is at or above the ceiling. */
  | 'limit-reached'
  /** The target action is absent, or is a tombstone this release must not touch. */
  | 'unknown-action'
  /** The requested Custom Action ID is taken; mint another and retry. */
  | 'id-in-use'
  /** The submitted order is not a permutation of the managed actions. */
  | 'invalid-order'

/** A refusal, with the field issues to render when the reason is a validation failure. */
export interface QuickActionMutationRejection {
  readonly reason: QuickActionMutationRejectionReason
  readonly issues: readonly QuickActionFieldIssue[]
}

/** Either a plan to persist behind the fence, or a refusal to show the user. */
export type QuickActionMutationOutcome =
  | { readonly ok: true; readonly plan: QuickActionMutationPlan }
  | { readonly ok: false; readonly rejection: QuickActionMutationRejection }

/** The draft the management form opens on; the only place the confirm default is applied. */
export function newQuickActionDraft(): QuickActionDraft {
  return { label: '', text: '', icon: '', confirm: true }
}

function refuse(
  reason: QuickActionMutationRejectionReason,
  issues: readonly QuickActionFieldIssue[] = [],
): QuickActionMutationOutcome {
  return { ok: false, rejection: { reason, issues } }
}

function unknownAction(): QuickActionMutationOutcome {
  return refuse('unknown-action', [{ field: 'id', reason: 'missing' }])
}

function planFrom(
  context: QuickActionMutationContext,
  current: QuickActionSettingsV1,
  next: QuickActionSettingsV1,
): QuickActionMutationOutcome {
  const canonical = normalizeQuickActionSettings(next, context.catalog)
  return {
    ok: true,
    plan: { expectedRevision: context.revision, next: canonical, changed: !deepEqualJson(current, canonical) },
  }
}

/** Every planner starts from the canonical reading of the confirmed snapshot. */
function currentOf(context: QuickActionMutationContext): QuickActionSettingsV1 {
  return normalizeQuickActionSettings(context.settings, context.catalog)
}

function withUserActions(
  settings: QuickActionSettingsV1,
  userActionsById: Readonly<Record<CustomActionId, StoredQuickActionValue>>,
): QuickActionSettingsV1 {
  return { ...settings, userActionsById }
}

function liveActionOf(
  settings: QuickActionSettingsV1,
  id: CustomActionId,
): CustomQuickActionValue | undefined {
  const value = settings.userActionsById[id]
  if (value === undefined || !isLiveQuickAction(value)) return undefined
  return value
}

/** Build one stored Send Action with every field spec 4.3 requires stated explicitly. */
function sendActionValue(input: {
  readonly label: string
  readonly text: string
  readonly icon: string | undefined
  readonly confirm: boolean
  readonly enabled: boolean
  readonly clonedFromPresetId: PresetActionId | undefined
}): CustomQuickActionValue {
  return {
    kind: 'send',
    label: input.label,
    text: input.text,
    ...(input.icon === undefined ? {} : { icon: input.icon }),
    confirm: input.confirm,
    enabled: input.enabled,
    ...(input.clonedFromPresetId === undefined ? {} : { clonedFromPresetId: input.clonedFromPresetId }),
  }
}

/**
 * Check a caller-minted Custom Action ID before it is persisted. A taken id comes
 * back as `id-in-use` so the caller mints another UUID and retries; normalization
 * must never renumber an id that is already stored (spec 4.1).
 */
function identityRefusal(
  settings: QuickActionSettingsV1,
  id: CustomActionId,
): QuickActionMutationOutcome | undefined {
  if (id === '') return refuse('invalid-fields', [{ field: 'id', reason: 'blank' }])
  if (settings.userActionsById[id] !== undefined) {
    return refuse('id-in-use', [{ field: 'id', reason: 'duplicate' }])
  }
  return undefined
}

function planWithAction(
  context: QuickActionMutationContext,
  current: QuickActionSettingsV1,
  id: CustomActionId,
  value: CustomQuickActionValue,
): QuickActionMutationOutcome {
  return planFrom(context, current, withUserActions(current, { ...current.userActionsById, [id]: value }))
}

/** Create a Custom Quick Action under a caller-minted identity (spec 5.2, 5.4). */
export function planCreateCustomQuickAction(
  context: QuickActionMutationContext,
  input: { readonly id: CustomActionId; readonly draft: QuickActionDraft },
): QuickActionMutationOutcome {
  const current = currentOf(context)
  if (!projectQuickActions(current, context.catalog).counts.canAdd) return refuse('limit-reached')
  const refusal = identityRefusal(current, input.id)
  if (refusal !== undefined) return refusal

  const validated = validateQuickActionDraft(input.draft)
  if (!validated.ok) return refuse('invalid-fields', validated.issues)

  return planWithAction(
    context,
    current,
    input.id,
    sendActionValue({ ...validated.value, enabled: true, clonedFromPresetId: undefined }),
  )
}

/**
 * Clone a Preset Quick Action into a new Custom Quick Action (spec 5.2).
 * The confirmation policy is copied as it stands — including a Command Send
 * Action the author left unconfirmed — never re-defaulted.
 */
export function planClonePresetQuickAction(
  context: QuickActionMutationContext,
  input: { readonly presetId: PresetActionId; readonly id: CustomActionId },
): QuickActionMutationOutcome {
  const current = currentOf(context)
  if (!projectQuickActions(current, context.catalog).counts.canAdd) return refuse('limit-reached')

  const preset = context.catalog.presets.find((candidate) => candidate.id === input.presetId)
  if (preset === undefined) return unknownAction()
  const refusal = identityRefusal(current, input.id)
  if (refusal !== undefined) return refusal

  return planWithAction(
    context,
    current,
    input.id,
    sendActionValue({
      label: preset.label,
      text: preset.text,
      icon: preset.icon,
      confirm: preset.confirm,
      enabled: true,
      clonedFromPresetId: preset.id,
    }),
  )
}

/**
 * Save edited content onto an existing Custom Quick Action. `enabled` and the
 * Clone Provenance survive the edit; `confirm` comes from the form, which is the
 * only place the user can change it.
 */
export function planUpdateCustomQuickAction(
  context: QuickActionMutationContext,
  input: { readonly id: CustomActionId; readonly draft: QuickActionDraft },
): QuickActionMutationOutcome {
  const current = currentOf(context)
  const existing = liveActionOf(current, input.id)
  if (existing === undefined) return unknownAction()

  const validated = validateQuickActionDraft(input.draft)
  if (!validated.ok) return refuse('invalid-fields', validated.issues)

  return planWithAction(
    context,
    current,
    input.id,
    sendActionValue({
      ...validated.value,
      enabled: existing.enabled,
      clonedFromPresetId: existing.clonedFromPresetId,
    }),
  )
}

/** Disable or re-enable a Custom Quick Action; disabled actions stay in the management panel (spec 3). */
export function planSetCustomQuickActionEnabled(
  context: QuickActionMutationContext,
  input: { readonly id: CustomActionId; readonly enabled: boolean },
): QuickActionMutationOutcome {
  const current = currentOf(context)
  const existing = liveActionOf(current, input.id)
  if (existing === undefined) return unknownAction()
  return planWithAction(context, current, input.id, { ...existing, enabled: input.enabled })
}

/** Delete a Custom Quick Action; normalization drops its order reference with it. */
export function planDeleteCustomQuickAction(
  context: QuickActionMutationContext,
  input: { readonly id: CustomActionId },
): QuickActionMutationOutcome {
  const current = currentOf(context)
  if (liveActionOf(current, input.id) === undefined) return unknownAction()
  const userActionsById = { ...current.userActionsById }
  delete userActionsById[input.id]
  return planFrom(context, current, withUserActions(current, userActionsById))
}

/** Hide or restore a Preset Quick Action; the author's definition is never touched (spec 5.1). */
export function planSetPresetQuickActionHidden(
  context: QuickActionMutationContext,
  input: { readonly presetId: PresetActionId; readonly hidden: boolean },
): QuickActionMutationOutcome {
  const current = currentOf(context)
  if (!context.catalog.presets.some((preset) => preset.id === input.presetId)) return unknownAction()

  const presetStateById: Record<PresetActionId, PresetQuickActionState> = { ...current.presetStateById }
  if (input.hidden) presetStateById[input.presetId] = { hidden: true }
  else delete presetStateById[input.presetId]
  return planFrom(context, current, { ...current, presetStateById })
}

/**
 * Apply a new order to the actions the management panel lists. Preserved
 * references — unknown presets and tombstones — keep their exact positions, so a
 * reorder here never disturbs data a higher version owns.
 */
export function planReorderQuickActions(
  context: QuickActionMutationContext,
  input: { readonly order: readonly QuickActionRef[] },
): QuickActionMutationOutcome {
  const current = currentOf(context)
  const managed = projectQuickActions(current, context.catalog).managed.map((action) => action.ref)

  const managedKeys = new Set(managed.map(quickActionRefKey))
  const wanted = input.order.map(quickActionRefKey)
  if (wanted.length !== managedKeys.size || new Set(wanted).size !== wanted.length) return refuse('invalid-order')
  if (!wanted.every((key) => managedKeys.has(key))) return refuse('invalid-order')

  const queue = [...input.order]
  const actionOrder = current.actionOrder.map((ref) =>
    managedKeys.has(quickActionRefKey(ref)) ? queue.shift() ?? ref : ref,
  )
  return planFrom(context, current, { ...current, actionOrder })
}

/** Move one managed action to another position in the management list. */
export function planMoveQuickAction(
  context: QuickActionMutationContext,
  input: { readonly ref: QuickActionRef; readonly toIndex: number },
): QuickActionMutationOutcome {
  const current = currentOf(context)
  const managed = projectQuickActions(current, context.catalog).managed.map((action) => action.ref)
  const from = managed.findIndex((candidate) => quickActionRefKey(candidate) === quickActionRefKey(input.ref))
  if (from === -1) return unknownAction()
  if (!Number.isInteger(input.toIndex) || input.toIndex < 0 || input.toIndex >= managed.length) {
    return refuse('invalid-order')
  }

  const order = [...managed]
  const [moved] = order.splice(from, 1)
  if (moved === undefined) return refuse('invalid-order')
  order.splice(input.toIndex, 0, moved)
  return planReorderQuickActions(context, { order })
}

/** Switch the global Quick Action Layout (spec 8.1). */
export function planSetQuickActionLayout(
  context: QuickActionMutationContext,
  input: { readonly layout: QuickActionLayout },
): QuickActionMutationOutcome {
  const current = currentOf(context)
  return planFrom(context, current, { ...current, layout: input.layout })
}
