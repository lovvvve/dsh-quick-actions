import { describe, expect, it } from 'vitest'
import { createQuickActionsController } from '../../src/client/controller.js'
import type { QuickActionsController } from '../../src/client/controller.js'
import {
  QUICK_ACTIONS_CATALOG_NAMESPACE,
  QUICK_ACTIONS_SETTINGS_NAMESPACE,
  buildPresetCatalog,
  type PresetCatalog,
} from '../../src/model/index.js'
import { FakeConnection, FakeSettingsDocument, fakeSettingsScope } from './support.js'

const SETTINGS_DEFAULTS = {
  schemaVersion: 1,
  layout: 'ribbon',
  userActionsById: {},
  actionOrder: [],
  presetStateById: {},
}

function catalogOf(...presets: readonly Record<string, unknown>[]): PresetCatalog {
  const result = buildPresetCatalog({ builtins: presets, configured: [] })
  if (!result.ok) throw new Error(`catalog rejected: ${JSON.stringify(result.issues)}`)
  return result.catalog
}

const catalog = catalogOf(
  { id: 'summarize', label: 'Summarize', text: 'summarize this' },
  { id: 'compact', label: 'Compact', text: '/compact', confirm: false },
)

interface Harness {
  readonly document: FakeSettingsDocument
  readonly connection: FakeConnection
  readonly controller: QuickActionsController
  readonly ids: string[]
}

/** How the catalog namespace is registered for one case. */
type CatalogFixture = 'published' | 'unregistered' | 'no-base' | { readonly base: unknown }

function harness(
  options: {
    readonly catalog?: CatalogFixture
    readonly stored?: Record<string, unknown>
    readonly registerSettings?: boolean
    readonly answered?: boolean
  } = {},
): Harness {
  const document = new FakeSettingsDocument()
  document.answered = options.answered ?? true
  const fixture = options.catalog ?? 'published'
  if (fixture !== 'unregistered') {
    const base =
      fixture === 'published'
        ? (JSON.parse(JSON.stringify(catalog)) as unknown)
        : fixture === 'no-base'
          ? undefined
          : fixture.base
    document.register(QUICK_ACTIONS_CATALOG_NAMESPACE, {
      defaults: { schemaVersion: 1, revision: '', presets: [] },
      ...(base === undefined ? {} : { base }),
    })
  }
  if (options.registerSettings !== false) {
    document.register(QUICK_ACTIONS_SETTINGS_NAMESPACE, {
      defaults: SETTINGS_DEFAULTS,
      ...(options.stored === undefined ? {} : { user: options.stored }),
    })
  }
  const connection = new FakeConnection()
  const ids: string[] = []
  let minted = 0
  const controller = createQuickActionsController({
    settingsScope: fakeSettingsScope(document),
    connection,
    mintCustomActionId: () => {
      minted += 1
      const id = `minted-${String(minted)}`
      ids.push(id)
      return id
    },
  })
  return { document, connection, controller, ids }
}

