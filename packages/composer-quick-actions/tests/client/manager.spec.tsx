// @vitest-environment jsdom
/**
 * The management surfaces of spec 8.1, 8.3, 8.4 and 10: the shared searchable
 * action panel behind `bar`'s "more" and `launcher`'s entry, the centralized
 * management overlay and its independent registration, the Custom Quick Action
 * form, the action ceiling and passive overflow, and the read-only, refusal and
 * revision-conflict states.
 *
 * Every case drives the real controller over the fake settings transport, so a
 * UI state only appears here if the fake Host actually persisted it.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useSyncExternalStore } from 'react'
import type { ReactElement } from 'react'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { RenderResult } from '@testing-library/react'
import { createQuickActionDockEntries } from '../../src/client/surfaces/entries.js'
import { createResidentComposerRegistry } from '../../src/client/surfaces/residency.js'
import { createQuickActionSessionRegistry } from '../../src/client/session/execution.js'
import { createQuickActionsController } from '../../src/client/controller.js'
import type { QuickActionsController } from '../../src/client/controller.js'
import type { InputState, SessionSnapshot, SnapshotSelectorHook, Translate } from '../../src/client/dsh.js'
import { QUICK_ACTIONS_CATALOG_NAMESPACE, QUICK_ACTIONS_SETTINGS_NAMESPACE } from '../../src/model/index.js'
import type { QuickActionLayout } from '../../src/model/index.js'
import { FakeConnection, FakeSettingsDocument, fakeSettingsScope } from './support.js'
import { FakeComposerInput, fakeSession } from './composer.js'
import { zh } from '../../src/locales/index.js'

/** The `t` a Slot entry receives, over this package's own shipped dictionary. */
const t: Translate = (key, params) => {
  const template = (zh as Record<string, string>)[key] ?? key
  if (params === undefined) return template
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => String(params[name] ?? whole))
}

function hookOver<T>(source: { getSnapshot(): T; subscribe(listener: () => void): () => void }): SnapshotSelectorHook<T> {
  return ((selector: (value: T) => unknown) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks -- this IS the hook the renderer binds
    useSyncExternalStore(
      (listener) => source.subscribe(listener),
      () => selector(source.getSnapshot()),
    )) as SnapshotSelectorHook<T>
}

function settingsSection(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    layout: 'ribbon',
    userActionsById: {},
    actionOrder: [],
    presetStateById: {},
    ...overrides,
  }
}

interface HarnessOptions {
  readonly layout?: QuickActionLayout
  readonly presets?: readonly Record<string, unknown>[]
  /** The stored user section, or `false` for a namespace the Host does not serve. */
  readonly user?: Record<string, unknown> | false
  /** A catalog namespace the Host does not publish a `base` layer for. */
  readonly noCatalog?: boolean
}

const PRESETS: readonly Record<string, unknown>[] = [
  { id: 'p1', label: '继续', text: '继续', confirm: false },
  { id: 'p2', label: '压缩', text: '/compact', confirm: true },
  { id: 'p3', label: '解释改动', text: '解释你刚才的改动', confirm: false },
]

/** The whole Client, wired the way `apply` wires it, but rendered by the test. */
class ManagerHarness {
  readonly document = new FakeSettingsDocument()
  readonly connection = new FakeConnection()
  readonly input = new FakeComposerInput()
  readonly residency = createResidentComposerRegistry()
  readonly sessions = createQuickActionSessionRegistry()
  readonly controller: QuickActionsController
  readonly entries: ReturnType<typeof createQuickActionDockEntries>
  private readonly sessionListeners = new Set<() => void>()

  constructor(options: HarnessOptions = {}) {
    const presets = options.presets ?? PRESETS
    this.document.register(
      QUICK_ACTIONS_CATALOG_NAMESPACE,
      options.noCatalog === true ? {} : { base: { schemaVersion: 1, revision: 'r', presets } },
    )
    if (options.user !== false) {
      this.document.register(QUICK_ACTIONS_SETTINGS_NAMESPACE, {
        defaults: settingsSection(),
        user: settingsSection({ layout: options.layout ?? 'ribbon', ...options.user }),
      })
    }
    this.controller = createQuickActionsController({
      settingsScope: fakeSettingsScope(this.document),
      connection: this.connection,
      // Deterministic Custom Action IDs, so a created action can be addressed.
      mintCustomActionId: () => `custom-${this.minted++}`,
    })
    this.entries = createQuickActionDockEntries({
      controller: this.controller,
      sessions: this.sessions,
      residency: this.residency,
      blocks: () => undefined,
    })
  }

  private minted = 1

  slotProps(sessionId: string): {
    sessionId: string
    useSession: SnapshotSelectorHook<SessionSnapshot>
    useInput: SnapshotSelectorHook<InputState>
    inputActions: FakeComposerInput['actions']
    t: Translate
  } {
    const session = fakeSession({ sessionId })
    return {
      sessionId,
      useSession: hookOver({
        getSnapshot: () => session,
        subscribe: (listener: () => void) => {
          this.sessionListeners.add(listener)
          return () => {
            this.sessionListeners.delete(listener)
          }
        },
      }),
      useInput: hookOver({
        getSnapshot: () => this.input.snapshot,
        subscribe: (listener: () => void) => this.input.subscribe(listener),
      }),
      inputActions: this.input.actions,
      t,
    }
  }

  /** The stored user section, as the fake Host holds it. */
  get stored(): Record<string, unknown> | undefined {
    return this.document.stored(QUICK_ACTIONS_SETTINGS_NAMESPACE)
  }

  dispose(): void {
    this.sessions.dispose()
    this.controller.dispose()
  }
}

let harness: ManagerHarness
/** Whether `harness` is a live one this file still has to tear down. */
let live = false

/**
 * Build a fresh Client. Calling it a second time inside one test replaces the
 * first, so a case that needs different seed data can re-seed without leaving
 * the previous render mounted beside it.
 */
