/**
 * Host ownership of the Quick Action state (spec 6.1): it merges and validates
 * the Preset Catalog, registers the one Settings namespace, canonicalizes the
 * stored section behind a revision fence, and serves the authoritative
 * read-only catalog snapshot.
 *
 * The Host never reaches past Settings to a file or a storage backend, and it
 * never substitutes its own storage when the provider is missing — the plugin
 * declares `settings` as a hard dependency and waits.
 */
import { readComposerQuickActionsConfig } from './config.js'
import {
  QUICK_ACTIONS_SETTINGS_NAMESPACE,
  quickActionSettingsSchema,
  rewriteCanonicalSettings,
} from './settings.js'
import type { CanonicalRewriteOutcome, SettingsRewriteProvider } from './settings.js'
import type { PresetCatalog } from '../model/index.js'

/**
 * The read-only catalog projection published to Clients (spec 6.2). It is the
 * catalog itself under the name the spec gives it on the wire — one shape, so
 * the Host cannot publish something the model never validated.
 */
export type CatalogSnapshot = PresetCatalog

/**
 * The Host settings provider as this plugin uses it: namespace registration plus
 * the fenced write face. Declared structurally so the Host is testable against a
 * controlled fake; the real `SettingsProvider` satisfies it.
 */
export interface QuickActionsSettingsProvider extends SettingsRewriteProvider {
  register(ns: string, schema: unknown, options?: unknown): unknown
}

/** The running Host, owned by the fiber that started it. */
export interface QuickActionsHost {
  /** Settles when the startup canonical rewrite has been attempted. */
  readonly ready: Promise<CanonicalRewriteOutcome>
  /**
   * The read-only Remote payload (spec 6.2): lossless JSON, no Settings CRUD.
   * Each call hands back a detached copy, so a consumer cannot reach the
   * authoritative catalog through the value it was given.
   */
  describeCatalog(): Promise<CatalogSnapshot>
}

/**
 * Load the catalog, register the namespace and canonicalize the stored section.
 *
 * An invalid preset configuration throws before anything is registered: the
 * catalog is author-owned, so a mistake fails plugin loading rather than
 * silently shipping a partial catalog (spec 5.1).
 *
 * @param settings - the Host settings provider.
 * @param config - the Host composition entry's config.
 */
export function startQuickActionsHost(
  settings: QuickActionsSettingsProvider,
  config: unknown,
): QuickActionsHost {
  const loaded = readComposerQuickActionsConfig(config)
  if (!loaded.ok) throw new Error(loaded.message)
  const { catalog } = loaded

  settings.register(QUICK_ACTIONS_SETTINGS_NAMESPACE, quickActionSettingsSchema, { applies: 'live' })

  return {
    ready: rewriteCanonicalSettings(settings, catalog),
    describeCatalog: async () => JSON.parse(JSON.stringify(catalog)) as CatalogSnapshot,
  }
}
