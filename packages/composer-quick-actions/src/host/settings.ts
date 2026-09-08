/**
 * The single persisted Settings namespace and the Host's canonical rewrite
 * (spec 4.2, 6.1, 6.3).
 *
 * The Host is the sole validation and migration authority, so the registered
 * schema is deliberately permissive: it fixes the shape of the section and its
 * defaults, and nothing else. A strict schema would refuse registration for a
 * section a higher version wrote — which is exactly the data spec 5.3 requires
 * to survive a downgrade untouched. The shared model decodes and normalizes what
 * the schema lets through, and it never rewrites content it cannot render.
 */
import Schema from '@deepseek-ai/schemastery'
import {
  QUICK_ACTIONS_SETTINGS_NAMESPACE,
  decodeQuickActionSettings,
  deepEqualJson,
  normalizeQuickActionSettings,
} from '../model/index.js'
import type { PresetCatalog, QuickActionSettingsV1 } from '../model/index.js'

/**
 * Shape and defaults of the persisted section (spec 4.2). The three collections
 * stay unconstrained on purpose: a stricter schema would refuse registration for
 * a section this release cannot render, and refusing registration is how stored
 * data gets lost. The shared model is the validation gate — see the module note.
 */
export const quickActionSettingsSchema = Schema.object({
  schemaVersion: Schema.number().default(1),
  layout: Schema.string().default('ribbon'),
  userActionsById: Schema.any().default({}),
  actionOrder: Schema.any().default([]),
  presetStateById: Schema.any().default({}),
})

/**
 * Shape of the catalog namespace. Its authoritative content is the composition
 * `base` layer the Host declares; a user layer is never written and, if one were
 * hand-written into the document, Clients would still read `base` (spec 17.2).
 */
export const quickActionCatalogSchema = Schema.object({
  schemaVersion: Schema.number().default(1),
  revision: Schema.string().default(''),
  presets: Schema.any().default([]),
})

/** One namespace as the provider describes it. */
export interface SettingsDescriptorLike {
  readonly ns: string
  /** Monotonic revision of the raw user section; send it back to fence a write. */
  readonly revision: number
  /** The raw stored user section, absent while nothing was ever written. */
  readonly user?: unknown
}

/**
 * The part of the Host settings provider the canonical rewrite reads and writes
 * through. Declared structurally so the rewrite is testable against a controlled
 * fake — the real `SettingsProvider` satisfies it as-is.
 */
export interface SettingsRewriteProvider {
  readonly writable: boolean
  describe(): readonly SettingsDescriptorLike[]
  replace(ns: string, section: object, expectedRevision?: number): Promise<void>
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
  /** The namespace is not registered yet, so there is nothing to fence a write to. */
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
 * user layer would shadow the composition `base` and destroy what `replace({})`
 * resets to. Nothing is written for a higher `schemaVersion` either — that data
 * belongs to the version that wrote it.
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

    const stored = descriptor.user
    if (stored === undefined) return { status: 'nothing-stored' }
    const storedVersion = storedSchemaVersion(stored)
    if (storedVersion > 1) return { status: 'newer-version', schemaVersion: storedVersion }

    const canonical = canonicalSettings(stored, catalog)
    if (deepEqualJson(stored, canonical)) return { status: 'unchanged' }

    try {
      await settings.replace(QUICK_ACTIONS_SETTINGS_NAMESPACE, canonical, descriptor.revision)
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
