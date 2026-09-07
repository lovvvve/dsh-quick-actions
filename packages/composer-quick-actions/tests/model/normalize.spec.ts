import { describe, expect, it } from 'vitest'
import {
  decodeQuickActionSettings,
  normalizeQuickActionSettings,
  readQuickActionSettings,
  type PresetCatalog,
  type QuickActionSettingsV1,
} from '../../src/model/index.js'
import { catalogOfIds as catalogOf } from './support.js'

function normalized(raw: unknown, catalog: PresetCatalog): QuickActionSettingsV1 {
  return normalizeQuickActionSettings(decodeQuickActionSettings(raw), catalog)
}

const sendAction = { kind: 'send', label: 'Ship', text: 'ship it', confirm: true, enabled: true } as const

describe('normalization of the shared order', () => {
  it('appends known presets in catalog order ahead of custom actions', () => {
    const settings = normalized({ userActionsById: { 'a-1': sendAction, 'a-2': sendAction } }, catalogOf('p1', 'p2'))
    expect(settings.actionOrder).toEqual([
      { source: 'preset', id: 'p1' },
      { source: 'preset', id: 'p2' },
      { source: 'custom', id: 'a-1' },
      { source: 'custom', id: 'a-2' },
    ])
  })

  it('keeps only the first of a repeated reference', () => {
    const settings = normalized(
      {
        actionOrder: [
          { source: 'preset', id: 'p2' },
          { source: 'preset', id: 'p1' },
          { source: 'preset', id: 'p2' },
        ],
      },
      catalogOf('p1', 'p2'),
    )
    expect(settings.actionOrder).toEqual([
      { source: 'preset', id: 'p2' },
      { source: 'preset', id: 'p1' },
    ])
  })

  it('drops a reference to a custom action that no longer exists', () => {
    const settings = normalized({ actionOrder: [{ source: 'custom', id: 'gone' }] }, catalogOf('p1'))
    expect(settings.actionOrder).toEqual([{ source: 'preset', id: 'p1' }])
  })

  it('keeps a reference to a preset the current catalog does not know', () => {
    const settings = normalized(
      {
        actionOrder: [
          { source: 'preset', id: 'retired' },
          { source: 'preset', id: 'p1' },
        ],
        presetStateById: { retired: { hidden: true } },
      },
      catalogOf('p1'),
    )
    expect(settings.actionOrder).toEqual([
      { source: 'preset', id: 'retired' },
      { source: 'preset', id: 'p1' },
    ])
    expect(settings.presetStateById).toEqual({ retired: { hidden: true } })
  })

  it('appends a preset added by a package upgrade to the end of the order', () => {
    const before = normalized({}, catalogOf('p1'))
    const after = normalizeQuickActionSettings(before, catalogOf('p1', 'p2'))
    expect(after.actionOrder).toEqual([
      { source: 'preset', id: 'p1' },
      { source: 'preset', id: 'p2' },
    ])
  })
})

describe('normalization of tombstones', () => {
  const tombstone = { kind: 'insert', label: 'Insert', text: 'snippet', enabled: true }

  it('keeps a tombstoned action and its existing reference untouched', () => {
    const settings = normalized(
      {
        userActionsById: { 'a-1': structuredClone(tombstone), 'a-2': sendAction },
        actionOrder: [
          { source: 'custom', id: 'a-1' },
          { source: 'custom', id: 'a-2' },
        ],
      },
      catalogOf(),
    )
    expect(settings.userActionsById['a-1']).toEqual(tombstone)
    expect(settings.actionOrder).toEqual([
      { source: 'custom', id: 'a-1' },
      { source: 'custom', id: 'a-2' },
    ])
  })

  it('does not mint an order reference for a tombstone that has none', () => {
    const settings = normalized({ userActionsById: { 'a-1': structuredClone(tombstone) } }, catalogOf())
    expect(settings.userActionsById['a-1']).toEqual(tombstone)
    expect(settings.actionOrder).toEqual([])
  })
})

describe('normalization of preset state', () => {
  it('canonicalizes a known preset that is not hidden away', () => {
    const settings = normalized({ presetStateById: { p1: { hidden: false }, p2: { hidden: true } } }, catalogOf('p1', 'p2'))
    expect(settings.presetStateById).toEqual({ p2: { hidden: true } })
  })
})

describe('normalization never rewrites confirm', () => {
  const command = { kind: 'send', label: 'Compact', text: '/compact', confirm: false, enabled: true }

  it('leaves a Command Send Action the user unconfirmed alone across repeated normalization', () => {
    const first = normalized({ userActionsById: { 'a-1': command } }, catalogOf())
    const second = normalizeQuickActionSettings(first, catalogOf())
    const third = normalizeQuickActionSettings(second, catalogOf('p1'))
    for (const settings of [first, second, third]) {
      expect(settings.userActionsById['a-1']).toMatchObject({ text: '/compact', confirm: false })
    }
  })
})

describe('normalization is idempotent', () => {
  it('produces an unchanged result the second time round', () => {
    const catalog = catalogOf('p1', 'p2')
    const once = normalized(
      {
        layout: 'launcher',
        userActionsById: { 'a-1': sendAction, 'a-2': { kind: 'insert', label: 'x', text: 'y' } },
        actionOrder: [
          { source: 'custom', id: 'a-2' },
          { source: 'preset', id: 'p2' },
          { source: 'preset', id: 'p2' },
          { source: 'custom', id: 'gone' },
        ],
        presetStateById: { p1: { hidden: true }, retired: { hidden: true } },
      },
      catalog,
    )
    expect(normalizeQuickActionSettings(once, catalog)).toEqual(once)
  })
})

describe('readQuickActionSettings', () => {
  it('decodes and normalizes in one step', () => {
    const catalog = catalogOf('p1')
    expect(readQuickActionSettings({ layout: 'bar' }, catalog)).toEqual(
      normalized({ layout: 'bar' }, catalog),
    )
  })
})

describe('normalization states every required field', () => {
  it('writes the send discriminant, confirm and enabled onto a snapshot that skipped decoding', () => {
    const settings = normalizeQuickActionSettings(
      {
        schemaVersion: 1,
        layout: 'ribbon',
        userActionsById: { 'a-1': { kind: 'send', label: 'Ship', text: 'ship' } as never },
        actionOrder: [],
        presetStateById: {},
      },
      catalogOf(),
    )
    expect(settings.userActionsById['a-1']).toEqual({
      kind: 'send',
      label: 'Ship',
      text: 'ship',
      confirm: true,
      enabled: true,
    })
  })
})

describe('normalization of preset state written by a higher version', () => {
  it('carries a field this release does not know through the round trip', () => {
    const stored = { presetStateById: { p1: { hidden: true, pinned: 3 }, retired: { pinned: 7 } } }
    const settings = normalized(stored, catalogOf('p1'))
    expect(settings.presetStateById).toEqual({ p1: { pinned: 3, hidden: true }, retired: { pinned: 7 } })
    expect(normalizeQuickActionSettings(settings, catalogOf('p1'))).toEqual(settings)
  })
})
