import { describe, expect, it } from 'vitest'
import {
  normalizeQuickActionSettings,
  planCreateCustomQuickAction,
  planReorderQuickActions,
  planSetQuickActionLayout,
  projectQuickActions,
  readQuickActionSettings,
} from '../../src/model/index.js'
import { accepted, catalogOf, orderOf } from './support.js'

describe('Preset Catalog lifecycle across package upgrades', () => {
  const shipped = { id: 'p1', label: 'Compact', text: '/compact' }
  const stored = {
    actionOrder: [
      { source: 'preset', id: 'p2' },
      { source: 'preset', id: 'p1' },
    ],
    presetStateById: { p1: { hidden: true } },
  }

  it('shows the author copy update against the same Preset Action ID', () => {
    const upgraded = { ...shipped, label: 'Compact now', text: '/compact --hard', icon: '\u{1F9F9}' }
    const projection = projectQuickActions(
      readQuickActionSettings(stored, catalogOf({ id: 'p2', label: 'Explain', text: 'why' }, upgraded)),
      catalogOf({ id: 'p2', label: 'Explain', text: 'why' }, upgraded),
    )
    expect(projection.managed.map((action) => action.ref.id)).toEqual(['p2', 'p1'])
    expect(projection.managed[1]).toMatchObject({ label: 'Compact now', text: '/compact --hard', hidden: true })
  })

  it('keeps the user preference of a preset the upgrade removed', () => {
    const catalog = catalogOf({ id: 'p2', label: 'Explain', text: 'why' })
    const settings = readQuickActionSettings(stored, catalog)
    expect(projectQuickActions(settings, catalog).managed.map((action) => action.ref.id)).toEqual(['p2'])
    expect(orderOf(settings)).toEqual(['preset:p2', 'preset:p1'])
    expect(settings.presetStateById).toEqual({ p1: { hidden: true } })
  })

  it('restores the original position and hidden state when the same id comes back', () => {
    const withoutP1 = readQuickActionSettings(stored, catalogOf({ id: 'p2', label: 'Explain', text: 'why' }))
    const readded = normalizeQuickActionSettings(
      withoutP1,
      catalogOf({ id: 'p2', label: 'Explain', text: 'why' }, shipped),
    )
    expect(orderOf(readded)).toEqual(['preset:p2', 'preset:p1'])
    expect(readded.presetStateById).toEqual({ p1: { hidden: true } })
  })

  it('treats a behaviour signature change under a new id as a new action', () => {
    const catalog = catalogOf(
      { id: 'p2', label: 'Explain', text: 'why' },
      { id: 'p1-confirmed', label: 'Compact', text: '/compact', confirm: false },
    )
    const settings = normalizeQuickActionSettings(readQuickActionSettings(stored, catalog), catalog)
    expect(orderOf(settings)).toEqual(['preset:p2', 'preset:p1', 'preset:p1-confirmed'])

    const projection = projectQuickActions(settings, catalog)
    expect(projection.managed.map((action) => [action.ref.id, action.hidden])).toEqual([
      ['p2', false],
      ['p1-confirmed', false],
    ])
    expect(settings.presetStateById).toEqual({ p1: { hidden: true } })
  })
})

describe('downgrade round trip', () => {
  const ghost = { kind: 'insert', label: 'Insert snippet', text: 'snippet', enabled: true, cursorAtEnd: true }
  const catalog = catalogOf({ id: 'p1', label: 'Compact', text: '/compact' })

  it('returns a higher version its own action untouched after a full editing session', () => {
    const fromNewerVersion = {
      schemaVersion: 2,
      layout: 'bar',
      userActionsById: { ghost: structuredClone(ghost) },
      actionOrder: [
        { source: 'custom', id: 'ghost' },
        { source: 'preset', id: 'p1' },
      ],
      presetStateById: {},
    }

    const settings = readQuickActionSettings(fromNewerVersion, catalog)
    const created = accepted(
      planCreateCustomQuickAction(
        { settings, catalog, revision: 'rev-1' },
        { id: 'a-1', draft: { label: 'Ship', text: 'ship it', icon: '', confirm: true } },
      ),
    )
    const reordered = accepted(
      planReorderQuickActions({ settings: created, catalog, revision: 'rev-2' }, {
        order: [
          { source: 'custom', id: 'a-1' },
          { source: 'preset', id: 'p1' },
        ],
      }),
    )
    const final = accepted(planSetQuickActionLayout({ settings: reordered, catalog, revision: 'rev-3' }, { layout: 'launcher' }))

    expect(final.userActionsById.ghost).toEqual(ghost)
    expect(orderOf(final)).toEqual(['custom:ghost', 'custom:a-1', 'preset:p1'])
    expect(projectQuickActions(final, catalog).counts).toMatchObject({ total: 2, preserved: 1 })
  })
})
