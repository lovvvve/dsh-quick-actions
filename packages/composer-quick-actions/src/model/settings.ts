/**
 * Settings V1 decoding (spec 4.2, 6.3). Decoding is defensive and lossless: it
 * coerces shapes it recognises, falls back to documented defaults, and preserves
 * anything it cannot render as a tombstone rather than repairing or dropping it.
 * Catalog-aware canonicalization lives in `normalize.ts`.
 */
import { QUICK_ACTION_LAYOUTS } from './types.js'
import type {
  CustomQuickActionValue,
  PresetQuickActionState,
  QuickActionLayout,
  QuickActionRef,
  QuickActionSettingsV1,
  QuickActionTombstone,
  StoredQuickActionValue,
} from './types.js'

/**
 * The one namespace holding user data (spec 4.2); renaming it orphans every
 * stored section. It lives in the shared model because both faces address it:
 * the Host registers it, the Client binds the same name.
 */
export const QUICK_ACTIONS_SETTINGS_NAMESPACE = 'composer-quick-actions'

/**
 * The read-only namespace carrying the Preset Catalog to Clients (spec 17.2).
 * The plugin never writes its user layer, so it holds no persisted section —
 * `composer-quick-actions` remains the only persisted namespace (spec 4.2).
 */
export const QUICK_ACTIONS_CATALOG_NAMESPACE = 'composer-quick-actions-catalog'

/** The state a fresh install starts from (spec 4.2). */
export const DEFAULT_QUICK_ACTION_SETTINGS: QuickActionSettingsV1 = Object.freeze({
  schemaVersion: 1,
  layout: 'ribbon',
  userActionsById: Object.freeze({}),
  actionOrder: Object.freeze([]),
  presetStateById: Object.freeze({}),
})

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

/**
 * Whether a stored entry is a live Send Action this release can render.
 * Everything else is a tombstone: a higher version's `kind`, or a value whose
 * label/text are not readable strings.
 */
export function isLiveQuickAction(value: StoredQuickActionValue): value is CustomQuickActionValue {
  return value.kind === 'send' && typeof value.label === 'string' && typeof value.text === 'string'
}

/** Whether a stored entry must be preserved untouched and kept out of every projection (spec 5.3). */
export function isQuickActionTombstone(value: StoredQuickActionValue): value is QuickActionTombstone {
  return !isLiveQuickAction(value)
}

function decodeLayout(value: unknown): QuickActionLayout {
  return QUICK_ACTION_LAYOUTS.find((layout) => layout === value) ?? DEFAULT_QUICK_ACTION_SETTINGS.layout
}

/**
 * Read one stored custom action into canonical form. A missing `kind` reads as
 * `'send'` because V1 always writes the tag; anything else marks a tombstone and
 * is handed straight back by identity, so a value written by a higher version
 * survives the round trip intact.
 *
 * A live result always carries `kind`, `confirm` and `enabled` explicitly, which
 * is what spec 4.3 requires of every normalized action. `confirm` is only
 * defaulted when it is absent — never derived from the text.
 */
export function decodeStoredQuickAction(value: unknown): StoredQuickActionValue | undefined {
  const entry = asRecord(value)
  if (entry === undefined) return undefined

  const kind = entry.kind ?? 'send'
  if (kind !== 'send' || typeof entry.label !== 'string' || typeof entry.text !== 'string') {
    return entry
  }

  const { icon, confirm, enabled, clonedFromPresetId } = entry
  return {
    kind: 'send',
    label: entry.label,
    text: entry.text,
    ...(typeof icon === 'string' && icon !== '' ? { icon } : {}),
    confirm: typeof confirm === 'boolean' ? confirm : true,
    enabled: typeof enabled === 'boolean' ? enabled : true,
    ...(typeof clonedFromPresetId === 'string' ? { clonedFromPresetId } : {}),
  }
}

function decodeUserActions(value: unknown): Record<string, StoredQuickActionValue> {
  const entries = asRecord(value)
  if (entries === undefined) return {}
  const decoded: Record<string, StoredQuickActionValue> = {}
  for (const [id, raw] of Object.entries(entries)) {
    const action = decodeStoredQuickAction(raw)
    if (action !== undefined) decoded[id] = action
  }
  return decoded
}

function decodeRef(value: unknown): QuickActionRef | undefined {
  const entry = asRecord(value)
  if (entry === undefined) return undefined
  if (typeof entry.id !== 'string' || entry.id === '') return undefined
  if (entry.source === 'preset') return { source: 'preset', id: entry.id }
  if (entry.source === 'custom') return { source: 'custom', id: entry.id }
  return undefined
}

function decodeOrder(value: unknown): QuickActionRef[] {
  if (!Array.isArray(value)) return []
  return value.map(decodeRef).filter((ref): ref is QuickActionRef => ref !== undefined)
}

/**
 * Canonicalize one preset state: `hidden` becomes an explicit boolean or
 * disappears, and every other field is carried through so a higher version's own
 * preference survives a downgrade (spec 5.3).
 */
export function canonicalPresetState(state: Readonly<Record<string, unknown>>): PresetQuickActionState {
  const rest: Record<string, unknown> = { ...state }
  delete rest.hidden
  return state.hidden === true ? { ...rest, hidden: true } : rest
}

/** Whether a canonical preset state carries no user preference at all. */
export function isEmptyPresetState(state: PresetQuickActionState): boolean {
  return Object.keys(state).length === 0
}

function decodePresetState(value: unknown): Record<string, PresetQuickActionState> {
  const entries = asRecord(value)
  if (entries === undefined) return {}
  const decoded: Record<string, PresetQuickActionState> = {}
  for (const [id, raw] of Object.entries(entries)) {
    const state = asRecord(raw)
    if (state === undefined) continue
    decoded[id] = canonicalPresetState(state)
  }
  return decoded
}

/**
 * Decode any published snapshot into V1. The stored `schemaVersion` is not a
 * gate: a snapshot written by a higher version still yields every field this
 * release understands, which is what makes a downgrade round trip lossless.
 */
export function decodeQuickActionSettings(raw: unknown): QuickActionSettingsV1 {
  const stored = asRecord(raw)
  if (stored === undefined) return DEFAULT_QUICK_ACTION_SETTINGS
  return {
    schemaVersion: 1,
    layout: decodeLayout(stored.layout),
    userActionsById: decodeUserActions(stored.userActionsById),
    actionOrder: decodeOrder(stored.actionOrder),
    presetStateById: decodePresetState(stored.presetStateById),
  }
}