function setup(options: HarnessOptions = {}): void {
  if (live) {
    cleanup()
    harness.dispose()
  }
  harness = new ManagerHarness(options)
  live = true
}

/** One Session's three Slot cells, the way DSH renders them for a Resident Composer. */
function Session({ sessionId }: { readonly sessionId: string }): ReactElement {
  const { InputDock, ComposerDock, ManagerDock } = harness.entries
  const props = harness.slotProps(sessionId)
  const owner = { session: fakeSession({ sessionId }), input: harness.input.snapshot }
  return (
    <>
      <InputDock {...props} {...owner} />
      <ManagerDock {...props} {...owner} />
      <ComposerDock {...props} />
    </>
  )
}

/** Returns the render result, so a case can ask what is and is not inside the dock's own DOM. */
function mount(sessionId = 'session-1'): RenderResult {
  return render(<Session sessionId={sessionId} />)
}

/** Let the controller's serialized write queue settle, with React in `act`. */
async function settle(): Promise<void> {
  for (let round = 0; round < 8; round += 1) {
    // eslint-disable-next-line no-await-in-loop -- draining the microtask queue is inherently serial
    await act(async () => {
      await Promise.resolve()
    })
  }
}

function openManager(): void {
  fireEvent.click(screen.getByRole('button', { name: zh['manage'] }))
}

function panel(): HTMLElement {
  return screen.getByRole('dialog', { name: zh['manager.title'] })
}

/**
 * The overlay's own backdrop, addressed by the class only it carries: the
 * `data-quick-actions-backdrop` marker is shared with the two anchored popovers,
 * so a bare query would not say whose scrim it found.
 */
function managerBackdrop(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.dsh-cqa-manager-backdrop')
}

function rowOf(key: string): HTMLElement {
  const row = panel().querySelector<HTMLElement>(`[data-quick-action="${key}"]`)
  if (row === null) throw new Error(`no managed row for ${key}`)
  return row
}

function control(key: string, name: string): HTMLElement {
  const found = Array.from(rowOf(key).querySelectorAll<HTMLElement>('button')).find(
    (button) => button.textContent === name,
  )
  if (found === undefined) throw new Error(`no "${name}" control on ${key}`)
  return found
}

/**
 * Whether a control refuses a press while staying focusable.
 *
 * The panel reserves a real `disabled` for sustained, external unavailability
 * and reports everything else — a write in flight, an end of the list, the
 * layout already chosen, the ceiling already reached — with `aria-disabled`, so
 * a keyboard user never loses the caret to their own press.
 */
function blocked(element: HTMLElement): boolean {
  return element.getAttribute('aria-disabled') === 'true' && (element as HTMLButtonElement).disabled === false
}

/**
 * Press a control the way a keyboard user reaches it: focused first, then
 * activated. jsdom's `click` moves no focus on its own, and every focus
 * assertion in this file depends on where the caret was when the press landed.
 */
function press(button: HTMLElement): void {
  act(() => {
    button.focus()
  })
  fireEvent.click(button)
}

/** The stored custom actions, failing the test rather than the assertion when absent. */
function storedActions(): Record<string, Record<string, unknown>> {
  const actions = harness.stored?.userActionsById
  if (actions === undefined) throw new Error('the fake Host has stored no user section')
  return actions as Record<string, Record<string, unknown>>
}

function managedKeys(): readonly string[] {
  return Array.from(panel().querySelectorAll('.dsh-cqa-list-item')).map(
    (item) => item.getAttribute('data-quick-action') ?? '',
  )
}

afterEach(() => {
  cleanup()
  harness.dispose()
  live = false
})

// ---------------------------------------------------------------------------
// The shared searchable action panel (spec 8.1)
// ---------------------------------------------------------------------------

