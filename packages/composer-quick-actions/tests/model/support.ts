/** Shared fixtures for the model specs: catalogs, accepted plans and readable orders. */
import {
  buildPresetCatalog,
  quickActionRefKey,
  type PresetCatalog,
  type QuickActionMutationOutcome,
  type QuickActionSettingsV1,
} from '../../src/model/index.js'

/** One valid preset config entry, with the fields under test overridden. */
export function presetConfig(id: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { id, label: id, text: `text for ${id}`, ...overrides }
}

/** Build a catalog, failing the test rather than the assertion when the config is wrong. */
export function catalogOf(...presets: readonly Record<string, unknown>[]): PresetCatalog {
  const result = buildPresetCatalog({ builtins: presets, configured: [] })
  if (!result.ok) throw new Error(`catalog rejected: ${JSON.stringify(result.issues)}`)
  return result.catalog
}

/** A catalog of plain presets identified only by id. */
export function catalogOfIds(...ids: readonly string[]): PresetCatalog {
  return catalogOf(...ids.map((id) => presetConfig(id)))
}

/** The snapshot a planner accepted, failing the test on a refusal. */
export function accepted(outcome: QuickActionMutationOutcome): QuickActionSettingsV1 {
  if (!outcome.ok) throw new Error(`mutation rejected: ${JSON.stringify(outcome.rejection)}`)
  return outcome.plan.next
}

/** The shared order as readable keys. */
export function orderOf(settings: QuickActionSettingsV1): readonly string[] {
  return settings.actionOrder.map(quickActionRefKey)
}
