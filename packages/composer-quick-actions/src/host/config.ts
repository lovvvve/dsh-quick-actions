/**
 * Host composition config: the author-facing `presets` list, merged behind the
 * package's built-in manifest into the authoritative Preset Catalog (spec 5.1).
 *
 * The Host owns the catalog, so this fails loudly. An invalid preset, a
 * duplicate Preset Action ID, a `kind` this release cannot run, or a catalog
 * over fifty entries makes plugin config loading fail with a message naming
 * every problem at once — never a silent truncation or a last-one-wins merge.
 */
import { BUILT_IN_PRESETS, buildPresetCatalog } from '../model/index.js'
import type { PresetCatalog, PresetCatalogIssue } from '../model/index.js'

/** What a Host composition may declare for this plugin. */
export interface ComposerQuickActionsConfig {
  /** Preset Quick Actions appended after the package's built-in manifest. */
  readonly presets?: readonly unknown[]
}

export type ComposerQuickActionsConfigResult =
  | { readonly ok: true; readonly catalog: PresetCatalog }
  | { readonly ok: false; readonly message: string }

function describeIssue(issue: PresetCatalogIssue): string {
  if (issue.scope === 'catalog') {
    return `the preset catalog holds ${String(issue.count)} presets, above the limit of ${String(issue.limit)}`
  }
  const at = issue.source === 'builtin' ? `built-in presets[${String(issue.index)}]` : `presets[${String(issue.index)}]`
  const named = issue.id === undefined ? at : `${at} ("${issue.id}")`
  return `${named}: ${issue.field} is ${issue.reason}`
}

/**
 * The plain value behind one Config field. A Loader-resolved config hands each
 * volatile field over as a `Volatile` reference (spec 22.2); a composition that
 * calls `apply` directly hands the plain value.
 */
function readVolatile(field: unknown): unknown {
  if (typeof field === 'object' && field !== null && typeof (field as { get?: unknown }).get === 'function') {
    return (field as { get(): unknown }).get()
  }
  return field
}

/**
 * Read one Host composition config into the authoritative catalog.
 * @param config - the composition entry's config, absent when nothing was declared.
 */
export function readComposerQuickActionsConfig(config: unknown): ComposerQuickActionsConfigResult {
  const declared = readVolatile((config as { presets?: unknown } | undefined)?.presets)
  if (declared !== undefined && !Array.isArray(declared)) {
    return { ok: false, message: 'composer-quick-actions: `presets` must be a list of preset quick actions' }
  }

  const result = buildPresetCatalog({ builtins: BUILT_IN_PRESETS, configured: declared ?? [] })
  if (result.ok) return { ok: true, catalog: result.catalog }
  return {
    ok: false,
    message: `composer-quick-actions: invalid preset configuration\n${result.issues.map((issue) => `  - ${describeIssue(issue)}`).join('\n')}`,
  }
}