describe('Client catalog binding', () => {
  it('reads the authoritative catalog off the composition base layer', () => {
    const { controller } = harness()
    const state = controller.getSnapshot()
    expect(state.catalog).toEqual({ status: 'ready', catalog })
    expect(state.projection?.composer.map((action) => action.label)).toEqual(['Summarize', 'Compact'])
  })

  it('ignores a user section written against the catalog namespace', () => {
    const { document, controller } = harness()
    document.concurrentWrite(QUICK_ACTIONS_CATALOG_NAMESPACE, {
      schemaVersion: 1,
      revision: 'forged',
      presets: [{ id: 'forged', kind: 'send', label: 'Forged', text: 'forged', confirm: true }],
    })
    expect(controller.getSnapshot().catalog).toEqual({ status: 'ready', catalog })
  })

  it('costs no read of its own: the catalog rides the shared document the mirror already holds', () => {
    const { document } = harness()
    expect(document.describeReads).toBe(0)
  })

  it('renders no action while the shared document is unanswered', () => {
    const { controller } = harness({ answered: false })
    const state = controller.getSnapshot()
    expect(state.catalog).toEqual({ status: 'loading' })
    expect(state.projection).toBeUndefined()
    expect(state.readOnly).toBe(true)
  })

  it('reports an unavailable catalog when the namespace is not registered', () => {
    const { controller } = harness({ catalog: 'unregistered' })
    expect(controller.getSnapshot().catalog).toEqual({ status: 'error', reason: 'unavailable' })
  })

  it('reports an unavailable catalog when the Host published no base layer', () => {
    const { controller } = harness({ catalog: 'no-base' })
    expect(controller.getSnapshot().catalog).toEqual({ status: 'error', reason: 'unavailable' })
  })

  it('reports an undecodable catalog rather than a truncated one', () => {
    const { controller } = harness({ catalog: { base: { schemaVersion: 1, revision: 'r', presets: [{ id: 'a' }] } } })
    expect(controller.getSnapshot().catalog).toEqual({ status: 'error', reason: 'undecodable' })
  })

  it('reports a retryable catalog error when the settings document cannot be read', async () => {
    const { document, controller } = harness({ answered: false })
    expect(controller.getSnapshot().catalog).toEqual({ status: 'loading' })

    document.failReads = true
    await controller.refresh()

    const state = controller.getSnapshot()
    expect(state.catalog).toEqual({ status: 'error', reason: 'unreadable' })
    expect(state.projection).toBeUndefined()
  })

  it('refreshes the shared document when the user retries a catalog error', async () => {
    const { document, controller } = harness({ answered: false })
    await controller.refresh()
    expect(document.describeReads).toBe(1)
    expect(controller.getSnapshot().catalog.status).toBe('ready')
  })
})

describe('Client settings binding', () => {
  it('projects the last Host-confirmed snapshot against the catalog', () => {
    const { controller } = harness({
      stored: { ...SETTINGS_DEFAULTS, layout: 'bar', presetStateById: { summarize: { hidden: true } } },
    })
    const state = controller.getSnapshot()
    expect(state.settings.status).toBe('ready')
    expect(state.projection?.layout).toBe('bar')
    expect(state.projection?.composer.map((action) => action.label)).toEqual(['Compact'])
    expect(state.projection?.managed).toHaveLength(2)
    expect(state.readOnly).toBe(false)
  })

  it('shows the authoritative catalog read-only when the settings namespace is absent', () => {
    const { controller } = harness({ registerSettings: false })
    const state = controller.getSnapshot()
    expect(state.settings).toEqual({ status: 'unavailable' })
    expect(state.projection?.composer.map((action) => action.label)).toEqual(['Summarize', 'Compact'])
    expect(state.readOnly).toBe(true)
  })

  it('goes read-only when the provider accepts no writes', () => {
    const { document, controller } = harness()
    document.writable = false
    document.answer()
    expect(controller.getSnapshot().readOnly).toBe(true)
  })

  it('goes read-only on a page the client keeps process-local', () => {
    const { document, controller } = harness()
    document.mode = 'memory'
    document.answer()
    const state = controller.getSnapshot()
    expect(state.settings).toEqual({ status: 'unavailable' })
    expect(state.readOnly).toBe(true)
  })
})

describe('Client connection state', () => {
  it('keeps serving the last confirmed snapshot read-only while the connection is down', () => {
    const { connection, controller } = harness({ stored: { ...SETTINGS_DEFAULTS, layout: 'launcher' } })
    connection.set('connecting')
    const state = controller.getSnapshot()
    expect(state.stale).toBe(true)
    expect(state.readOnly).toBe(true)
    expect(state.projection?.layout).toBe('launcher')
    expect(state.projection?.composer).toHaveLength(2)
  })

  it('clears staleness on a new generation but keeps the failure the user has not answered', async () => {
    const { document, connection, controller } = harness()
    document.refuseWrites = 'rejected'
    await controller.setLayout('bar')
    expect(controller.getSnapshot().failure).toEqual({ kind: 'refused' })

    connection.set('disconnected')
    connection.set('connected')
    const state = controller.getSnapshot()
    expect(state.stale).toBe(false)
    // A reconnect refreshes the document; it does not answer for the user, so a
    // refusal or conflict still waiting on them survives it (spec 10).
    expect(state.failure).toEqual({ kind: 'refused' })
  })
})