describe('the shared searchable action panel', () => {
  it('opens from the launcher entry with a search field that really filters', () => {
    setup({ layout: 'launcher' })
    mount()

    fireEvent.click(screen.getByRole('button', { name: '快捷动作 3' }))
    const search = screen.getByLabelText(zh['panel.search'])
    expect(screen.getByRole('button', { name: /继续/ })).toBeTruthy()

    fireEvent.change(search, { target: { value: '压缩' } })

    expect(screen.queryByRole('button', { name: /继续/ })).toBeNull()
    expect(screen.getByRole('button', { name: /压缩/ })).toBeTruthy()
  })

  it('keeps the matches in their shared order rather than ranking them', () => {
    setup({ layout: 'launcher' })
    mount()
    fireEvent.click(screen.getByRole('button', { name: '快捷动作 3' }))

    // Matches p1 ("继续") and p3 ("解释你刚才的改动" holds 改动) — never p2.
    fireEvent.change(screen.getByLabelText(zh['panel.search']), { target: { value: '继' } })
    const keys = Array.from(
      screen.getByRole('dialog', { name: zh['panel.title'] }).querySelectorAll('[data-quick-action]'),
    ).map((item) => item.getAttribute('data-quick-action'))

    expect(keys).toEqual(['preset:p1'])
  })

  it('tells "nothing matched" apart from "nothing to run"', () => {
    setup({ layout: 'launcher' })
    mount()
    fireEvent.click(screen.getByRole('button', { name: '快捷动作 3' }))

    fireEvent.change(screen.getByLabelText(zh['panel.search']), { target: { value: 'zzz' } })
    expect(screen.getByText(zh['panel.search.empty'])).toBeTruthy()

    fireEvent.change(screen.getByLabelText(zh['panel.search']), { target: { value: '' } })
    expect(screen.queryByText(zh['panel.search.empty'])).toBeNull()
  })

  it('closes on Escape and returns focus to the entry that opened it', () => {
    setup({ layout: 'launcher' })
    mount()
    const entry = screen.getByRole('button', { name: '快捷动作 3' })
    fireEvent.click(entry)

    fireEvent.keyDown(screen.getByRole('dialog', { name: zh['panel.title'] }), { key: 'Escape' })

    expect(screen.queryByRole('dialog', { name: zh['panel.title'] })).toBeNull()
    expect(document.activeElement).toBe(entry)
  })

  it('closes on a backdrop click', () => {
    setup({ layout: 'launcher' })
    mount()
    fireEvent.click(screen.getByRole('button', { name: '快捷动作 3' }))

    fireEvent.click(document.querySelector('[data-quick-actions-backdrop]') as Element)

    expect(screen.queryByRole('dialog', { name: zh['panel.title'] })).toBeNull()
  })

  it('offers a close control a pointer user can actually see', () => {
    // Escape, the backdrop and the entry itself all close the panel, and none of
    // them is visible (spec 8.4 wants visible text labels on controls).
    setup({ layout: 'launcher' })
    mount()
    const entry = screen.getByRole('button', { name: '快捷动作 3' })
    fireEvent.click(entry)

    fireEvent.click(screen.getByRole('button', { name: zh['panel.close'] }))

    expect(screen.queryByRole('dialog', { name: zh['panel.title'] })).toBeNull()
    expect(document.activeElement).toBe(entry)
  })

  it('executes the picked action through the per-Session engine, with no second lock', () => {
    setup({ layout: 'launcher' })
    mount()
    fireEvent.click(screen.getByRole('button', { name: '快捷动作 3' }))

    fireEvent.click(screen.getByRole('button', { name: /继续/ }))

    expect(harness.input.sends).toEqual(['继续'])
    expect(screen.queryByRole('dialog', { name: zh['panel.title'] })).toBeNull()
  })

  it('shows a picked action disabled with its reason, exactly as a layout does', () => {
    setup({ layout: 'launcher' })
    mount()
    act(() => {
      harness.input.type('half a thought')
    })
    fireEvent.click(screen.getByRole('button', { name: '快捷动作 3' }))

    const item = screen.getByRole('button', { name: /继续/ })
    expect(item).toHaveProperty('disabled', true)
    expect(item.getAttribute('title')).toBe(zh['unavailable.occupied-draft'])
  })

  it('is the very same panel behind the bar layout’s "more"', () => {
    // The bar only overflows once it has been measured, which needs a layout —
    // so the measurement environment is stubbed rather than the component.
    setup({ layout: 'bar' })
    const restore = stubMeasurement({ row: 300, action: 120 })
    try {
      mount()
      fireEvent.click(screen.getByRole('button', { name: /^更多/ }))

      // Same dialog, same search field: one panel serves both entries (spec 8.1).
      expect(screen.getByRole('dialog', { name: zh['panel.title'] })).toBeTruthy()
      expect(screen.getByLabelText(zh['panel.search'])).toBeTruthy()
    } finally {
      restore()
    }
  })
})

/** Give jsdom the measurements the `bar` overflow split needs, then take them back. */
function stubMeasurement(sizes: { readonly row: number; readonly action: number }): () => void {
  const observer = globalThis.ResizeObserver
  const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
  const offset = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth')

  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => sizes.row })
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => sizes.action })

  return () => {
    if (observer === undefined) delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver
    else globalThis.ResizeObserver = observer
    if (width !== undefined) Object.defineProperty(HTMLElement.prototype, 'clientWidth', width)
    if (offset !== undefined) Object.defineProperty(HTMLElement.prototype, 'offsetWidth', offset)
  }
}

// ---------------------------------------------------------------------------
// The overlay itself (spec 8.1, 8.4)
// ---------------------------------------------------------------------------

