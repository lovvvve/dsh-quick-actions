import { describe, expect, it } from 'vitest'
import {
  DEFAULT_QUICK_ACTION_SETTINGS,
  decodeQuickActionSettings,
  isQuickActionTombstone,
} from '../../src/model/index.js'

const snapshot = {
  schemaVersion: 1,
  layout: 'bar',
  userActionsById: {
    'a-1': {
      kind: 'send',
      label: 'Ship it',
      text: '/ship',
      icon: '\u{1F680}',
      confirm: false,
      enabled: true,
      clonedFromPresetId: 'preset-ship',
    },
  },
  actionOrder: [
    { source: 'preset', id: 'preset-ship' },
    { source: 'custom', id: 'a-1' },
  ],
  presetStateById: { 'preset-ship': { hidden: true } },
} as const

describe('Settings V1 decoding', () => {
  it.each([[undefined], [null], ['nonsense'], [42], [[]]])('falls back to the defaults for %j', (raw) => {
    expect(decodeQuickActionSettings(raw)).toEqual(DEFAULT_QUICK_ACTION_SETTINGS)
  })

  it('defaults the layout to the ribbon', () => {
    expect(DEFAULT_QUICK_ACTION_SETTINGS.layout).toBe('ribbon')
  })

  it('reads a published V1 snapshot without changing it', () => {
    expect(decodeQuickActionSettings(structuredClone(snapshot))).toEqual(snapshot)
  })

  it('replaces a layout it does not know with the default', () => {
    expect(decodeQuickActionSettings({ ...snapshot, layout: 'carousel' }).layout).toBe('ribbon')
  })

  it('still reads the fields it knows out of a higher schema version', () => {
    const decoded = decodeQuickActionSettings({ ...snapshot, schemaVersion: 2 })
    expect(decoded.schemaVersion).toBe(1)
    expect(decoded.layout).toBe('bar')
  })

  it('defaults a stored action that predates the confirm and enabled fields', () => {
    const decoded = decodeQuickActionSettings({
      userActionsById: { 'a-1': { label: 'Ship it', text: 'ship' } },
    })
    expect(decoded.userActionsById['a-1']).toEqual({
      kind: 'send',
      label: 'Ship it',
      text: 'ship',
      confirm: true,
      enabled: true,
    })
  })

  it('keeps a confirmation the user switched off', () => {
    const decoded = decodeQuickActionSettings({
      userActionsById: { 'a-1': { kind: 'send', label: 'Ship it', text: '/ship', confirm: false, enabled: true } },
    })
    expect(decoded.userActionsById['a-1']).toMatchObject({ confirm: false })
  })

  it('preserves an action whose kind this release cannot run as a tombstone', () => {
    const stored = { kind: 'insert', label: 'Insert it', text: 'snippet', enabled: true, cursorAtEnd: true }
    const decoded = decodeQuickActionSettings({ userActionsById: { 'a-1': structuredClone(stored) } })
    expect(decoded.userActionsById['a-1']).toEqual(stored)
    expect(isQuickActionTombstone(decoded.userActionsById['a-1']!)).toBe(true)
  })

  it('preserves an unreadable action as a tombstone instead of repairing it', () => {
    const stored = { kind: 'send', label: 42, text: 'ship' }
    const decoded = decodeQuickActionSettings({ userActionsById: { 'a-1': structuredClone(stored) } })
    expect(decoded.userActionsById['a-1']).toEqual(stored)
    expect(isQuickActionTombstone(decoded.userActionsById['a-1']!)).toBe(true)
  })

  it('drops order entries that are not usable references', () => {
    const decoded = decodeQuickActionSettings({
      actionOrder: [
        { source: 'preset', id: 'p-1' },
        { source: 'agent', id: 'p-2' },
        { source: 'custom' },
        'p-3',
        { source: 'custom', id: 'a-1' },
      ],
    })
    expect(decoded.actionOrder).toEqual([
      { source: 'preset', id: 'p-1' },
      { source: 'custom', id: 'a-1' },
    ])
  })

  it('drops preset state that is not a readable record', () => {
    const decoded = decodeQuickActionSettings({
      presetStateById: { 'p-1': { hidden: true }, 'p-2': { hidden: 'yes' }, 'p-3': 'hidden' },
    })
    expect(decoded.presetStateById).toEqual({ 'p-1': { hidden: true }, 'p-2': {} })
  })
})

describe('lossless preservation of unreadable stored data', () => {
  it('preserves a stored action whose kind is not even a string', () => {
    const stored = { kind: 42, label: 'Odd', text: 'odd' }
    const decoded = decodeQuickActionSettings({ userActionsById: { 'a-1': structuredClone(stored) } })
    expect(decoded.userActionsById['a-1']).toEqual(stored)
    expect(isQuickActionTombstone(decoded.userActionsById['a-1']!)).toBe(true)
  })
})
