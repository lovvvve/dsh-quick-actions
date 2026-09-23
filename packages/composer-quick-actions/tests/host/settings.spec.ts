import { describe, expect, it } from 'vitest'
import {
  QUICK_ACTIONS_SETTINGS_NAMESPACE,
  QUICK_ACTION_STATE_FIELDS,
  buildPresetCatalog,
  type PresetCatalog,
} from '../../src/model/index.js'
import {
  Config,
  rewriteCanonicalSettings,
  stateOps,
  type SettingsRewriteProvider,
  type SettingsSetOp,
} from '../../src/host/settings.js'

function catalogOf(...ids: readonly string[]): PresetCatalog {
  const result = buildPresetCatalog({
    builtins: ids.map((id) => ({ id, label: id, text: `text for ${id}` })),
    configured: [],
  })
  if (!result.ok) throw new Error('unexpected catalog rejection')
  return result.catalog
}

class ConflictError extends Error {
  readonly code = 'SETTINGS_CONFLICT'
  constructor(readonly expected: number, readonly actual: number) {
    super(`settings conflict: expected ${String(expected)}, actual ${String(actual)}`)
  }
}

/** The plain value behind one resolved Config field. */
function plain(field: unknown): unknown {
  return (field as { get(): unknown }).get()
}

/**
 * A controlled stand-in for DSH `SettingsForms`: one entry's form, described
 * only while the entry is active, written path by path behind a revision fence.
 */
class FakeSettings implements SettingsRewriteProvider {
  writable = true
  /** Whether the entry is active, which is when DSH describes its form at all. */
  served = false
  revision = 3
  /** The form fields the active profile patch sets. */
  user: Record<string, unknown> | undefined = undefined
  readonly writes: { ops: readonly SettingsSetOp[]; expectedRevision: number | undefined }[] = []
  /** Revisions to advance behind the caller's back, one per write attempt. */
  conflictsRemaining = 0

  describe(): readonly { ns: string; revision: number; user?: unknown }[] {
    if (!this.served) return []
    // Like the shipped provider, an entry the profile sets nothing for still
    // describes an (empty) projection of its profile layer.
    return [{ ns: QUICK_ACTIONS_SETTINGS_NAMESPACE, revision: this.revision, user: structuredClone(this.user ?? {}) }]
  }

  async mutate(ns: string, ops: readonly SettingsSetOp[], expectedRevision?: number): Promise<void> {
    expect(ns).toBe(QUICK_ACTIONS_SETTINGS_NAMESPACE)
    if (this.conflictsRemaining > 0) {
      this.conflictsRemaining -= 1
      this.revision += 1
      throw new ConflictError(expectedRevision ?? -1, this.revision)
    }
    this.writes.push({ ops, expectedRevision })
    const user: Record<string, unknown> = { ...this.user }
    for (const op of ops) user[op.path.join('.')] = structuredClone(op.value)
    // The whole config is validated before it is persisted, as the shipped editor does.
    Config(user)
    this.user = user
    this.revision += 1
  }

  /** One write's fields, as the section they set. */
  written(index: number): Record<string, unknown> | undefined {
    const write = this.writes[index]
    if (write === undefined) return undefined
    return Object.fromEntries(write.ops.map((op) => [op.path.join('.'), op.value]))
  }
}

function ready(user?: Record<string, unknown>): FakeSettings {
  const settings = new FakeSettings()
  settings.served = true
  if (user !== undefined) settings.user = user
  return settings
}