describe('the management overlay', () => {
  beforeEach(() => {
    setup()
  })

  it('opens from the compact management entry as a modal dialog', () => {
    mount()

    openManager()

    const dialog = panel()
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('data-quick-actions-manager')).toBe('')
  })

  it('closes on Escape, on the backdrop, and on its own close button', () => {
    mount()

    openManager()
    fireEvent.keyDown(panel(), { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: zh['manager.title'] })).toBeNull()

    openManager()
    fireEvent.click(document.querySelector('[data-quick-actions-backdrop]') as Element)
    expect(screen.queryByRole('dialog', { name: zh['manager.title'] })).toBeNull()

    openManager()
    fireEvent.click(screen.getByRole('button', { name: zh['manager.close'] }))
    expect(screen.queryByRole('dialog', { name: zh['manager.title'] })).toBeNull()
  })

  it('returns focus to the management entry when it closes', () => {
    mount()
    const entry = screen.getByRole('button', { name: zh['manage'] })

    press(entry)
    expect(document.activeElement).not.toBe(entry)

    fireEvent.keyDown(panel(), { key: 'Escape' })

    expect(document.activeElement).toBe(entry)
  })

  it('keeps Tab inside the panel', () => {
    mount()
    openManager()
    const focusable = Array.from(panel().querySelectorAll<HTMLElement>('button:not([disabled]),input,textarea'))
    const first = focusable[0] as HTMLElement
    const last = focusable[focusable.length - 1] as HTMLElement

    fireEvent.keyDown(last, { key: 'Tab' })
    expect(document.activeElement).toBe(first)

    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
  })

  it('is registered independently, so the bar layout can still open it', () => {
    // With `bar`, the management entry lives in the composer dock while the
    // overlay rides its own cell on the input dock (spec 8.1).
    setup({ layout: 'bar' })
    mount()

    openManager()

    expect(panel()).toBeTruthy()
  })

  it('renders on document.body, out of the dock subtree it is registered in', () => {
    // Ticket 26; why a z-index alone could not do it is written at the portal itself.
    // The backdrop goes with the panel — left behind, it would scrim the wrong layer.
    const { container } = mount()

    openManager()

    expect(container.contains(panel())).toBe(false)
    expect(panel().parentElement).toBe(document.body)
    expect(managerBackdrop()?.parentElement).toBe(document.body)
  })

  it('takes the portal down with it, on close and on unmount', () => {
    mount()

    openManager()
    fireEvent.keyDown(panel(), { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: zh['manager.title'] })).toBeNull()
    expect(managerBackdrop()).toBeNull()

    // And a fiber that goes away with the panel open leaves nothing on the body
    // either (spec 7.3): the portal is not a container this feature owns.
    openManager()
    expect(screen.getByRole('dialog', { name: zh['manager.title'] })).toBeTruthy()
    cleanup()
    expect(screen.queryByRole('dialog', { name: zh['manager.title'] })).toBeNull()
    expect(managerBackdrop()).toBeNull()
  })

  it('draws one overlay, not one per Resident Composer', () => {
    render(
      <>
        <Session sessionId="session-1" />
        <Session sessionId="session-2" />
      </>,
    )

    fireEvent.click(screen.getAllByRole('button', { name: zh['manage'] })[1] as HTMLElement)

    expect(screen.getAllByRole('dialog', { name: zh['manager.title'] })).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// Layout switching (spec 8.1, 8.3)
// ---------------------------------------------------------------------------

describe('switching the global layout', () => {
  it('persists the choice and moves the surface to the other dock', async () => {
    setup({ layout: 'ribbon' })
    mount()
    openManager()

    fireEvent.click(screen.getByRole('button', { name: zh['manager.layout.bar'] }))
    await settle()

    expect(harness.stored?.layout).toBe('bar')
    expect(document.querySelector('[data-quick-actions-layout="bar"]')).not.toBeNull()
    expect(document.querySelector('[data-quick-actions-layout="ribbon"]')).toBeNull()
  })

  it('marks the current layout as chosen and offers no write for it', () => {
    setup({ layout: 'launcher' })
    mount()
    openManager()

    const current = screen.getByRole('button', { name: zh['manager.layout.launcher'] })
    expect(current.getAttribute('aria-pressed')).toBe('true')
    expect(blocked(current)).toBe(true)

    fireEvent.click(current)
    expect(harness.document.writes).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Preset management (spec 5.1, 5.2, 8.3)
// ---------------------------------------------------------------------------

describe('managing a Preset Quick Action', () => {
  beforeEach(() => {
    setup()
    mount()
    openManager()
  })

  it('hides a preset from the Composer while keeping it listed and restorable', async () => {
    fireEvent.click(control('preset:p1', zh['manager.hide']))
    await settle()

    expect(harness.stored?.presetStateById).toEqual({ p1: { hidden: true } })
    expect(rowOf('preset:p1').getAttribute('data-quick-action-hidden')).toBe('')
    expect(rowOf('preset:p1').textContent).toContain(zh['manager.hidden'])
    // Gone from the Composer, still here (spec 3).
    expect(document.querySelector('[data-quick-actions-layout] [data-quick-action="preset:p1"]')).toBeNull()

    fireEvent.click(control('preset:p1', zh['manager.restore']))
    await settle()

    expect(harness.stored?.presetStateById).toEqual({})
    expect(document.querySelector('[data-quick-actions-layout] [data-quick-action="preset:p1"]')).not.toBeNull()
  })

  it('offers no edit or delete for an author-owned preset', () => {
    const names = Array.from(rowOf('preset:p1').querySelectorAll('button')).map((button) => button.textContent)
    expect(names).not.toContain(zh['manager.edit'])
    expect(names).not.toContain(zh['manager.delete'])
  })

  it('clones a preset into an editable custom action, copying its confirmation policy', async () => {
    // p2 is a Command Send Action the author left confirmed; a clone copies that
    // as it stands rather than re-defaulting it (spec 5.2).
    fireEvent.click(control('preset:p2', zh['manager.clone']))
    await settle()

    expect(Object.values(storedActions())).toEqual([
      {
        kind: 'send',
        label: '压缩',
        text: '/compact',
        confirm: true,
        enabled: true,
        clonedFromPresetId: 'p2',
      },
    ])
    expect(rowOf('custom:custom-1').textContent).toContain(zh['manager.clonedFrom'])
  })

  it('reorders the shared order across both sources', async () => {
    expect(managedKeys()).toEqual(['preset:p1', 'preset:p2', 'preset:p3'])

    fireEvent.click(control('preset:p3', zh['manager.moveUp']))
    await settle()

    expect(managedKeys()).toEqual(['preset:p1', 'preset:p3', 'preset:p2'])
    expect(harness.stored?.actionOrder).toEqual([
      { source: 'preset', id: 'p1' },
      { source: 'preset', id: 'p3' },
      { source: 'preset', id: 'p2' },
    ])
  })

  it('offers no move beyond the ends of the list, without dropping focus there', async () => {
    const up = control('preset:p1', zh['manager.moveUp'])
    const down = control('preset:p3', zh['manager.moveDown'])
    expect(blocked(up)).toBe(true)
    expect(blocked(down)).toBe(true)

    press(up)
    await settle()

    expect(managedKeys()).toEqual(['preset:p1', 'preset:p2', 'preset:p3'])
    expect(harness.document.writes).toBe(0)
    expect(document.activeElement).toBe(up)
  })

  it('keeps the caret on the move control after a reorder lands', async () => {
    const down = control('preset:p1', zh['manager.moveDown'])

    press(down)
    await settle()

    expect(managedKeys()).toEqual(['preset:p2', 'preset:p1', 'preset:p3'])
    expect(document.activeElement).toBe(control('preset:p1', zh['manager.moveDown']))
  })
})

// ---------------------------------------------------------------------------
// The Custom Quick Action form (spec 4.3, 8.3, 10)
// ---------------------------------------------------------------------------

describe('creating and editing a Custom Quick Action', () => {
  beforeEach(() => {
    setup()
    mount()
    openManager()
  })

  function fill(values: { readonly label?: string; readonly text?: string; readonly icon?: string }): void {
    if (values.label !== undefined) {
      fireEvent.change(screen.getByLabelText(zh['form.label']), { target: { value: values.label } })
    }
    if (values.text !== undefined) {
      fireEvent.change(screen.getByLabelText(zh['form.text']), { target: { value: values.text } })
    }
    if (values.icon !== undefined) {
      fireEvent.change(screen.getByLabelText(zh['form.icon']), { target: { value: values.icon } })
    }
  }

  it('offers no action-type selector: the first release is always a send action', () => {
    fireEvent.click(screen.getByRole('button', { name: zh['manager.new'] }))

    const form = screen.getByRole('group', { name: zh['form.title.new'] })
    expect(form.querySelectorAll('select')).toHaveLength(0)
    expect(Array.from(form.querySelectorAll('input')).map((input) => input.getAttribute('type'))).toEqual([
      null,
      null,
      'checkbox',
    ])
  })

  it('persists a new action and shows it in the Composer', async () => {
    fireEvent.click(screen.getByRole('button', { name: zh['manager.new'] }))
    fill({ label: '我的动作', text: '请给我一份变更清单', icon: '📋' })

    fireEvent.click(screen.getByRole('button', { name: zh['form.save'] }))
    await settle()

    expect(storedActions()).toEqual({
      'custom-1': {
        kind: 'send',
        label: '我的动作',
        text: '请给我一份变更清单',
        icon: '📋',
        confirm: true,
        enabled: true,
      },
    })
    expect(screen.queryByRole('group', { name: zh['form.title.new'] })).toBeNull()
    expect(document.querySelector('[data-quick-actions-layout] [data-quick-action="custom:custom-1"]')).not.toBeNull()
  })

  it('reports no success of its own beyond the list itself', async () => {
    fireEvent.click(screen.getByRole('button', { name: zh['manager.new'] }))
    fill({ label: '我的动作', text: '正文' })

    fireEvent.click(screen.getByRole('button', { name: zh['form.save'] }))
    await settle()

    // Spec 9.5: the result on screen is the feedback; no extra toast.
    expect(screen.queryAllByRole('alert')).toEqual([])
    expect(document.querySelector('[data-quick-actions-write-failure]')).toBeNull()
  })

  it('opens quiet, then reports the blank fields the shared rules refuse', async () => {
    fireEvent.click(screen.getByRole('button', { name: zh['manager.new'] }))
    expect(document.querySelector('[data-quick-actions-issue]')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: zh['form.save'] }))
    await settle()

    expect(screen.getByText(zh['issue.label.blank'])).toBeTruthy()
    expect(screen.getByText(zh['issue.text.blank'])).toBeTruthy()
    // Nothing crossed the wire for a draft the model already refuses.
    expect(harness.document.writes).toBe(0)
    expect(screen.getByRole('group', { name: zh['form.title.new'] })).toBeTruthy()
  })

  it('reports a non-emoji icon while it is being typed', () => {
    fireEvent.click(screen.getByRole('button', { name: zh['manager.new'] }))

    fill({ label: '标签', text: '正文', icon: 'ab' })

    expect(screen.getByText(zh['issue.icon.not-emoji'])).toBeTruthy()
  })

  it('reports a reserved reference placeholder in the text', () => {
    fireEvent.click(screen.getByRole('button', { name: zh['manager.new'] }))

    fill({ label: '标签', text: 'before ￼ after' })

    expect(screen.getByText(zh['issue.text.reserved-placeholder'])).toBeTruthy()
  })

  it('edits an existing action from its stored content', async () => {
    setup({
      user: {
        userActionsById: { mine: { kind: 'send', label: '旧标签', text: '正文', confirm: true, enabled: true } },
        actionOrder: [{ source: 'custom', id: 'mine' }],
      },
    })
    mount()
    openManager()

    fireEvent.click(control('custom:mine', zh['manager.edit']))
    expect(screen.getByLabelText(zh['form.label'])).toHaveProperty('value', '旧标签')

    fill({ label: '新标签' })
    fireEvent.click(screen.getByRole('button', { name: zh['form.save'] }))
    await settle()

    expect(storedActions().mine?.label).toBe('新标签')
  })

  it('disables and re-enables an action without deleting it', async () => {
    setup({
      user: {
        userActionsById: { mine: { kind: 'send', label: '我的', text: '正文', confirm: false, enabled: true } },
        actionOrder: [{ source: 'custom', id: 'mine' }],
      },
    })
    mount()
    openManager()

    fireEvent.click(control('custom:mine', zh['manager.disable']))
    await settle()
    expect(storedActions().mine?.enabled).toBe(false)
    expect(rowOf('custom:mine').textContent).toContain(zh['manager.disabled'])

    fireEvent.click(control('custom:mine', zh['manager.enable']))
    await settle()
    expect(storedActions().mine?.enabled).toBe(true)
  })

  it('asks once before deleting, and deletes only on the second press', async () => {
    setup({
      presets: [],
      user: {
        userActionsById: { mine: { kind: 'send', label: '我的', text: '正文', confirm: false, enabled: true } },
        actionOrder: [{ source: 'custom', id: 'mine' }],
      },
    })
    mount()
    openManager()

    fireEvent.click(control('custom:mine', zh['manager.delete']))
    await settle()
    expect(storedActions()).toEqual({
      mine: { kind: 'send', label: '我的', text: '正文', confirm: false, enabled: true },
    })

    fireEvent.click(control('custom:mine', zh['manager.delete.confirm']))
    await settle()

    expect(storedActions()).toEqual({})
    expect(managedKeys()).toEqual([])
    expect(screen.getByText(zh['manager.empty'])).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// Command Send Actions (spec 4.3, 8.3, 16.1)
// ---------------------------------------------------------------------------

describe('a Command Send Action in the form', () => {
  beforeEach(() => {
    setup()
    mount()
    openManager()
    fireEvent.click(screen.getByRole('button', { name: zh['manager.new'] }))
  })

  it('warns as soon as the text becomes a command, and locks nothing', () => {
    expect(document.querySelector('[data-quick-actions-command-warning]')).toBeNull()

    fireEvent.change(screen.getByLabelText(zh['form.text']), { target: { value: '  /compact' } })

    expect(document.querySelector('[data-quick-actions-command-warning]')?.textContent).toBe(
      zh['form.command.warning'],
    )
    // Every control stays live — the warning is a warning (spec 8.3).
    const form = screen.getByRole('group', { name: zh['form.title.new'] })
    for (const field of Array.from(form.querySelectorAll('input,textarea,button'))) {
      expect(field).toHaveProperty('disabled', false)
    }
  })

  it('never rewrites a confirmation the user has already set', async () => {
    const confirm = screen.getByLabelText(zh['form.confirm'])
    expect(confirm).toHaveProperty('checked', true)

    fireEvent.click(confirm)
    expect(confirm).toHaveProperty('checked', false)

    // The text crossing the Command Send Action boundary must not put it back.
    fireEvent.change(screen.getByLabelText(zh['form.text']), { target: { value: '/compact' } })
    expect(screen.getByLabelText(zh['form.confirm'])).toHaveProperty('checked', false)

    fireEvent.change(screen.getByLabelText(zh['form.label']), { target: { value: '压缩' } })
    fireEvent.click(screen.getByRole('button', { name: zh['form.save'] }))
    await settle()

    expect(storedActions()['custom-1']?.confirm).toBe(false)
  })

  it('carries the centralized explanation beside the markers it explains', () => {
    // p2 is a command preset, so the badge is on screen and so is its meaning.
    expect(rowOf('preset:p2').textContent).toContain(zh['command.badge'])
    expect(document.querySelector('[data-quick-actions-command-notice]')?.textContent).toBe(
      zh['manager.command.notice'],
    )
  })

  it('keeps the centralized explanation even before any command action exists', () => {
    // Spec 8.3 lists the explanation unconditionally: it is what the marker
    // *means*, and the user about to write their first command text needs it
    // before any marker exists.
    setup({ presets: [{ id: 'p1', label: '继续', text: '继续' }] })
    mount()
    openManager()

    expect(document.querySelector('[data-quick-actions-command-notice]')?.textContent).toBe(
      zh['manager.command.notice'],
    )
    expect(document.querySelector('[data-quick-actions-command-warning]')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// The action ceiling and passive overflow (spec 5.4)
// ---------------------------------------------------------------------------

function presetsOf(count: number): readonly Record<string, unknown>[] {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `p${index + 1}`,
    label: `动作 ${index + 1}`,
    text: `正文 ${index + 1}`,
  }))
}

function customsOf(count: number): Record<string, unknown> {
  const userActionsById: Record<string, unknown> = {}
  for (let index = 0; index < count; index += 1) {
    userActionsById[`c${index}`] = { kind: 'send', label: `我的 ${index}`, text: '正文', confirm: false, enabled: true }
  }
  return userActionsById
}

describe('the action ceiling', () => {
  it('disables creating and cloning at exactly the limit, and says so', () => {
    setup({ presets: presetsOf(50) })
    mount()
    openManager()

    expect(blocked(screen.getByRole('button', { name: zh['manager.new'] }))).toBe(true)
    expect(blocked(control('preset:p1', zh['manager.clone']))).toBe(true)
    expect(document.querySelector('[data-quick-actions-limit="reached"]')).not.toBeNull()
    expect(screen.getByText(t('manager.limit', { limit: 50 }))).toBeTruthy()

    // Blocked means blocked: pressing either one writes nothing and opens nothing.
    fireEvent.click(control('preset:p1', zh['manager.clone']))
    fireEvent.click(screen.getByRole('button', { name: zh['manager.new'] }))
    expect(harness.document.writes).toBe(0)
    expect(screen.queryByRole('group', { name: zh['form.title.new'] })).toBeNull()
  })

  it('counts hidden and disabled actions towards the limit', () => {
    setup({
      presets: presetsOf(49),
      user: {
        userActionsById: customsOf(1),
        presetStateById: { p1: { hidden: true } },
        actionOrder: [{ source: 'custom', id: 'c0' }],
      },
    })
    mount()
    openManager()

    // 49 presets — one of them hidden — plus one custom action is still 50.
    expect(screen.getByText(t('manager.count', { total: 50, limit: 50 }))).toBeTruthy()
    expect(blocked(screen.getByRole('button', { name: zh['manager.new'] }))).toBe(true)
  })

  it('loads a passively overflowed snapshot without losing anything', () => {
    // A package upgrade grew the catalog under a legal snapshot: 50 presets plus
    // three existing custom actions is 53 (spec 5.4, 13.2).
    setup({ presets: presetsOf(50), user: { userActionsById: customsOf(3) } })
    mount()
    openManager()

    expect(managedKeys()).toHaveLength(53)
    expect(document.querySelector('[data-quick-actions-limit="overflow"]')).not.toBeNull()
    expect(screen.getByText(t('manager.overflow', { total: 53, limit: 50 }))).toBeTruthy()
    expect(blocked(screen.getByRole('button', { name: zh['manager.new'] }))).toBe(true)
    expect(blocked(control('preset:p1', zh['manager.clone']))).toBe(true)
  })

  it('still allows hiding, disabling and reordering while overflowed', () => {
    setup({ presets: presetsOf(50), user: { userActionsById: customsOf(3) } })
    mount()
    openManager()

    for (const name of [zh['manager.hide'], zh['manager.moveDown']]) {
      expect(blocked(control('preset:p1', name))).toBe(false)
    }
    for (const name of [zh['manager.disable'], zh['manager.delete'], zh['manager.edit']]) {
      expect(blocked(control('custom:c0', name))).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// Read-only, refusal and revision conflict (spec 10)
// ---------------------------------------------------------------------------

describe('when settings cannot be written', () => {
  it('is read-only, and says storage is unavailable, when the namespace is unserved', () => {
    setup({ user: false })
    mount()
    openManager()

    // The authoritative presets still render; management is read-only (spec 10).
    expect(managedKeys()).toEqual(['preset:p1', 'preset:p2', 'preset:p3'])
    expect(document.querySelector('[data-quick-actions-readonly="storage"]')).not.toBeNull()
    expect(control('preset:p1', zh['manager.hide'])).toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: zh['manager.new'] })).toHaveProperty('disabled', true)
  })

  it('is read-only, and says the connection is down, after a disconnect', () => {
    setup()
    mount()
    openManager()

    act(() => {
      harness.connection.set('disconnected')
    })

    expect(document.querySelector('[data-quick-actions-readonly="offline"]')).not.toBeNull()
    expect(control('preset:p1', zh['manager.hide'])).toHaveProperty('disabled', true)
  })

  it('keeps the form content and stays open when the Host refuses the write', async () => {
    setup()
    mount()
    openManager()
    fireEvent.click(screen.getByRole('button', { name: zh['manager.new'] }))
    fireEvent.change(screen.getByLabelText(zh['form.label']), { target: { value: '我的动作' } })
    fireEvent.change(screen.getByLabelText(zh['form.text']), { target: { value: '正文' } })
    harness.document.refuseWrites = 'rejected'

    fireEvent.click(screen.getByRole('button', { name: zh['form.save'] }))
    await settle()

    expect(document.querySelector('[data-quick-actions-write-failure="refused"]')?.textContent).toContain(
      zh['write.refused'],
    )
    expect(screen.getByLabelText(zh['form.label'])).toHaveProperty('value', '我的动作')
    expect(screen.getByLabelText(zh['form.text'])).toHaveProperty('value', '正文')
    expect(panel()).toBeTruthy()
  })

  it('reports a transport failure by name, and never retries by itself', async () => {
    setup()
    mount()
    openManager()
    harness.document.refuseWrites = 'throw'

    fireEvent.click(control('preset:p1', zh['manager.hide']))
    await settle()
    const attempted = harness.document.writes

    expect(document.querySelector('[data-quick-actions-write-failure="failed"]')).not.toBeNull()
    await settle()
    expect(harness.document.writes).toBe(attempted)
  })

  it('asks the user to confirm again after a revision conflict, keeping the draft', async () => {
    setup()
    mount()
    openManager()
    fireEvent.click(screen.getByRole('button', { name: zh['manager.new'] }))
    fireEvent.change(screen.getByLabelText(zh['form.label']), { target: { value: '我的动作' } })
    fireEvent.change(screen.getByLabelText(zh['form.text']), { target: { value: '正文' } })
    // Another writer wins the fence while this write is in flight.
    harness.document.onWrite = () => {
      harness.document.onWrite = undefined
      harness.document.concurrentWrite(QUICK_ACTIONS_SETTINGS_NAMESPACE, settingsSection({ layout: 'launcher' }))
    }

    fireEvent.click(screen.getByRole('button', { name: zh['form.save'] }))
    await settle()

    expect(document.querySelector('[data-quick-actions-write-failure="conflict"]')?.textContent).toContain(
      zh['write.conflict'],
    )
    // The refreshed authority is what is on screen now, and the draft survived
    // for the user to confirm again (spec 10).
    expect(screen.getByLabelText(zh['form.label'])).toHaveProperty('value', '我的动作')
    expect(harness.controller.getSnapshot().settings.status === 'ready').toBe(true)

    fireEvent.click(screen.getByRole('button', { name: zh['form.save'] }))
    await settle()

    // A fresh Custom Action ID per attempt: the planner refuses a taken id rather
    // than overwriting, so the retry is a new identity, not a resubmitted one.
    expect(Object.values(storedActions()).map((action) => action.label)).toEqual(['我的动作'])
    expect(document.querySelector('[data-quick-actions-write-failure]')).toBeNull()
  })

  it('dismisses a failure without touching the stored state', async () => {
    setup()
    mount()
    openManager()
    harness.document.refuseWrites = 'rejected'
    fireEvent.click(control('preset:p1', zh['manager.hide']))
    await settle()

    fireEvent.click(screen.getByRole('button', { name: zh['write.dismiss'] }))

    expect(document.querySelector('[data-quick-actions-write-failure]')).toBeNull()
    expect(harness.stored?.presetStateById).toEqual({})
  })

  it('offers a retryable catalog error where the list would be', () => {
    setup({ noCatalog: true })
    mount()
    // No layout renders without a catalog, so the manager is opened directly.
    act(() => {
      harness.controller.openManager()
    })

    // The layout entry shows the same retryable error where the layout would be,
    // so this assertion is scoped to the panel's own copy.
    expect(within(panel()).getByText(zh['catalog.unavailable'])).toBeTruthy()
    expect(within(panel()).getByRole('button', { name: zh['catalog.retry'] })).toBeTruthy()
    // Spec 10 keeps the two first-read failures apart: with no catalog there is
    // nothing to be read-only *about*, so the storage notice must not appear
    // beside the catalog error and blame the wrong layer.
    expect(document.querySelector('[data-quick-actions-readonly]')).toBeNull()
  })

  it('offers an explicit retry that re-plans the failed write', async () => {
    setup()
    mount()
    openManager()
    harness.document.refuseWrites = 'rejected'
    fireEvent.click(control('preset:p1', zh['manager.hide']))
    await settle()
    expect(document.querySelector('[data-quick-actions-write-failure]')).not.toBeNull()

    harness.document.refuseWrites = undefined
    fireEvent.click(screen.getByRole('button', { name: zh['write.retry'] }))
    await settle()

    expect(harness.stored?.presetStateById).toEqual({ p1: { hidden: true } })
    expect(document.querySelector('[data-quick-actions-write-failure]')).toBeNull()
  })

  it('retries a form save with whatever the form holds now, not the failed draft', async () => {
    setup()
    mount()
    openManager()
    fireEvent.click(screen.getByRole('button', { name: zh['manager.new'] }))
    fireEvent.change(screen.getByLabelText(zh['form.label']), { target: { value: '打错的名字' } })
    fireEvent.change(screen.getByLabelText(zh['form.text']), { target: { value: '正文' } })
    harness.document.refuseWrites = 'rejected'
    fireEvent.click(screen.getByRole('button', { name: zh['form.save'] }))
    await settle()

    // The user fixes the label before pressing retry; the earlier draft must not
    // be resubmitted behind their back.
    harness.document.refuseWrites = undefined
    fireEvent.change(screen.getByLabelText(zh['form.label']), { target: { value: '改好的名字' } })
    fireEvent.click(screen.getByRole('button', { name: zh['write.retry'] }))
    await settle()

    expect(Object.values(storedActions()).map((action) => action.label)).toEqual(['改好的名字'])
  })

  it('lets an open form be backed out of while read-only', async () => {
    setup()
    mount()
    openManager()
    fireEvent.click(screen.getByRole('button', { name: zh['manager.new'] }))
    fireEvent.change(screen.getByLabelText(zh['form.label']), { target: { value: '半成品' } })

    act(() => {
      harness.connection.set('disconnected')
    })

    // Save is inert, the fields are inert — but Cancel writes nothing, so a
    // read-only panel must not leave the user holding a draft with no way out.
    expect(screen.getByRole('button', { name: zh['form.save'] })).toHaveProperty('disabled', true)
    expect(screen.getByLabelText(zh['form.label'])).toHaveProperty('disabled', true)

    fireEvent.click(screen.getByRole('button', { name: zh['form.cancel'] }))
    await settle()

    expect(screen.queryByRole('group', { name: zh['form.title.new'] })).toBeNull()
    expect(panel()).toBeTruthy()
  })

  it('leaves the form on Escape without closing the panel behind it', () => {
    setup()
    mount()
    openManager()
    fireEvent.click(screen.getByRole('button', { name: zh['manager.new'] }))
    const text = screen.getByLabelText(zh['form.text'])
    fireEvent.change(text, { target: { value: '半成品' } })

    fireEvent.keyDown(text, { key: 'Escape' })

    // The innermost editing context is what Escape means: the form goes, the
    // panel stays.
    expect(screen.queryByRole('group', { name: zh['form.title.new'] })).toBeNull()
    expect(panel()).toBeTruthy()

    fireEvent.keyDown(panel(), { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: zh['manager.title'] })).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// The form as a nested editing context (spec 8.4, ticket 25)
// ---------------------------------------------------------------------------

describe('the form’s own focus scope', () => {
  const STORED = {
    userActionsById: {
      first: { kind: 'send', label: '第一个', text: '正文一', confirm: true, enabled: true },
      second: { kind: 'send', label: '第二个', text: '正文二', confirm: true, enabled: true },
    },
    actionOrder: [
      { source: 'custom', id: 'first' },
      { source: 'custom', id: 'second' },
    ],
  }

  it('opens with the caret in the label field, where the user is about to type', () => {
    setup()
    mount()
    openManager()

    press(screen.getByRole('button', { name: zh['manager.new'] }))

    expect(document.activeElement).toBe(screen.getByLabelText(zh['form.label']))
  })

  it('does the same for an edit, over the stored content', () => {
    setup({ user: STORED })
    mount()
    openManager()

    press(control('custom:first', zh['manager.edit']))

    const label = screen.getByLabelText(zh['form.label'])
    expect(document.activeElement).toBe(label)
    expect(label).toHaveProperty('value', '第一个')
  })

  it('makes Escape leave the form, not the panel, straight after the form opened', () => {
    // Ticket 25: with focus still on the button outside the form, the first
    // Escape after "new" reached the panel's own handler and closed the whole
    // panel. The innermost editing context must be what Escape means as soon
    // as that context exists.
    setup()
    mount()
    openManager()
    const create = screen.getByRole('button', { name: zh['manager.new'] })
    press(create)

    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' })

    expect(screen.queryByRole('group', { name: zh['form.title.new'] })).toBeNull()
    expect(panel()).toBeTruthy()
    // Focus went back to the control that opened the form, inside the panel...
    expect(document.activeElement).toBe(create)
    // ...so a second Escape means what it always meant: close the panel.
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: zh['manager.title'] })).toBeNull()
  })

  it('returns focus to the row’s edit control when the form is cancelled', () => {
    setup({ user: STORED })
    mount()
    openManager()
    const edit = control('custom:first', zh['manager.edit'])
    press(edit)

    fireEvent.click(screen.getByRole('button', { name: zh['form.cancel'] }))

    expect(screen.queryByRole('group', { name: zh['form.title.edit'] })).toBeNull()
    expect(document.activeElement).toBe(edit)
  })

  it('returns focus to the row’s edit control after a save lands', async () => {
    setup({ user: STORED })
    mount()
    openManager()
    press(control('custom:first', zh['manager.edit']))
    fireEvent.change(screen.getByLabelText(zh['form.label']), { target: { value: '改过的' } })

    fireEvent.click(screen.getByRole('button', { name: zh['form.save'] }))
    await settle()

    expect(storedActions().first?.label).toBe('改过的')
    expect(document.activeElement).toBe(control('custom:first', zh['manager.edit']))
  })

  it('moves the caret into the form again when it switches to another action', () => {
    setup({ user: STORED })
    mount()
    openManager()
    press(control('custom:first', zh['manager.edit']))
    const second = control('custom:second', zh['manager.edit'])

    press(second)

    const label = screen.getByLabelText(zh['form.label'])
    expect(document.activeElement).toBe(label)
    expect(label).toHaveProperty('value', '第二个')

    // And leaving it goes back to the control that opened *this* form.
    fireEvent.keyDown(label, { key: 'Escape' })
    expect(document.activeElement).toBe(second)
  })

  it('still returns focus to the management entry when the panel closes over an open form', () => {
    setup()
    mount()
    const entry = screen.getByRole('button', { name: zh['manage'] })
    press(entry)
    press(screen.getByRole('button', { name: zh['manager.new'] }))
    expect(document.activeElement).toBe(screen.getByLabelText(zh['form.label']))

    fireEvent.click(screen.getByRole('button', { name: zh['manager.close'] }))

    expect(screen.queryByRole('dialog', { name: zh['manager.title'] })).toBeNull()
    expect(document.activeElement).toBe(entry)
  })
})
