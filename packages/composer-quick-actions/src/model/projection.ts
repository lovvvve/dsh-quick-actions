/**
 * Derived Quick Action state (spec 3, 5.4, 8.1). One pass over the canonical
 * order produces what the management panel lists, what the Composer renders and
 * the counts that gate the new and clone entry points.
 *
 * Preserved entries — references to presets this catalog no longer carries, and
 * tombstoned custom actions — are deliberately absent from both lists and from
 * the total: this release has no definition to render for them and must not let
 * them consume a user's action budget.
 *
 * `hidden` here is the Hidden Quick Action projection only (spec 3). Unavailable
 * Quick Actions are a per-session runtime state — current draft occupancy, native
 * guard, submission phase — that this module must not model, because it would need
 * the live Input snapshot the shared model is forbidden to depend on. The Composer
 * list is where that layer applies its own disabled state (spec 9.2).
 */
import { normalizeQuickActionSettings } from './normalize.js'
import { isLiveQuickAction, isQuickActionTombstone } from './settings.js'
import { isCommandSendActionText } from './text.js'
import type { PresetCatalog } from './catalog.js'
import type {
  PresetActionId,
  QuickActionLayout,
  QuickActionRef,
  QuickActionSettingsV1,
} from './types.js'

/** Normal ceiling on known presets plus every custom action (spec 5.4). */
export const QUICK_ACTION_TOTAL_LIMIT = 50

/** One action as the surfaces consume it, with its source-specific affordances resolved. */
export interface ProjectedQuickAction {
  readonly ref: QuickActionRef
  readonly label: string
  readonly text: string
  readonly icon: string | undefined
  readonly confirm: boolean
  /** Command Send Action: the text's first non-whitespace character is `/` (spec 4.3). */
  readonly command: boolean
  /** Presets are author-owned: the user may reorder, hide and clone them, never edit them. */
  readonly editable: boolean
  /** Hidden preset or disabled custom action: management panel only (spec 3). */
  readonly hidden: boolean
  readonly clonedFromPresetId: PresetActionId | undefined
}

/** The numbers the management panel gates its entry points and warnings on (spec 5.4). */
export interface QuickActionCounts {
  /** Known presets plus every custom action; hidden and disabled ones included. */
  readonly total: number
  readonly limit: number
  /** `total` already above `limit` — a passive overflow that never drops data. */
  readonly overflow: boolean
  /** Whether creating or cloning is allowed right now. */
  readonly canAdd: boolean
  readonly visible: number
  readonly hidden: number
  /** Entries preserved but kept out of every projection: unknown presets and tombstones. */
  readonly preserved: number
}

/** Everything the surfaces and the management panel derive from one snapshot. */
export interface QuickActionProjection {
  readonly layout: QuickActionLayout
  /** Everything the management panel lists, in the shared order. */
  readonly managed: readonly ProjectedQuickAction[]
  /** The subset the Composer renders, in the same order. */
  readonly composer: readonly ProjectedQuickAction[]
  readonly counts: QuickActionCounts
}

/**
 * Project one snapshot against a catalog. The snapshot is canonicalized first, so
 * the counts are the real totals even when the caller hands over state the catalog
 * has moved on from — a known preset or a live action missing from the order must
 * never slip past the action ceiling.
 */
export function projectQuickActions(
  raw: QuickActionSettingsV1,
  catalog: PresetCatalog,
): QuickActionProjection {
  const settings = normalizeQuickActionSettings(raw, catalog)
  const presets = new Map(catalog.presets.map((preset) => [preset.id, preset]))
  const managed: ProjectedQuickAction[] = []
  const referenced = new Set<string>()
  let preserved = 0

  for (const ref of settings.actionOrder) {
    if (ref.source === 'preset') {
      const preset = presets.get(ref.id)
      if (preset === undefined) {
        preserved += 1
        continue
      }
      managed.push({
        ref,
        label: preset.label,
        text: preset.text,
        icon: preset.icon,
        confirm: preset.confirm,
        command: isCommandSendActionText(preset.text),
        editable: false,
        hidden: settings.presetStateById[ref.id]?.hidden === true,
        clonedFromPresetId: undefined,
      })
      continue
    }

    referenced.add(ref.id)
    const value = settings.userActionsById[ref.id]
    if (value === undefined || !isLiveQuickAction(value)) {
      preserved += 1
      continue
    }
    managed.push({
      ref,
      label: value.label,
      text: value.text,
      icon: value.icon,
      confirm: value.confirm,
      command: isCommandSendActionText(value.text),
      editable: true,
      hidden: !value.enabled,
      clonedFromPresetId: value.clonedFromPresetId,
    })
  }

  for (const [id, value] of Object.entries(settings.userActionsById)) {
    if (!referenced.has(id) && isQuickActionTombstone(value)) preserved += 1
  }

  const composer = managed.filter((action) => !action.hidden)
  const total = managed.length
  return {
    layout: settings.layout,
    managed,
    composer,
    counts: {
      total,
      limit: QUICK_ACTION_TOTAL_LIMIT,
      overflow: total > QUICK_ACTION_TOTAL_LIMIT,
      canAdd: total < QUICK_ACTION_TOTAL_LIMIT,
      visible: composer.length,
      hidden: total - composer.length,
      preserved,
    },
  }
}
