import { describe, expect, it } from 'vitest'
import { buildPresetCatalog, type PresetCatalog } from '../../src/model/index.js'
import {
  QUICK_ACTIONS_SETTINGS_NAMESPACE,
  quickActionSettingsSchema,
  rewriteCanonicalSettings,
  type SettingsRewriteProvider,
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

/** A controlled stand-in for the Host settings provider, schema validation included. */
class FakeSettings implements SettingsRewriteProvider {
  writable = true
  registered = false
  revision = 3
  user: unknown = undefined
  readonly writes: { section: object; expectedRevision: number | undefined }[] = []
  /** Revisions to advance behind the caller's back, one per write attempt. */
  conflictsRemaining = 0

  describe(): readonly { ns: string; revision: number; user?: unknown }[] {
    if (!this.registered) return []
    return [{ ns: QUICK_ACTIONS_SETTINGS_NAMESPACE, revision: this.revision, ...(this.user === undefined ? {} : { user: this.user }) }]
  }

  async replace(ns: string, section: object, expectedRevision?: number): Promise<void> {
    expect(ns).toBe(QUICK_ACTIONS_SETTINGS_NAMESPACE)
    quickActionSettingsSchema(section)
    if (this.conflictsRemaining > 0) {
      this.conflictsRemaining -= 1
      this.revision += 1
      throw new ConflictError(expectedRevision ?? -1, this.revision)
    }
    this.writes.push({ section, expectedRevision })
    this.user = JSON.parse(JSON.stringify(section)) as unknown
    this.revision += 1
  }
}

function ready(user?: unknown): FakeSettings {
  const settings = new FakeSettings()
  settings.registered = true
  if (user !== undefined) settings.user = user
  return settings
}

describe('the settings namespace', () => {
  it('is the single persisted namespace named in the spec', () => {
    expect(QUICK_ACTIONS_SETTINGS_NAMESPACE).toBe('composer-quick-actions')
  })

  it('resolves an absent section to the documented defaults', () => {
    expect(quickActionSettingsSchema({})).toEqual({
      schemaVersion: 1,
      layout: 'ribbon',
      userActionsById: {},
      actionOrder: [],
      presetStateById: {},
    })
  })

  it('accepts a section a higher version wrote, so registration never drops stored data', () => {
    const stored = {
      schemaVersion: 2,
      layout: 'grid',
      userActionsById: { 'a-1': { kind: 'insert', label: 'Ghost', text: 'g', enabled: true } },
      actionOrder: [{ source: 'custom', id: 'a-1' }],
      presetStateById: { p1: { hidden: true, pinned: 3 } },
    }
    expect(() => quickActionSettingsSchema(stored)).not.toThrow()
    expect(quickActionSettingsSchema(stored)).toMatchObject(stored)
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

  it('writes the canonical section fenced to the revision it read', async () => {
    const settings = ready({ schemaVersion: 1, layout: 'bar', userActionsById: {}, actionOrder: [], presetStateById: {} })
    const outcome = await rewriteCanonicalSettings(settings, catalogOf('p1', 'p2'))
    expect(outcome).toEqual({ status: 'rewritten', revision: 3 })
    expect(settings.writes).toHaveLength(1)
    expect(settings.writes[0]?.expectedRevision).toBe(3)
    expect(settings.writes[0]?.section).toEqual({
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
    expect(settings.writes[0]?.section).toMatchObject({
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

  it('refreshes and retries when the namespace moved under it', async () => {
    const settings = ready({ schemaVersion: 1, layout: 'bar', userActionsById: {}, actionOrder: [], presetStateById: {} })
    settings.conflictsRemaining = 1
    const outcome = await rewriteCanonicalSettings(settings, catalogOf('p1'))
    expect(outcome).toEqual({ status: 'rewritten', revision: 4 })
    expect(settings.writes[0]?.expectedRevision).toBe(4)
  })

  it('gives up rather than overwrite a namespace that keeps moving', async () => {
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

  it('reports an unregistered namespace instead of writing blind', async () => {
    const settings = new FakeSettings()
    expect(await rewriteCanonicalSettings(settings, catalogOf('p1'))).toEqual({ status: 'unregistered' })
    expect(settings.writes).toHaveLength(0)
  })
})
