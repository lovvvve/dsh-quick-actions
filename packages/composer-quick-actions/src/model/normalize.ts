/**
 * Deterministic, idempotent canonicalization of decoded Settings against the
 * current Preset Catalog (spec 5.3). The same input and catalog always produce
 * the same result, and normalizing twice changes nothing — which is what lets the
 * Host rewrite behind a revision fence without fighting its own writes.
 *
 * Normalization repairs references and re-states the discriminant, never content.
 * In particular it never derives `confirm` from the text: that default is
 * initialized when an action is created or cloned, so rewriting it here would undo
 * the user's choice on every load and break idempotence.
 */
import {
  canonicalPresetState,
  decodeQuickActionSettings,
  decodeStoredQuickAction,
  isEmptyPresetState,
  isLiveQuickAction,
} from './settings.js'
import { quickActionRefKey } from './types.js'
import type { PresetCatalog } from './catalog.js'
import type {
  PresetQuickActionState,
  QuickActionRef,
  QuickActionSettingsV1,
  StoredQuickActionValue,
} from './types.js'

/**
 * Canonicalize one decoded snapshot against a catalog.
 *
 * Order: existing references keep their positions, minus repeats and minus
 * references to custom actions that are gone; references to presets this catalog
 * no longer carries stay put, because the same Preset Action ID coming back must
 * restore the user's preference. Known actions with no reference are appended —
 * presets in catalog order, then custom actions in stored order. Tombstones are
 * never given a new reference, so a downgrade round trip returns their exact order.
 */
export function normalizeQuickActionSettings(
  settings: QuickActionSettingsV1,
  catalog: PresetCatalog,
): QuickActionSettingsV1 {
  const knownPresetIds = new Set(catalog.presets.map((preset) => preset.id))
  const placed = new Set<string>()
  const actionOrder: QuickActionRef[] = []

  const place = (ref: QuickActionRef): void => {
    const key = quickActionRefKey(ref)
    if (placed.has(key)) return
    placed.add(key)
    actionOrder.push(ref)
  }

  const userActionsById: Record<string, StoredQuickActionValue> = {}
  for (const [id, stored] of Object.entries(settings.userActionsById)) {
    const value = decodeStoredQuickAction(stored)
    if (value !== undefined) userActionsById[id] = value
  }

  for (const ref of settings.actionOrder) {
    if (ref.source === 'custom' && userActionsById[ref.id] === undefined) continue
    place(ref)
  }
  for (const preset of catalog.presets) place({ source: 'preset', id: preset.id })
  for (const [id, value] of Object.entries(userActionsById)) {
    if (isLiveQuickAction(value)) place({ source: 'custom', id })
  }

  const presetStateById: Record<string, PresetQuickActionState> = {}
  for (const [id, stored] of Object.entries(settings.presetStateById)) {
    const state = canonicalPresetState(stored)
    if (!knownPresetIds.has(id)) presetStateById[id] = state
    else if (!isEmptyPresetState(state)) presetStateById[id] = state
  }

  return {
    schemaVersion: 1,
    layout: settings.layout,
    userActionsById,
    actionOrder,
    presetStateById,
  }
}

/** Decode a raw persisted value and canonicalize it in one step — the Host's read path. */
export function readQuickActionSettings(raw: unknown, catalog: PresetCatalog): QuickActionSettingsV1 {
  return normalizeQuickActionSettings(decodeQuickActionSettings(raw), catalog)
}
