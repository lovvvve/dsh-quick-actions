/**
 * The plugin's Config — which since DSH 0.1.7 *is* its Settings form — and the
 * Host's canonical rewrite (spec 4.2, 6.1, 6.3, 22).
 *
 * The Host is the sole validation and migration authority, so the schema is
 * deliberately permissive: it fixes the shape of the section and its defaults,
 * and nothing else. A strict schema would refuse a section a higher version
 * wrote — which is exactly the data spec 5.3 requires to survive a downgrade
 * untouched. The shared model decodes and normalizes what the schema lets
 * through, and it never rewrites content it cannot render.
 */
import Schema from '@deepseek-ai/schemastery'
import {
  QUICK_ACTIONS_SETTINGS_NAMESPACE,
  QUICK_ACTION_STATE_FIELDS,
  decodeQuickActionSettings,
  deepEqualJson,
  normalizeQuickActionSettings,
} from '../model/index.js'
import type { PresetCatalog, QuickActionSettingsV1 } from '../model/index.js'

/**
 * The plugin Config (spec 22.2). Every field is `volatile`, because DSH lets a
 * Settings form — and so the Client — reach volatile fields only.
 *
 * - The five user-state fields are top-level on purpose: the DSH legacy import
 *   moves an old `settings.yaml` section into the entry of the same id key by
 *   key, and refuses the whole section when any top-level key is not a volatile
 *   field. This exact shape is what lets that one-shot import land.
 * - `presets` is the author's list merged behind the built-ins (spec 5.1). It
 *   is volatile only so the Client can read it — a non-volatile field never
 *   reaches the browser — and nothing in this plugin ever writes it.
 *
 * The collections stay unconstrained: a stricter schema would refuse a section
 * this release cannot render, and refusing it is how stored data gets lost.
 */
export const Config = Schema.object({
  presets: Schema.any().default([]).volatile(),
  schemaVersion: Schema.number().default(1).volatile(),
  layout: Schema.string().default('ribbon').volatile(),
  userActionsById: Schema.any().default({}).volatile(),
  actionOrder: Schema.any().default([]).volatile(),
  presetStateById: Schema.any().default({}).volatile(),
})

/** One path-addressed field write, as the settings provider takes it. */
export interface SettingsSetOp {
  readonly op: 'set'
  readonly path: readonly string[]
  readonly value: unknown
}

/** One form as the provider describes it. */
export interface SettingsDescriptorLike {
  readonly ns: string
  /** Monotonic revision of the raw entry configuration; send it back to fence a write. */
  readonly revision: number
  /** The form fields the active profile patch sets. */
  readonly user?: unknown
}

/**
 * The part of the Host settings provider the canonical rewrite reads and writes
 * through. Declared structurally so the rewrite is testable against a controlled
 * fake — the real `SettingsForms` satisfies it as-is.
 */
export interface SettingsRewriteProvider {
  readonly writable: boolean
  describe(): readonly SettingsDescriptorLike[]
  mutate(ns: string, ops: readonly SettingsSetOp[], expectedRevision?: number): Promise<void>
}

/**
 * One write per user-state field, never touching `presets`: the author's list
 * shares the entry's config, and a write that restated it would pin whatever it
 * read into the profile layer.
 */
export function stateOps(section: QuickActionSettingsV1): readonly SettingsSetOp[] {
  return QUICK_ACTION_STATE_FIELDS.map((field) => ({ op: 'set', path: [field], value: section[field] }))
}

/**
 * The user-state fields the profile layer actually sets, or `undefined` when it
 * sets none. The same layer may carry the author's `presets`; those are Config,
 * not stored state, so a profile holding only presets has nothing stored.
 */
export function storedState(user: unknown): Readonly<Record<string, unknown>> | undefined {
  if (typeof user !== 'object' || user === null || Array.isArray(user)) return undefined
  const fields = Object.entries(user).filter(([field]) =>
    (QUICK_ACTION_STATE_FIELDS as readonly string[]).includes(field),
  )
  return fields.length === 0 ? undefined : Object.fromEntries(fields)
}

export type CanonicalRewriteOutcome =
  /** The stored section already was canonical; nothing was written. */
  | { readonly status: 'unchanged' }
  /** Nothing is stored yet, so there is no stored state to canonicalize. */
  | { readonly status: 'nothing-stored' }
  /**
   * The stored section belongs to a higher `schemaVersion`. This release reads it
   * losslessly but must not write it back, or a downgrade would stamp its own
   * version over data it does not own (spec 5.3, 16.1).
   */
  | { readonly status: 'newer-version'; readonly schemaVersion: number }
  | { readonly status: 'rewritten'; readonly revision: number }
  /** The namespace kept moving; the rewrite refused to overwrite the writer that won. */
  | { readonly status: 'conflict'; readonly attempts: number }
  | { readonly status: 'read-only' }
  /** The form is not served — the entry is not active — so there is nothing to fence a write to. */
  | { readonly status: 'unregistered' }

/** Recognize a revision conflict by its stable code, never by prototype (realm copies). */
function isConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'SETTINGS_CONFLICT'
  )
}

/** How many times a conflicting rewrite refreshes and tries again before giving up. */
const REWRITE_ATTEMPTS = 3

/**
 * Read the stored section, canonicalize it against the current catalog, and
 * persist it behind the revision it was read at (spec 6.3).
 *
 * Nothing is written when nothing is stored: materializing the defaults into the
 * profile layer would shadow every layer below it for good. Nothing is written
 * for a higher `schemaVersion` either — that data belongs to the version that
 * wrote it.
 *
 * A conflict means another writer won the race, so the rewrite refreshes the
 * authoritative snapshot and recomputes rather than replaying its own stale
 * section; after a bounded number of attempts it reports the conflict instead of
 * overwriting the concurrent write.
 */
export async function rewriteCanonicalSettings(
  settings: SettingsRewriteProvider,
  catalog: PresetCatalog,
): Promise<CanonicalRewriteOutcome> {
  if (!settings.writable) return { status: 'read-only' }

  for (let attempt = 1; attempt <= REWRITE_ATTEMPTS; attempt += 1) {
    const descriptor = settings.describe().find((candidate) => candidate.ns === QUICK_ACTIONS_SETTINGS_NAMESPACE)
    if (descriptor === undefined) return { status: 'unregistered' }

    const stored = storedState(descriptor.user)
    if (stored === undefined) return { status: 'nothing-stored' }
    const storedVersion = storedSchemaVersion(stored)
    if (storedVersion > 1) return { status: 'newer-version', schemaVersion: storedVersion }

    const canonical = canonicalSettings(stored, catalog)
    if (deepEqualJson(stored, canonical)) return { status: 'unchanged' }

    try {
      await settings.mutate(QUICK_ACTIONS_SETTINGS_NAMESPACE, stateOps(canonical), descriptor.revision)
      return { status: 'rewritten', revision: descriptor.revision }
    } catch (error) {
      if (!isConflict(error)) throw error
    }
  }
  return { status: 'conflict', attempts: REWRITE_ATTEMPTS }
}

/** The `schemaVersion` a stored section declares; anything unreadable counts as this release's. */
function storedSchemaVersion(stored: unknown): number {
  const declared = (stored as { schemaVersion?: unknown } | null)?.schemaVersion
  return typeof declared === 'number' && Number.isFinite(declared) ? declared : 1
}

/** Decode one raw stored section and canonicalize it against the catalog. */
export function canonicalSettings(stored: unknown, catalog: PresetCatalog): QuickActionSettingsV1 {
  return normalizeQuickActionSettings(decodeQuickActionSettings(stored), catalog)
}
