import { describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import * as entry from '../../src/index.js'
import { apply } from '../../src/index.js'
import { startQuickActionsHost } from '../../src/host/index.js'
import { Config, type SettingsSetOp } from '../../src/host/settings.js'
import { QUICK_ACTIONS_SETTINGS_NAMESPACE } from '../../src/model/index.js'

/** A stand-in for DSH `SettingsForms`, as far as the Host entry reaches it. */
class FakeSettings {
  writable = true
  revision = 1
  user: Record<string, unknown> | undefined = undefined
  readonly writes: (readonly SettingsSetOp[])[] = []
  readonly policies: { presentation: { auto?: boolean }; owner: unknown }[] = []
  released = 0

  configure(presentation: { auto?: boolean }, owner: unknown): () => void {
    this.policies.push({ presentation, owner })
    return () => {
      this.released += 1
    }
  }

  describe(): readonly { ns: string; revision: number; user?: unknown }[] {
    return [{ ns: QUICK_ACTIONS_SETTINGS_NAMESPACE, revision: this.revision, user: structuredClone(this.user ?? {}) }]
  }

  async mutate(ns: string, ops: readonly SettingsSetOp[]): Promise<void> {
    expect(ns).toBe(QUICK_ACTIONS_SETTINGS_NAMESPACE)
    this.writes.push(ops)
    const user: Record<string, unknown> = { ...this.user }
    for (const op of ops) user[op.path.join('.')] = structuredClone(op.value)
    this.user = user
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

/** Resolve through the real Config, the way the Loader hands `apply` its config. */
function resolved(config: Record<string, unknown>): unknown {
  return Config(config)
}

/** A promise the case settles by hand, standing in for `loader.await()`. */
function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void
  const promise = new Promise<void>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

function fakeContext(
  settings: FakeSettings | undefined,
  loader: { await(): Promise<unknown> } | undefined = { await: () => Promise.resolve() },
): {
  ctx: Context
  fiber: object
  warn: ReturnType<typeof vi.fn>
  error: ReturnType<typeof vi.fn>
  dispose: () => void
} {
  const warn = vi.fn()
  const error = vi.fn()
  const disposers: (() => void)[] = []
  const effect = (execute: () => () => void): (() => void) => {
    disposers.push(execute())
    return () => {}
  }
  const fiber = { name: 'composer-quick-actions entry fiber' }
  const ctx = {
    fiber,
    logger: () => ({ warn, error }),
    effect,
    get: (name: string) => (name === 'loader' ? loader : undefined),
    // `settings` is optional: the callback runs only while the service exists.
    inject: (deps: readonly string[], callback: (scoped: Context) => void) => {
      expect(deps).toEqual(['settings'])
      if (settings !== undefined) callback({ settings, effect } as unknown as Context)
    },
  } as unknown as Context
  return {
    ctx,
    fiber,
    warn,
    error,
    dispose: () => {
      for (const dispose of disposers.reverse()) dispose()
    },
  }
}

/** Let the rewrite's promise chain run to its end. */
async function flush(): Promise<void> {
  for (let round = 0; round < 6; round += 1) await Promise.resolve()
}

describe('the Host plugin surface', () => {
  it('names itself after the entry id the bundle patch inserts', () => {
    expect(entry.name).toBe(QUICK_ACTIONS_SETTINGS_NAMESPACE)
  })

  it('exports its Config, which is what makes DSH serve it as a Settings form', () => {
    expect(entry.Config).toBe(Config)
  })

  it('does not hard-depend on settings, so the Quick Actions run without it', () => {
    expect('inject' in entry).toBe(false)
  })
})

describe('starting the Host', () => {
  it('fails loudly on an invalid preset configuration', () => {
    expect(() => startQuickActionsHost({ presets: [{ id: 'x', kind: 'insert', label: 'X', text: 'x' }] }))
      .toThrow(/kind is unsupported/)
  })

  it('reads presets the Loader hands over as volatile references', async () => {
    const host = startQuickActionsHost(resolved({ presets }))
    expect((await host.describeCatalog()).presets.at(-1)).toMatchObject({ id: 'compact' })
  })

  it('fails loudly on an invalid preset list behind a volatile reference too', () => {
    expect(() => startQuickActionsHost(resolved({ presets: [{ id: 'dup', label: 'A', text: 'a' }, { id: 'dup', label: 'B', text: 'b' }] })))
      .toThrow(/duplicate/)
  })

  it('canonicalizes a stored section that drifted', async () => {
    const settings = new FakeSettings()
    settings.user = structuredClone(drifted)
    const host = startQuickActionsHost({ presets })
    expect(await host.canonicalize(settings)).toEqual({ status: 'rewritten', revision: 1 })
    const written = Object.fromEntries((settings.writes[0] ?? []).map((op) => [op.path[0], op.value])) as {
      layout: string
      actionOrder: { source: string; id: string }[]
    }
    expect(written.layout).toBe('bar')
    expect(written.actionOrder.at(-1)).toEqual({ source: 'preset', id: 'compact' })
    expect(written.actionOrder.every((ref) => ref.source === 'preset')).toBe(true)
  })

  it('serves the authoritative catalog snapshot as lossless JSON', async () => {
    const host = startQuickActionsHost({ presets })
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
    const host = startQuickActionsHost({ presets })
    expect((await host.describeCatalog()).revision).toBe((await host.describeCatalog()).revision)
  })

  it('never hands out a mutable view of the catalog', async () => {
    const host = startQuickActionsHost({ presets })
    const first = await host.describeCatalog()
    const original = first.presets[0]?.label
    ;(first.presets as unknown as { label: string }[])[0]!.label = 'tampered'
    expect((await host.describeCatalog()).presets[0]?.label).toBe(original)
  })

  it('surfaces a rewrite that could not be fenced instead of throwing', async () => {
    const settings = new FakeSettings()
    settings.user = structuredClone(drifted)
    settings.mutate = vi.fn(async () => {
      settings.revision += 1
      throw Object.assign(new Error('moved'), { code: 'SETTINGS_CONFLICT' })
    })
    const host = startQuickActionsHost({ presets })
    expect(await host.canonicalize(settings)).toEqual({ status: 'conflict', attempts: 3 })
  })
})

describe('the composition entry', () => {
  it('returns the running Host', () => {
    const { ctx } = fakeContext(new FakeSettings())
    expect(typeof apply(ctx, resolved({ presets })).describeCatalog).toBe('function')
  })

  it('throws before installing anything when the configuration is invalid', () => {
    const settings = new FakeSettings()
    const { ctx } = fakeContext(settings)
    expect(() => apply(ctx, { presets: [{ id: 'dup', label: 'A', text: 'a' }, { id: 'dup', label: 'B', text: 'b' }] }))
      .toThrow(/duplicate/)
    expect(settings.policies).toHaveLength(0)
  })

  it("opts this entry's fiber out of an auto-generated Settings page, and withdraws that on unload", () => {
    const settings = new FakeSettings()
    const { ctx, fiber, dispose } = fakeContext(settings)
    apply(ctx, resolved({ presets }))
    // The policy names the entry's own fiber, not the inject child it was registered from.
    expect(settings.policies).toEqual([{ presentation: { auto: false }, owner: fiber }])
    dispose()
    expect(settings.released).toBe(1)
  })

  it('waits for every profile entry to settle before canonicalizing', async () => {
    const settings = new FakeSettings()
    settings.user = structuredClone(drifted)
    const settled = deferred()
    const { ctx } = fakeContext(settings, { await: () => settled.promise })
    apply(ctx, resolved({ presets }))

    await flush()
    // DSH serves this entry's form only once its fiber is active.
    expect(settings.writes).toHaveLength(0)

    settled.resolve()
    await flush()
    expect(settings.writes).toHaveLength(1)
  })

  it('runs, and writes nothing, without the settings service', async () => {
    const { ctx, warn, error } = fakeContext(undefined)
    expect(() => apply(ctx, resolved({ presets }))).not.toThrow()
    await flush()
    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  })

  it('reports a section owned by a higher version instead of rewriting it', async () => {
    const settings = new FakeSettings()
    settings.user = { schemaVersion: 3, layout: 'grid', userActionsById: {}, actionOrder: [], presetStateById: {} }
    const { ctx, warn } = fakeContext(settings)
    apply(ctx, resolved({ presets }))
    await flush()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('schemaVersion'), 3)
    expect(settings.writes).toHaveLength(0)
  })

  it('stays quiet about a rewrite that lands after the fiber unloaded', async () => {
    const settings = new FakeSettings()
    settings.user = structuredClone(drifted)
    settings.writable = false
    const { ctx, warn, dispose } = fakeContext(settings)
    apply(ctx, resolved({ presets }))
    dispose()
    await flush()
    expect(warn).not.toHaveBeenCalled()
    expect(settings.writes).toHaveLength(0)
  })
})