describe('Client writes', () => {
  it('commits the new state only after the Host persisted it', async () => {
    const { document, controller } = harness()
    expect(controller.getSnapshot().projection?.layout).toBe('ribbon')

    const outcome = await controller.setLayout('bar')

    expect(outcome).toEqual({ ok: true, changed: true })
    expect(document.stored(QUICK_ACTIONS_SETTINGS_NAMESPACE)).toMatchObject({ layout: 'bar' })
    expect(controller.getSnapshot().projection?.layout).toBe('bar')
  })

  it('writes nothing when the plan would persist what is already stored', async () => {
    const { document, controller } = harness()
    const outcome = await controller.setLayout('ribbon')
    expect(outcome).toEqual({ ok: true, changed: false })
    expect(document.writes).toBe(0)
  })

  it('refuses a plan the shared model rejects without touching the wire', async () => {
    const { document, controller } = harness()
    const outcome = await controller.createCustomAction({ label: '  ', text: 'hi', icon: '', confirm: true })
    expect(outcome).toEqual({
      ok: false,
      failure: { kind: 'rejected', rejection: { reason: 'invalid-fields', issues: [{ field: 'label', reason: 'blank' }] } },
    })
    expect(document.writes).toBe(0)
  })

  it('reports a Host refusal and leaves the authoritative snapshot in place', async () => {
    const { document, controller } = harness()
    document.refuseWrites = 'rejected'
    const outcome = await controller.setLayout('bar')
    expect(outcome).toEqual({ ok: false, failure: { kind: 'refused' } })
    expect(controller.getSnapshot().projection?.layout).toBe('ribbon')
    expect(controller.getSnapshot().failure).toEqual({ kind: 'refused' })
  })

  it('reports a revision conflict against the refreshed authoritative state', async () => {
    const { document, controller } = harness()
    document.onWrite = () => {
      document.onWrite = undefined
      document.concurrentWrite(QUICK_ACTIONS_SETTINGS_NAMESPACE, { ...SETTINGS_DEFAULTS, layout: 'launcher' })
    }

    const outcome = await controller.setLayout('bar')

    expect(outcome).toEqual({ ok: false, failure: { kind: 'conflict' } })
    expect(controller.getSnapshot().projection?.layout).toBe('launcher')
  })

  it('reports a transport failure without retrying it, after one recovery read', async () => {
    const { document, controller } = harness()
    document.refuseWrites = 'throw'
    const outcome = await controller.setLayout('bar')
    expect(outcome).toEqual({ ok: false, failure: { kind: 'failed', message: 'fake settings transport failed' } })
    expect(document.writes).toBe(1)
    // The scope recovers only when the Host answered a refusal, so a throw has to
    // bring the authoritative state back itself.
    expect(document.describeReads).toBe(1)
  })

  it('refuses every write while the surfaces are read-only', async () => {
    const { document, controller } = harness()
    document.writable = false
    document.answer()
    expect(await controller.setLayout('bar')).toEqual({ ok: false, failure: { kind: 'read-only' } })
    expect(document.writes).toBe(0)
  })

  it('serializes writes so the second plan reads the first one back', async () => {
    const { controller } = harness()
    const [first, second] = await Promise.all([
      controller.createCustomAction({ label: 'One', text: 'one', icon: '', confirm: true }),
      controller.createCustomAction({ label: 'Two', text: 'two', icon: '', confirm: false }),
    ])
    expect(first).toEqual({ ok: true, changed: true })
    expect(second).toEqual({ ok: true, changed: true })
    expect(controller.getSnapshot().projection?.managed.map((action) => action.label)).toEqual([
      'Summarize',
      'Compact',
      'One',
      'Two',
    ])
  })

  it('refuses to create past the action ceiling without touching the wire', async () => {
    const userActionsById: Record<string, unknown> = {}
    const actionOrder: unknown[] = []
    for (let index = 0; index < 48; index += 1) {
      const id = `filler-${String(index)}`
      userActionsById[id] = { kind: 'send', label: `Filler ${String(index)}`, text: 'x', confirm: true, enabled: true }
      actionOrder.push({ source: 'custom', id })
    }
    const { document, controller } = harness({ stored: { ...SETTINGS_DEFAULTS, userActionsById, actionOrder } })
    expect(controller.getSnapshot().projection?.counts).toMatchObject({ total: 50, canAdd: false })

    const outcome = await controller.createCustomAction({ label: 'One more', text: 'one', icon: '', confirm: true })

    expect(outcome).toEqual({ ok: false, failure: { kind: 'rejected', rejection: { reason: 'limit-reached', issues: [] } } })
    expect(document.writes).toBe(0)
  })

  it('refuses every write while no catalog is readable', async () => {
    const { document, controller } = harness({ catalog: 'unregistered' })
    expect(await controller.setLayout('bar')).toEqual({ ok: false, failure: { kind: 'not-ready' } })
    expect(document.writes).toBe(0)
  })

  it('keeps editing open while a passive overflow is above the ceiling', async () => {
    const userActionsById: Record<string, unknown> = {}
    const actionOrder: unknown[] = []
    for (let index = 0; index < 51; index += 1) {
      const id = `filler-${String(index)}`
      userActionsById[id] = { kind: 'send', label: `Filler ${String(index)}`, text: 'x', confirm: true, enabled: true }
      actionOrder.push({ source: 'custom', id })
    }
    const { controller } = harness({ stored: { ...SETTINGS_DEFAULTS, userActionsById, actionOrder } })
    expect(controller.getSnapshot().projection?.counts).toMatchObject({ total: 53, overflow: true, canAdd: false })

    // Nothing is dropped, hidden or refused; only new and clone are closed (spec 5.4).
    expect(await controller.setCustomActionEnabled('filler-0', false)).toEqual({ ok: true, changed: true })
    expect(await controller.deleteCustomAction('filler-1')).toEqual({ ok: true, changed: true })
    expect(await controller.setPresetHidden('summarize', true)).toEqual({ ok: true, changed: true })
    expect(controller.getSnapshot().projection?.counts).toMatchObject({ total: 52, overflow: true })
  })

  it('mints another Custom Action ID when the first one is taken', async () => {
    const { controller, ids } = harness({
      stored: {
        ...SETTINGS_DEFAULTS,
        userActionsById: {
          'minted-1': { kind: 'send', label: 'Taken', text: 'taken', confirm: true, enabled: true },
        },
        actionOrder: [{ source: 'custom', id: 'minted-1' }],
      },
    })
    const outcome = await controller.createCustomAction({ label: 'Fresh', text: 'fresh', icon: '', confirm: true })
    expect(outcome).toEqual({ ok: true, changed: true })
    expect(ids).toEqual(['minted-1', 'minted-2'])
    expect(controller.getSnapshot().projection?.managed.map((action) => action.label)).toContain('Fresh')
  })
})

