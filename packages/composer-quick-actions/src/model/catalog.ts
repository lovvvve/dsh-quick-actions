/**
 * Preset Catalog assembly (spec 5.1): the package manifest followed by the Host
 * composition's `Config.presets`. The Host owns the catalog, so an invalid preset,
 * a duplicate Preset Action ID or an oversized catalog fails config loading loudly
 * instead of being silently truncated or overridden.
 */
import { iconIssue, labelIssue, textIssue } from './validation.js'
import type {
  PresetActionId,
  PresetQuickAction,
  QuickActionField,
  QuickActionFieldIssue,
  QuickActionIssueReason,
} from './types.js'

/** Absolute threshold on the merged catalog itself (spec 5.4). */
export const QUICK_ACTION_CATALOG_LIMIT = 50

/** Where a catalog entry was declared. */
export type PresetSource = 'builtin' | 'config'

/** What the Host feeds the model: raw JSON, validated here rather than upstream. */
export interface PresetCatalogInput {
  /** The package's built-in manifest, in declaration order. */
  readonly builtins: readonly unknown[]
  /** `Config.presets` from the Host composition, in declaration order. */
  readonly configured: readonly unknown[]
}

/** One reason the plugin config must fail to load. */
export type PresetCatalogIssue =
  | {
      readonly scope: 'preset'
      readonly source: PresetSource
      readonly index: number
      /** The declared id when it is a usable string, otherwise `undefined`. */
      readonly id: string | undefined
      readonly field: QuickActionField
      readonly reason: QuickActionIssueReason
    }
  | {
      readonly scope: 'catalog'
      readonly reason: 'too-many'
      readonly count: number
      readonly limit: number
    }

/** The authoritative, read-only catalog snapshot the Remote publishes (spec 6.2). */
export interface PresetCatalog {
  readonly schemaVersion: 1
  /** Determined by the catalog projection; any change to it changes this value. */
  readonly revision: string
  readonly presets: readonly PresetQuickAction[]
}

/** Either the authoritative catalog, or every reason config loading has to fail. */
export type PresetCatalogResult =
  | { readonly ok: true; readonly catalog: PresetCatalog }
  | { readonly ok: false; readonly issues: readonly PresetCatalogIssue[] }

const FNV_OFFSET_BASIS = 0x6c62272e07bb014262b821756295c58dn
const FNV_PRIME = 0x0000000001000000000000000000013bn
const FNV_MASK = (1n << 128n) - 1n

function fnv1a128(value: string): string {
  let hash = FNV_OFFSET_BASIS
  for (const byte of new TextEncoder().encode(value)) {
    hash = ((hash ^ BigInt(byte)) * FNV_PRIME) & FNV_MASK
  }
  return hash.toString(16).padStart(32, '0')
}

/**
 * Hash the whole catalog projection, field by field and in order, so that any
 * change a client could observe — including a pure reordering — moves the
 * revision, and an unchanged catalog never does (spec 6.2).
 */
function revisionOf(presets: readonly PresetQuickAction[]): string {
  const canonical = JSON.stringify([
    1,
    presets.map((preset) => [preset.id, preset.kind, preset.label, preset.text, preset.icon ?? null, preset.confirm]),
  ])
  return fnv1a128(canonical)
}

function fieldIssue(field: QuickActionField, reason: QuickActionIssueReason): QuickActionFieldIssue {
  return { field, reason }
}

function readId(entry: Record<string, unknown>): { id: string } | { issue: QuickActionFieldIssue } {
  const { id } = entry
  if (id === undefined) return { issue: fieldIssue('id', 'missing') }
  if (typeof id !== 'string') return { issue: fieldIssue('id', 'invalid-type') }
  if (id.trim().length === 0) return { issue: fieldIssue('id', 'blank') }
  return { id }
}

function readPreset(
  entry: Record<string, unknown>,
  id: PresetActionId,
): { preset: PresetQuickAction } | { issue: QuickActionFieldIssue } {
  if (entry.kind !== undefined && entry.kind !== 'send') return { issue: fieldIssue('kind', 'unsupported') }

  const { label, text, icon, confirm } = entry
  if (typeof label !== 'string') return { issue: fieldIssue('label', label === undefined ? 'missing' : 'invalid-type') }
  const labelProblem = labelIssue(label)
  if (labelProblem !== undefined) return { issue: labelProblem }

  if (typeof text !== 'string') return { issue: fieldIssue('text', text === undefined ? 'missing' : 'invalid-type') }
  const textProblem = textIssue(text)
  if (textProblem !== undefined) return { issue: textProblem }

  if (icon !== undefined && typeof icon !== 'string') return { issue: fieldIssue('icon', 'invalid-type') }
  if (icon === '') return { issue: fieldIssue('icon', 'blank') }
  if (icon !== undefined) {
    const iconProblem = iconIssue(icon)
    if (iconProblem !== undefined) return { issue: iconProblem }
  }

  if (confirm !== undefined && typeof confirm !== 'boolean') return { issue: fieldIssue('confirm', 'invalid-type') }

  return {
    preset: {
      id,
      kind: 'send',
      label: label.trim(),
      text,
      ...(icon === undefined ? {} : { icon }),
      confirm: confirm ?? true,
    },
  }
}

/**
 * Merge and validate the built-in manifest with the Host composition's presets.
 * Nothing is repaired or dropped: the first release refuses to load a catalog an
 * author got wrong, so the mistake surfaces at startup rather than at send time.
 */
export function buildPresetCatalog(input: PresetCatalogInput): PresetCatalogResult {
  const issues: PresetCatalogIssue[] = []
  const presets: PresetQuickAction[] = []
  const seen = new Set<PresetActionId>()

  const sources: readonly (readonly [PresetSource, readonly unknown[]])[] = [
    ['builtin', input.builtins],
    ['config', input.configured],
  ]

  for (const [source, entries] of sources) {
    for (const [index, entry] of entries.entries()) {
      const at = (issue: QuickActionFieldIssue, id: string | undefined): PresetCatalogIssue => ({
        scope: 'preset',
        source,
        index,
        id,
        field: issue.field,
        reason: issue.reason,
      })

      if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
        issues.push(at(fieldIssue('id', 'invalid-type'), undefined))
        continue
      }

      const record = entry as Record<string, unknown>
      const identity = readId(record)
      if ('issue' in identity) {
        issues.push(at(identity.issue, undefined))
        continue
      }
      if (seen.has(identity.id)) {
        issues.push(at(fieldIssue('id', 'duplicate'), identity.id))
        continue
      }

      const read = readPreset(record, identity.id)
      if ('issue' in read) {
        issues.push(at(read.issue, identity.id))
        continue
      }
      seen.add(identity.id)
      presets.push(read.preset)
    }
  }

  const count = input.builtins.length + input.configured.length
  if (count > QUICK_ACTION_CATALOG_LIMIT) {
    issues.push({ scope: 'catalog', reason: 'too-many', count, limit: QUICK_ACTION_CATALOG_LIMIT })
  }

  if (issues.length > 0) return { ok: false, issues }
  return { ok: true, catalog: { schemaVersion: 1, revision: revisionOf(presets), presets } }
}
