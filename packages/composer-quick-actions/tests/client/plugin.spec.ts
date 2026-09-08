import { describe, expect, it } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { apply, inject, name } from '../../src/client/index.js'
import { FakeConnection, FakeSettingsDocument, fakeSettingsScope } from './support.js'
import { QUICK_ACTIONS_CATALOG_NAMESPACE, QUICK_ACTIONS_SETTINGS_NAMESPACE } from '../../src/model/index.js'
import { QUICK_ACTIONS_LOCALE_NAMESPACE } from '../../src/locales/index.js'
import type { ComposerBlocks, SlotInjectionEffect, SlotRegisterOptions } from '../../src/client/dsh.js'

interface Registration {
  readonly options: SlotRegisterOptions
  readonly component: unknown
}

/** A fake Client context wide enough for the Client fiber's whole assembly. */
class FakeClientContext {
  readonly document = new FakeSettingsDocument()
  readonly connection = new FakeConnection()
  /** Slot keys the plugin waited on, in order. */
  readonly injected: string[] = []
  /** Entries registered while those declarations were live. */
  readonly registered: Registration[] = []
  /** Locale namespaces whose dictionaries were registered. */
  readonly locales: string[] = []
  /** Whether `conversation` is provided; the Composer-block guard reads it. */
  conversation: { blocks: ComposerBlocks } | undefined
  private readonly disposers: (() => void)[] = []

  constructor() {
    this.document.register(QUICK_ACTIONS_CATALOG_NAMESPACE, {
      base: {
        schemaVersion: 1,
        revision: 'r',
        presets: [{ id: 'a', kind: 'send', label: 'A', text: 'a', confirm: true }],
      },
    })
    this.document.register(QUICK_ACTIONS_SETTINGS_NAMESPACE, {
      defaults: { schemaVersion: 1, layout: 'ribbon', userActionsById: {}, actionOrder: [], presetStateById: {} },
    })
  }

  get ctx(): Context {
    return {
      settingsScope: fakeSettingsScope(this.document),
      connection: this.connection,
      slots: {
        // The shipped `inject` accepts one disposer or an iterable of them; the
        // input dock declares two cells through one declaration lifetime.
        inject: (key: string, callback: () => SlotInjectionEffect) => {
          this.injected.push(key)
          const effect = callback()
          const stops = typeof effect === 'function' ? [effect] : Array.from(effect)
          for (const stop of stops) this.disposers.push(stop)
          return () => {
            for (const stop of stops) stop()
          }
        },
        register: (options: SlotRegisterOptions, component: unknown) => {
          this.registered.push({ options, component })
          return () => {
            this.registered.splice(
              this.registered.findIndex((entry) => entry.options === options),
              1,
            )
          }
        },
      },
      locale: {
        register: (ns: string) => {
          this.locales.push(ns)
          return () => {
            this.locales.splice(this.locales.indexOf(ns), 1)
          }
        },
        bind: () => (key: string) => key,
      },
      get: (service: string) => (service === 'conversation' ? this.conversation : undefined),
      effect: (execute: () => () => void) => {
        this.disposers.push(execute())
        return () => {}
      },
    } as unknown as Context
  }

  unload(): void {
    for (const dispose of this.disposers.reverse()) dispose()
    this.disposers.length = 0
  }
}

describe('the Client plugin surface', () => {
  it('names itself for fiber diagnostics', () => {
    expect(name).toBe('composer-quick-actions')
  })

  it('declares exactly the services spec 7.3 lists', () => {
    expect(inject).toEqual(['slots', 'settingsScope', 'connection', 'locale'])
  })

  it('binds the catalog namespace and the user-state namespace, and nothing else', () => {
    const host = new FakeClientContext()
    apply(host.ctx)
    expect(host.document.bound).toEqual([QUICK_ACTIONS_CATALOG_NAMESPACE, QUICK_ACTIONS_SETTINGS_NAMESPACE])
  })

  it('costs no settings read of its own', () => {
    const host = new FakeClientContext()
    apply(host.ctx)
    expect(host.document.describeReads).toBe(0)
  })

  it('registers its dictionaries under one namespace', () => {
    const host = new FakeClientContext()
    apply(host.ctx)
    expect(host.locales).toEqual([QUICK_ACTIONS_LOCALE_NAMESPACE])
  })

  it('always registers both dock Slots, whatever the current layout is', () => {
    const host = new FakeClientContext()
    apply(host.ctx)

    expect(host.injected).toEqual(['conversation.input.dock', 'conversation.composer.dock'])
    expect(host.registered.map((entry) => entry.options)).toEqual([
      {
        name: 'conversation.input.dock',
        id: 'composer-quick-actions',
        order: 100,
        locale: QUICK_ACTIONS_LOCALE_NAMESPACE,
      },
      // The centralized management overlay, registered independently of the
      // layout entry rather than nested inside it (spec 8.1).
      {
        name: 'conversation.input.dock',
        id: 'composer-quick-actions-manager',
        order: 101,
        locale: QUICK_ACTIONS_LOCALE_NAMESPACE,
      },
      {
        name: 'conversation.composer.dock',
        id: 'composer-quick-actions',
        order: 100,
        locale: QUICK_ACTIONS_LOCALE_NAMESPACE,
      },
    ])
  })

  it('registers ids of its own rather than reusing a shipped entry', () => {
    const host = new FakeClientContext()
    apply(host.ctx)
    for (const entry of host.registered) expect(entry.options.id).toMatch(/^composer-quick-actions/)
    // The two cells on one Slot must not collide: a Slot id is a cell key.
    const inputDock = host.registered.filter((entry) => entry.options.name === 'conversation.input.dock')
    expect(new Set(inputDock.map((entry) => entry.options.id)).size).toBe(inputDock.length)
  })

  it('releases every registration and subscription when the fiber unloads', () => {
    const host = new FakeClientContext()
    apply(host.ctx)
    expect(host.document.listenerCount).toBeGreaterThan(0)
    expect(host.registered).toHaveLength(3)
    expect(host.locales).toHaveLength(1)

    host.unload()

    expect(host.document.listenerCount).toBe(0)
    expect(host.connection.listenerCount).toBe(0)
    expect(host.registered).toHaveLength(0)
    expect(host.locales).toHaveLength(0)
  })

  it('starts without the conversation service being provided', () => {
    // `conversation` is read through `ctx.get`, not injected, so a context that
    // does not carry it must still assemble.
    const host = new FakeClientContext()
    expect(() => {
      apply(host.ctx)
    }).not.toThrow()
  })
})