describe('Client mutation surface', () => {
  it('clones a preset into an editable custom action', async () => {
    const { controller } = harness()
    expect(await controller.clonePreset('compact')).toEqual({ ok: true, changed: true })
    const cloned = controller.getSnapshot().projection?.managed.at(-1)
    expect(cloned).toMatchObject({ label: 'Compact', text: '/compact', confirm: false, editable: true, command: true })
  })

  it('edits, disables and deletes a custom action', async () => {
    const { controller, ids } = harness()
    await controller.createCustomAction({ label: 'One', text: 'one', icon: '', confirm: true })
    const id = ids[0] ?? ''

    await controller.updateCustomAction(id, { label: 'Renamed', text: 'one', icon: '\u{1F642}', confirm: false })
    expect(controller.getSnapshot().projection?.managed.at(-1)).toMatchObject({
      label: 'Renamed',
      icon: '\u{1F642}',
      confirm: false,
    })

    await controller.setCustomActionEnabled(id, false)
    expect(controller.getSnapshot().projection?.counts).toMatchObject({ total: 3, visible: 2, hidden: 1 })

    await controller.deleteCustomAction(id)
    expect(controller.getSnapshot().projection?.counts.total).toBe(2)
  })

  it('hides and restores a preset without touching the author definition', async () => {
    const { document, controller } = harness()
    await controller.setPresetHidden('summarize', true)
    expect(controller.getSnapshot().projection?.composer.map((action) => action.label)).toEqual(['Compact'])
    expect(document.stored(QUICK_ACTIONS_SETTINGS_NAMESPACE)).toMatchObject({
      presetStateById: { summarize: { hidden: true } },
    })

    await controller.setPresetHidden('summarize', false)
    expect(controller.getSnapshot().projection?.composer).toHaveLength(2)
  })

  it('reorders and moves actions in the shared order', async () => {
    const { controller } = harness()
    await controller.moveAction({ source: 'preset', id: 'compact' }, 0)
    expect(controller.getSnapshot().projection?.managed.map((action) => action.ref.id)).toEqual([
      'compact',
      'summarize',
    ])

    await controller.reorderActions([
      { source: 'preset', id: 'summarize' },
      { source: 'preset', id: 'compact' },
    ])
    expect(controller.getSnapshot().projection?.managed.map((action) => action.ref.id)).toEqual([
      'summarize',
      'compact',
    ])
  })
})

