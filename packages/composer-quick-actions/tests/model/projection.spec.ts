import { describe, expect, it } from 'vitest'
import {
  QUICK_ACTION_TOTAL_LIMIT,
  projectQuickActions,
  readQuickActionSettings,
  type PresetCatalog,
} from '../../src/model/index.js'
import { catalogOfIds as catalogOf } from './support.js'

function customActions(count: number): Record<string, unknown> {
  return Object.fromEntries(
    Array.from({ length: count }, (_unused, index) => [
      `a-${index}`,
      { kind: 'send', label: `Custom ${index}`, text: `text ${index}`, confirm: true, enabled: true },
    ]),
  )
}

function project(raw: unknown, catalog: PresetCatalog) {
  return projectQuickActions(readQuickActionSettings(raw, catalog), catalog)
}

describe('projected action content', () => {
  const catalog = catalogOf('p1')
  const projection = project(
    {
      userActionsById: {
        'a-1': {
          kind: 'send',
          label: 'Compact',
          text: '  /compact',
          icon: '\u{1F9F9}',
          confirm: false,
          enabled: true,
          clonedFromPresetId: 'p1',
        },
      },
    },
    catalog,
  )

  it('follows the shared order', () => {
    expect(projection.managed.map((action) => action.ref)).toEqual([
      { source: 'preset', id: 'p1' },
      { source: 'custom', id: 'a-1' },
    ])
  })

  it('marks a preset as author-owned and a custom action as editable', () => {
    expect(projection.managed.map((action) => action.editable)).toEqual([false, true])
  })

  it('flags a Command Send Action and carries its own confirmation policy', () => {
    expect(projection.managed[1]).toMatchObject({
      label: 'Compact',
      text: '  /compact',
      icon: '\u{1F9F9}',
      confirm: false,
      command: true,
      clonedFromPresetId: 'p1',
    })
  })

  it('leaves a plain send action unflagged', () => {
    expect(projection.managed[0]).toMatchObject({ command: false, confirm: true, icon: undefined })
  })
})

describe('visible and hidden projections', () => {
  const catalog = catalogOf('p1', 'p2')
  const projection = project(
    {
      userActionsById: {
        'a-1': { kind: 'send', label: 'On', text: 'on', confirm: true, enabled: true },
        'a-2': { kind: 'send', label: 'Off', text: 'off', confirm: true, enabled: false },
      },
      presetStateById: { p2: { hidden: true } },
    },
    catalog,
  )

  it('keeps hidden presets and disabled custom actions in the management list', () => {
    expect(projection.managed.map((action) => [action.ref.id, action.hidden])).toEqual([
      ['p1', false],
      ['p2', true],
      ['a-1', false],
      ['a-2', true],
    ])
  })

  it('renders only the visible actions in the Composer', () => {
    expect(projection.composer.map((action) => action.ref.id)).toEqual(['p1', 'a-1'])
  })

  it('counts hidden and disabled actions towards the total', () => {
    expect(projection.counts).toMatchObject({ total: 4, visible: 2, hidden: 2, overflow: false, canAdd: true })
  })
})

describe('action counting', () => {
  it.each([0, 1, 6, 25, QUICK_ACTION_TOTAL_LIMIT])('counts %i normal actions', (count) => {
    const projection = project({ userActionsById: customActions(count) }, catalogOf())
    expect(projection.managed).toHaveLength(count)
    expect(projection.counts).toMatchObject({ total: count, overflow: false })
  })

  it('closes the new and clone entry points exactly at the limit', () => {
    const below = project({ userActionsById: customActions(QUICK_ACTION_TOTAL_LIMIT - 1) }, catalogOf())
    const atLimit = project({ userActionsById: customActions(QUICK_ACTION_TOTAL_LIMIT) }, catalogOf())
    expect(below.counts.canAdd).toBe(true)
    expect(atLimit.counts.canAdd).toBe(false)
  })

  it('leaves an existing snapshot intact when a package upgrade pushes it past the limit', () => {
    const stored = { userActionsById: customActions(QUICK_ACTION_TOTAL_LIMIT) }
    const upgraded = project(stored, catalogOf('new-1', 'new-2', 'new-3'))
    expect(upgraded.managed).toHaveLength(QUICK_ACTION_TOTAL_LIMIT + 3)
    expect(upgraded.counts).toMatchObject({
      total: QUICK_ACTION_TOTAL_LIMIT + 3,
      overflow: true,
      canAdd: false,
    })
  })

  it('keeps hiding and disabling in effect while passively over the limit', () => {
    const stored = {
      userActionsById: {
        ...customActions(QUICK_ACTION_TOTAL_LIMIT),
        'a-0': { kind: 'send', label: 'Off', text: 'off', confirm: true, enabled: false },
      },
      presetStateById: { 'new-1': { hidden: true } },
    }
    const projection = project(stored, catalogOf('new-1', 'new-2', 'new-3'))
    expect(projection.counts.overflow).toBe(true)
    expect(projection.composer.map((action) => action.ref.id)).not.toContain('new-1')
    expect(projection.composer.map((action) => action.ref.id)).not.toContain('a-0')
  })
})

describe('preserved entries stay out of every projection', () => {
  const projection = project(
    {
      userActionsById: {
        'a-1': { kind: 'send', label: 'Live', text: 'live', confirm: true, enabled: true },
        'a-2': { kind: 'insert', label: 'Ghost', text: 'ghost', enabled: true },
      },
      actionOrder: [
        { source: 'preset', id: 'retired' },
        { source: 'custom', id: 'a-2' },
        { source: 'custom', id: 'a-1' },
      ],
      presetStateById: { retired: { hidden: false } },
    },
    catalogOf('p1'),
  )

  it('shows neither an unknown preset nor a tombstoned action', () => {
    expect(projection.managed.map((action) => action.ref.id)).toEqual(['a-1', 'p1'])
  })

  it('leaves them out of the total and reports them separately', () => {
    expect(projection.counts).toMatchObject({ total: 2, preserved: 2 })
  })
})

describe('projecting a snapshot the catalog has moved on from', () => {
  it('counts a known preset and a live action that the stored order never listed', () => {
    const projection = projectQuickActions(
      {
        schemaVersion: 1,
        layout: 'ribbon',
        userActionsById: {
          'a-1': { kind: 'send', label: 'Ship', text: 'ship', confirm: true, enabled: true },
        },
        actionOrder: [],
        presetStateById: {},
      },
      catalogOf('p1'),
    )
    expect(projection.managed.map((action) => action.ref.id)).toEqual(['p1', 'a-1'])
    expect(projection.counts).toMatchObject({ total: 2, visible: 2 })
  })
})
