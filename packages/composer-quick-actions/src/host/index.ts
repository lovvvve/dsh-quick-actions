/**
 * Host ownership of the Quick Action state (spec 6.1, 22): it merges and
 * validates the Preset Catalog, canonicalizes the stored section behind a
 * revision fence, and serves the authoritative catalog snapshot.
 *
 * Since DSH 0.1.7 there is nothing to register: the plugin's own Config is its
 * Settings form (spec 22.1). The Host never reaches past Settings to a file or
 * a storage backend, and it never substitutes its own storage when the
 * provider is missing.
 */
import { readComposerQuickActionsConfig } from './config.js'
import { rewriteCanonicalSettings } from './settings.js'
import type { CanonicalRewriteOutcome, SettingsRewriteProvider } from './settings.js'
import type { PresetCatalog } from '../model/index.js'

/**
 * The read-only catalog projection (spec 6.2). It is the catalog itself under
 * the name the spec gives it — one shape, so the Host cannot publish something
 * the model never validated.
 */
export type CatalogSnapshot = PresetCatalog

/** The Host settings provider as this plugin uses it; the real `SettingsForms` satisfies it. */
export type QuickActionsSettingsProvider = SettingsRewriteProvider

/** The running Host, owned by the fiber that started it. */
export interface QuickActionsHost {
  /**
   * The authoritative catalog as lossless JSON. Each call hands back a detached
   * copy, so a consumer cannot reach the authoritative catalog through the value
   * it was given.
   */
  describeCatalog(): Promise<CatalogSnapshot>
  /**
   * Canonicalize the stored section against this catalog (spec 6.3). Only
   * meaningful once the entry is active: before that the provider does not
   * serve the form, and the answer is `unregistered`.
   */
  canonicalize(settings: QuickActionsSettingsProvider): Promise<CanonicalRewriteOutcome>
}

/** A copy nothing can reach the authoritative catalog through. */
function detachedCatalog(catalog: PresetCatalog): CatalogSnapshot {
  return JSON.parse(JSON.stringify(catalog)) as CatalogSnapshot
}

/**
 * Load and validate the catalog.
 *
 * An invalid preset configuration throws: the catalog is author-owned, so a
 * mistake fails plugin loading rather than silently shipping a partial catalog
 * (spec 5.1).
 *
 * @param config - the Host composition entry's config.
 */
export function startQuickActionsHost(config: unknown): QuickActionsHost {
  const loaded = readComposerQuickActionsConfig(config)
  if (!loaded.ok) throw new Error(loaded.message)
  const { catalog } = loaded

  return {
    describeCatalog: async () => detachedCatalog(catalog),
    canonicalize: (settings) => rewriteCanonicalSettings(settings, catalog),
  }
}