describe('Client manager state', () => {
  it('opens, closes and dismisses the last failure', async () => {
    const { document, controller } = harness()
    expect(controller.getSnapshot().manager).toEqual({ open: false })

    controller.openManager()
    expect(controller.getSnapshot().manager).toEqual({ open: true })

    document.refuseWrites = 'rejected'
    await controller.setLayout('bar')
    expect(controller.getSnapshot().manager).toEqual({ open: true })
    expect(controller.getSnapshot().failure).toEqual({ kind: 'refused' })

    controller.dismissFailure()
    expect(controller.getSnapshot().failure).toBeUndefined()

    controller.closeManager()
    expect(controller.getSnapshot().manager).toEqual({ open: false })
  })

  it('marks a write in flight so the panel can disable its controls', async () => {
    const { controller } = harness()
    const pending = controller.setLayout('bar')
    expect(controller.getSnapshot().writing).toBe(true)
    await pending
    expect(controller.getSnapshot().writing).toBe(false)
  })
})

describe('Client controller lifecycle', () => {
  it('publishes one stable snapshot until something actually changes', () => {
    const { document, controller } = harness()
    const first = controller.getSnapshot()
    document.answer()
    expect(controller.getSnapshot()).toBe(first)
  })

  it('notifies subscribers when the authoritative document moves', () => {
    const { document, controller } = harness()
    let notifications = 0
    const stop = controller.subscribe(() => {
      notifications += 1
    })
    document.concurrentWrite(QUICK_ACTIONS_SETTINGS_NAMESPACE, { ...SETTINGS_DEFAULTS, layout: 'bar' })
    stop()
    expect(notifications).toBe(1)
    expect(controller.getSnapshot().projection?.layout).toBe('bar')
  })

  it('picks up the catalog the Host republished after a restart', () => {
    const { document, controller } = harness()
    const upgraded = JSON.parse(
      JSON.stringify(
        catalogOf(
          { id: 'summarize', label: 'Summarize', text: 'summarize this' },
          { id: 'compact', label: 'Compact', text: '/compact', confirm: false },
          { id: 'explain', label: 'Explain', text: 'explain that' },
        ),
      ),
    ) as unknown
    const namespace = document.namespaces.get(QUICK_ACTIONS_CATALOG_NAMESPACE)
    if (namespace === undefined) throw new Error('the catalog namespace should be registered')
    namespace.base = upgraded
    document.answer()

    expect(controller.getSnapshot().projection?.composer.map((action) => action.label)).toEqual([
      'Summarize',
      'Compact',
      'Explain',
    ])
  })

  it('leaves no listener or subscription behind once disposed', () => {
    const { document, connection, controller } = harness()
    expect(document.listenerCount).toBeGreaterThan(0)
    expect(connection.listenerCount).toBe(1)

    controller.dispose()

    expect(document.listenerCount).toBe(0)
    expect(connection.listenerCount).toBe(0)
  })

  it('accepts no write once disposed', async () => {
    const { document, controller } = harness()
    controller.dispose()
    expect(await controller.setLayout('bar')).toEqual({ ok: false, failure: { kind: 'not-ready' } })
    expect(document.writes).toBe(0)
  })
})