describe('the plugin Config', () => {
  it('is the single persisted namespace named in the spec, addressed by the entry id', () => {
    expect(QUICK_ACTIONS_SETTINGS_NAMESPACE).toBe('composer-quick-actions')
  })

  it('resolves an absent section to the documented defaults', () => {
    const resolved = Config({})
    expect(Object.fromEntries(Object.entries(resolved).map(([field, value]) => [field, plain(value)]))).toEqual({
      presets: [],
      schemaVersion: 1,
      layout: 'ribbon',
      userActionsById: {},
      actionOrder: [],
      presetStateById: {},
    })
  })

  it('declares every field volatile, the only fields a Settings form can reach', () => {
    for (const [field, schema] of Object.entries(Config.dict ?? {})) {
      expect(schema.meta.volatile, field).toBe(true)
    }
  })

  it('keeps the stored section top-level, key for key, so the one-shot legacy import can land', () => {
    // DSH moves an old `settings.yaml` section into the entry of the same id and
    // refuses the whole section when any top-level key is not a volatile field.
    expect(Object.keys(Config.dict ?? {})).toEqual(expect.arrayContaining([...QUICK_ACTION_STATE_FIELDS]))
    expect(() => Config(Object.fromEntries(QUICK_ACTION_STATE_FIELDS.map((field) => [field, undefined])))).not.toThrow()
  })

  it('accepts a section a higher version wrote, so loading never drops stored data', () => {
    const stored = {
      schemaVersion: 2,
      layout: 'grid',
      userActionsById: { 'a-1': { kind: 'insert', label: 'Ghost', text: 'g', enabled: true } },
      actionOrder: [{ source: 'custom', id: 'a-1' }],
      presetStateById: { p1: { hidden: true, pinned: 3 } },
    }
    const resolved = Config(stored)
    for (const [field, value] of Object.entries(stored)) expect(plain(resolved[field as keyof typeof resolved])).toEqual(value)
  })
})

