import { describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { apply, inject } from '../../src/index.js'
import {
  startQuickActionsHost,
  type QuickActionsSettingsProvider,
} from '../../src/host/index.js'
import {
  QUICK_ACTIONS_CATALOG_NAMESPACE,
  QUICK_ACTIONS_SETTINGS_NAMESPACE,
  quickActionCatalogSchema,
  quickActionSettingsSchema,
} from '../../src/host/settings.js'

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

  it('registers the user-state namespace with the live schema', () => {
    const settings = new FakeSettings()
    startQuickActionsHost(settings, { presets })
    expect(settings.registrations[0]).toEqual({
      ns: QUICK_ACTIONS_SETTINGS_NAMESPACE,
      schema: quickActionSettingsSchema,
      options: { applies: 'live' },
    })
  })

  it('canonicalizes a stored section that drifted', async () => {
    const settings = new FakeSettings()
    settings.user = structuredClone(drifted)
    const host = startQuickActionsHost(settings, { presets })
    expect(await host.ready).toEqual({ status: 'rewritten', revision: 1 })
    const written = settings.writes[0] as { layout: string; actionOrder: { source: string; id: string }[] }
    expect(written.layout).toBe('bar')
    expect(written.actionOrder.at(-1)).toEqual({ source: 'preset', id: 'compact' })
    expect(written.actionOrder.every((ref) => ref.source === 'preset')).toBe(true)
  })

  it('serves the authoritative catalog snapshot as lossless JSON', async () => {
    const host = startQuickActionsHost(new FakeSettings(), { presets })
    const snapshot = await host.describeCatalog()
    expect(snapshot.schemaVersion).toBe(1)
    expect(snapshot.revision).toEqual(expect.any(String))
    expect(snapshot.presets.at(-1)).toEqual({
      id: 'compact',
      kind: 'send',
      label: 'Compact',
      text: '/compact',
      confirm: false,
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
    const original = first.presets[0]?.label
    ;(first.presets as unknown as { label: string }[])[0]!.label = 'tampered'
    expect((await host.describeCatalog()).presets[0]?.label).toBe(original)
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
  it('registers both namespaces and returns the running Host', () => {
    const settings = new FakeSettings()
    const { ctx } = fakeContext(settings)
    const host = apply(ctx, { presets })
    expect(settings.registrations.map((entry) => entry.ns)).toEqual([
      QUICK_ACTIONS_SETTINGS_NAMESPACE,
      QUICK_ACTIONS_CATALOG_NAMESPACE,
    ])
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

function catalogRegistration(settings: FakeSettings): { ns: string; schema: unknown; options: unknown } {
  const registration = settings.registrations.find((entry) => entry.ns === QUICK_ACTIONS_CATALOG_NAMESPACE)
  if (registration === undefined) throw new Error('the catalog namespace was never registered')
  return registration
}

describe('the read-only catalog namespace', () => {
  it('publishes the catalog snapshot as the composition base layer', async () => {
    const settings = new FakeSettings()
    const host = startQuickActionsHost(settings, { presets })
    const registration = catalogRegistration(settings)
    expect(registration.schema).toBe(quickActionCatalogSchema)
    expect(registration.options).toEqual({ base: await host.describeCatalog(), applies: 'restart' })
  })

  it('takes effect on restart, matching how Host config changes land', () => {
    const settings = new FakeSettings()
    startQuickActionsHost(settings, { presets })
    expect((catalogRegistration(settings).options as { applies: string }).applies).toBe('restart')
  })

  it('hands the base layer a detached copy the Host cannot be reached through', async () => {
    const settings = new FakeSettings()
    const host = startQuickActionsHost(settings, { presets })
    const base = (catalogRegistration(settings).options as { base: { presets: { label: string }[] } }).base
    const original = (await host.describeCatalog()).presets[0]?.label
    base.presets[0]!.label = 'tampered'
    expect((await host.describeCatalog()).presets[0]?.label).toBe(original)
  })

  it('accepts the snapshot it publishes', async () => {
    const host = startQuickActionsHost(new FakeSettings(), { presets })
    const snapshot = await host.describeCatalog()
    expect(quickActionCatalogSchema(snapshot)).toEqual(snapshot)
  })

  it('is never written: the plugin only ever writes the user-state namespace', async () => {
    const settings = new FakeSettings()
    settings.user = structuredClone(drifted)
    const host = startQuickActionsHost(settings, { presets })
    await host.ready
    expect(settings.writes).toHaveLength(1)
  })
})
