import { describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { apply, inject } from '../../src/index.js'
import {
  startQuickActionsHost,
  type QuickActionsSettingsProvider,
} from '../../src/host/index.js'
import { QUICK_ACTIONS_SETTINGS_NAMESPACE, quickActionSettingsSchema } from '../../src/host/settings.js'

class FakeSettings implements QuickActionsSettingsProvider {
  writable = true
  revision = 1
  user: unknown = undefined
  readonly registrations: { ns: string; schema: unknown; options: unknown }[] = []
  readonly writes: object[] = []

  register(ns: string, schema: unknown, options?: unknown): unknown {
    this.registrations.push({ ns, schema, options })
    return { get: () => this.user, watch: () => () => {} }
  }

  describe(): readonly { ns: string; revision: number; user?: unknown }[] {
    if (this.registrations.length === 0) return []
    return [
      {
        ns: QUICK_ACTIONS_SETTINGS_NAMESPACE,
        revision: this.revision,
        ...(this.user === undefined ? {} : { user: this.user }),
      },
    ]
  }

  async replace(ns: string, section: object): Promise<void> {
    expect(ns).toBe(QUICK_ACTIONS_SETTINGS_NAMESPACE)
    this.writes.push(section)
    this.user = JSON.parse(JSON.stringify(section)) as unknown
    this.revision += 1
  }
}

const presets = [{ id: 'compact', label: 'Compact', text: '/compact', confirm: false }]
const drifted = {
  schemaVersion: 1,
  layout: 'bar',
  userActionsById: {},
  actionOrder: [{ source: 'custom', id: 'gone' }],
  presetStateById: {},
}

function fakeContext(settings: FakeSettings): {
  ctx: Context
  warn: ReturnType<typeof vi.fn>
  error: ReturnType<typeof vi.fn>
  dispose: () => void
} {
  const warn = vi.fn()
  const error = vi.fn()
  let disposer: (() => void) | undefined
  const ctx = {
    settings,
    logger: () => ({ warn, error }),
    effect: (execute: () => () => void) => {
      disposer = execute()
      return () => {}
    },
  } as unknown as Context
  return { ctx, warn, error, dispose: () => disposer?.() }
}

describe('the Host plugin surface', () => {
  it('declares settings as a hard dependency so it waits instead of inventing storage', () => {
    expect(inject).toContain('settings')
  })
})

describe('starting the Host', () => {
  it('fails loudly on an invalid preset configuration', () => {
    const settings = new FakeSettings()
    expect(() => startQuickActionsHost(settings, { presets: [{ id: 'x', kind: 'insert', label: 'X', text: 'x' }] }))
      .toThrow(/kind is unsupported/)
    expect(settings.registrations).toHaveLength(0)
  })

  it('registers the one namespace with the live schema', () => {
    const settings = new FakeSettings()
    startQuickActionsHost(settings, { presets })
    expect(settings.registrations).toEqual([
      {
        ns: QUICK_ACTIONS_SETTINGS_NAMESPACE,
        schema: quickActionSettingsSchema,
        options: { applies: 'live' },
      },
    ])
  })

  it('canonicalizes a stored section that drifted', async () => {
    const settings = new FakeSettings()
    settings.user = structuredClone(drifted)
    const host = startQuickActionsHost(settings, { presets })
    expect(await host.ready).toEqual({ status: 'rewritten', revision: 1 })
    expect(settings.writes[0]).toMatchObject({
      layout: 'bar',
      actionOrder: [{ source: 'preset', id: 'compact' }],
    })
  })

  it('serves the authoritative catalog snapshot as lossless JSON', async () => {
    const host = startQuickActionsHost(new FakeSettings(), { presets })
    const snapshot = await host.describeCatalog()
    expect(snapshot).toEqual({
      schemaVersion: 1,
      revision: expect.any(String),
      presets: [{ id: 'compact', kind: 'send', label: 'Compact', text: '/compact', confirm: false }],
    })
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot)
  })

  it('keeps the catalog revision stable across repeated reads', async () => {
    const host = startQuickActionsHost(new FakeSettings(), { presets })
    expect((await host.describeCatalog()).revision).toBe((await host.describeCatalog()).revision)
  })

  it('never hands out a mutable view of the catalog', async () => {
    const host = startQuickActionsHost(new FakeSettings(), { presets })
    const first = await host.describeCatalog()
    ;(first.presets as unknown as { label: string }[])[0]!.label = 'tampered'
    expect((await host.describeCatalog()).presets[0]?.label).toBe('Compact')
  })

  it('surfaces a rewrite that could not be fenced instead of throwing', async () => {
    const settings = new FakeSettings()
    settings.user = structuredClone(drifted)
    settings.replace = vi.fn(async () => {
      settings.revision += 1
      throw Object.assign(new Error('moved'), { code: 'SETTINGS_CONFLICT' })
    })
    const host = startQuickActionsHost(settings, { presets })
    expect(await host.ready).toEqual({ status: 'conflict', attempts: 3 })
  })
})

describe('the composition entry', () => {
  it('registers the namespace and returns the running Host', () => {
    const settings = new FakeSettings()
    const { ctx } = fakeContext(settings)
    const host = apply(ctx, { presets })
    expect(settings.registrations).toHaveLength(1)
    expect(typeof host.describeCatalog).toBe('function')
  })

  it('throws before registering anything when the configuration is invalid', () => {
    const settings = new FakeSettings()
    const { ctx } = fakeContext(settings)
    expect(() => apply(ctx, { presets: [{ id: 'dup', label: 'A', text: 'a' }, { id: 'dup', label: 'B', text: 'b' }] }))
      .toThrow(/duplicate/)
    expect(settings.registrations).toHaveLength(0)
  })

  it('reports a section owned by a higher version instead of rewriting it', async () => {
    const settings = new FakeSettings()
    settings.user = { schemaVersion: 3, layout: 'grid', userActionsById: {}, actionOrder: [], presetStateById: {} }
    const { ctx, warn } = fakeContext(settings)
    const host = apply(ctx, { presets })
    await host.ready
    await Promise.resolve()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('schemaVersion'), 3)
    expect(settings.writes).toHaveLength(0)
  })

  it('stays quiet about a rewrite that lands after the fiber unloaded', async () => {
    const settings = new FakeSettings()
    settings.user = structuredClone(drifted)
    settings.writable = false
    const { ctx, warn, dispose } = fakeContext(settings)
    const host = apply(ctx, { presets })
    dispose()
    await host.ready
    await Promise.resolve()
    expect(warn).not.toHaveBeenCalled()
  })
})