describe('the canonical rewrite', () => {
  it('leaves a fresh install with nothing stored alone', async () => {
    const settings = ready()
    const outcome = await rewriteCanonicalSettings(settings, catalogOf('p1', 'p2'))
    expect(outcome).toEqual({ status: 'nothing-stored' })
    expect(settings.writes).toHaveLength(0)
    expect(settings.user).toBe(undefined)
  })

  it('treats a profile holding only the author presets as nothing stored', async () => {
    const settings = ready({ presets: [{ id: 'mine', label: 'Mine', text: 'mine' }] })
    expect(await rewriteCanonicalSettings(settings, catalogOf('p1'))).toEqual({ status: 'nothing-stored' })
    expect(settings.writes).toHaveLength(0)
  })

  it('writes the canonical section fenced to the revision it read', async () => {
    const settings = ready({ schemaVersion: 1, layout: 'bar', userActionsById: {}, actionOrder: [], presetStateById: {} })
    const outcome = await rewriteCanonicalSettings(settings, catalogOf('p1', 'p2'))
    expect(outcome).toEqual({ status: 'rewritten', revision: 3 })
    expect(settings.writes).toHaveLength(1)
    expect(settings.writes[0]?.expectedRevision).toBe(3)
    expect(settings.written(0)).toEqual({
      schemaVersion: 1,
      layout: 'bar',
      userActionsById: {},
      actionOrder: [
        { source: 'preset', id: 'p1' },
        { source: 'preset', id: 'p2' },
      ],
      presetStateById: {},
    })
  })

  it('writes the user-state fields only, leaving the author presets where the profile put them', async () => {
    const presets = [{ id: 'mine', label: 'Mine', text: 'mine' }]
    const settings = ready({ presets: structuredClone(presets), schemaVersion: 1, layout: 'bar' })
    await rewriteCanonicalSettings(settings, catalogOf('p1'))
    expect(settings.writes[0]?.ops.map((op) => op.path)).toEqual(QUICK_ACTION_STATE_FIELDS.map((field) => [field]))
    expect(settings.user?.presets).toEqual(presets)
  })

  it('writes nothing the second time round', async () => {
    const settings = ready({ schemaVersion: 1, layout: 'bar', userActionsById: {}, actionOrder: [], presetStateById: {} })
    const catalog = catalogOf('p1')
    await rewriteCanonicalSettings(settings, catalog)
    const outcome = await rewriteCanonicalSettings(settings, catalog)
    expect(outcome).toEqual({ status: 'unchanged' })
    expect(settings.writes).toHaveLength(1)
  })

  it('reports unchanged when the stored section differs only in key order', async () => {
    const settings = ready({
      presetStateById: {},
      actionOrder: [{ id: 'p1', source: 'preset' }],
      userActionsById: {},
      layout: 'ribbon',
      schemaVersion: 1,
    })
    expect(await rewriteCanonicalSettings(settings, catalogOf('p1'))).toEqual({ status: 'unchanged' })
    expect(settings.writes).toHaveLength(0)
  })

  it('does not downgrade a section a higher version owns', async () => {
    const stored = {
      schemaVersion: 2,
      layout: 'grid',
      userActionsById: { 'a-1': { kind: 'insert', label: 'Ghost', text: 'g' } },
      actionOrder: [{ source: 'custom', id: 'a-1' }],
      presetStateById: {},
    }
    const settings = ready(structuredClone(stored))
    expect(await rewriteCanonicalSettings(settings, catalogOf('p1'))).toEqual({
      status: 'newer-version',
      schemaVersion: 2,
    })
    expect(settings.writes).toHaveLength(0)
    expect(settings.user).toEqual(stored)
  })

  it('repairs a stored section that drifted from canonical form', async () => {
    const settings = ready({
      schemaVersion: 1,
      layout: 'bar',
      userActionsById: { 'a-1': { kind: 'send', label: 'Ship', text: 'ship', confirm: true, enabled: true } },
      actionOrder: [
        { source: 'custom', id: 'a-1' },
        { source: 'custom', id: 'a-1' },
        { source: 'custom', id: 'gone' },
      ],
      presetStateById: { p1: { hidden: false } },
    })
    const outcome = await rewriteCanonicalSettings(settings, catalogOf('p1'))
    expect(outcome.status).toBe('rewritten')
    expect(settings.written(0)).toMatchObject({
      layout: 'bar',
      actionOrder: [
        { source: 'custom', id: 'a-1' },
        { source: 'preset', id: 'p1' },
      ],
      presetStateById: {},
    })
  })

  it('carries a tombstone through the rewrite untouched', async () => {
    const ghost = { kind: 'insert', label: 'Ghost', text: 'g', enabled: true, cursorAtEnd: true }
    const settings = ready({
      schemaVersion: 1,
      layout: 'ribbon',
      userActionsById: { ghost: structuredClone(ghost) },
      actionOrder: [{ source: 'custom', id: 'ghost' }],
      presetStateById: {},
    })
    await rewriteCanonicalSettings(settings, catalogOf('p1'))
    expect(settings.user).toMatchObject({ userActionsById: { ghost } })
  })

  it('refreshes and retries when the entry moved under it', async () => {
    const settings = ready({ schemaVersion: 1, layout: 'bar', userActionsById: {}, actionOrder: [], presetStateById: {} })
    settings.conflictsRemaining = 1
    const outcome = await rewriteCanonicalSettings(settings, catalogOf('p1'))
    expect(outcome).toEqual({ status: 'rewritten', revision: 4 })
    expect(settings.writes[0]?.expectedRevision).toBe(4)
  })

  it('gives up rather than overwrite an entry that keeps moving', async () => {
    const settings = ready({ schemaVersion: 1, layout: 'bar', userActionsById: {}, actionOrder: [], presetStateById: {} })
    settings.conflictsRemaining = 99
    const outcome = await rewriteCanonicalSettings(settings, catalogOf('p1'))
    expect(outcome).toEqual({ status: 'conflict', attempts: 3 })
    expect(settings.writes).toHaveLength(0)
  })

  it('leaves a read-only provider alone', async () => {
    const settings = ready()
    settings.writable = false
    expect(await rewriteCanonicalSettings(settings, catalogOf('p1'))).toEqual({ status: 'read-only' })
    expect(settings.writes).toHaveLength(0)
  })

  it('reports an entry whose form is not served instead of writing blind', async () => {
    const settings = new FakeSettings()
    expect(await rewriteCanonicalSettings(settings, catalogOf('p1'))).toEqual({ status: 'unregistered' })
    expect(settings.writes).toHaveLength(0)
  })
})

describe('the state write', () => {
  it('sets each user-state field on its own path, in canonical order', () => {
    const section = {
      schemaVersion: 1,
      layout: 'bar',
      userActionsById: {},
      actionOrder: [],
      presetStateById: {},
    } as const
    expect(stateOps(section)).toEqual(QUICK_ACTION_STATE_FIELDS.map((field) => ({ op: 'set', path: [field], value: section[field] })))
  })
})
