import { describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { apply, inject } from '../../src/client/index.js'
import { FakeConnection, FakeSettingsDocument, fakeSettingsScope } from './support.js'
import { QUICK_ACTIONS_CATALOG_NAMESPACE, QUICK_ACTIONS_SETTINGS_NAMESPACE } from '../../src/model/index.js'

function fakeContext(document: FakeSettingsDocument, connection: FakeConnection): {
  ctx: Context
  unload: () => void
} {
  let disposer: (() => void) | undefined
  const ctx = {
    settingsScope: fakeSettingsScope(document),
    connection,
    effect: (execute: () => () => void) => {
      disposer = execute()
      return () => {}
    },
  } as unknown as Context
  return { ctx, unload: () => disposer?.() }
}

function registered(): FakeSettingsDocument {
  const document = new FakeSettingsDocument()
  document.register(QUICK_ACTIONS_CATALOG_NAMESPACE, {
    base: { schemaVersion: 1, revision: 'r', presets: [{ id: 'a', kind: 'send', label: 'A', text: 'a', confirm: true }] },
  })
  document.register(QUICK_ACTIONS_SETTINGS_NAMESPACE, {
    defaults: { schemaVersion: 1, layout: 'ribbon', userActionsById: {}, actionOrder: [], presetStateById: {} },
  })
  return document
}

describe('the Client plugin surface', () => {
  it('declares the two services it reaches Host state through', () => {
    expect(inject).toEqual(['settingsScope', 'connection'])
  })

  it('binds the catalog namespace and the user-state namespace, and nothing else', () => {
    const document = registered()
    const { ctx } = fakeContext(document, new FakeConnection())
    apply(ctx)
    expect(document.bound).toEqual([QUICK_ACTIONS_CATALOG_NAMESPACE, QUICK_ACTIONS_SETTINGS_NAMESPACE])
  })

  it('costs no settings read of its own', () => {
    const document = registered()
    const { ctx } = fakeContext(document, new FakeConnection())
    apply(ctx)
    expect(document.describeReads).toBe(0)
  })

  it('releases every subscription when the fiber unloads', () => {
    const document = registered()
    const connection = new FakeConnection()
    const { ctx, unload } = fakeContext(document, connection)
    apply(ctx)
    expect(document.listenerCount).toBeGreaterThan(0)

    unload()

    expect(document.listenerCount).toBe(0)
    expect(connection.listenerCount).toBe(0)
  })
})
