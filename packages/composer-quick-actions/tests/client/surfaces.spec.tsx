// @vitest-environment jsdom
/**
 * The Composer surfaces of spec 8.1, 8.2 and 7.3: the Resident Composer
 * predicate, the three layouts, the compact management entry that survives an
 * empty projection, the Unavailable Quick Action projection, and the per-Slot
 * error boundary.
 *
 * Both dock entries are rendered here the way DSH renders them — the composer
 * dock only where the shipped `InputBar` renders it, which is the residency
 * signal the input dock reads.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useSyncExternalStore } from 'react'
import type { ReactElement } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createQuickActionDockEntries } from '../../src/client/surfaces/entries.js'
import { SurfaceErrorBoundary } from '../../src/client/surfaces/ErrorBoundary.js'
import { createResidentComposerRegistry } from '../../src/client/surfaces/residency.js'
import { createQuickActionSessionRegistry } from '../../src/client/session/execution.js'
import { createQuickActionsController } from '../../src/client/controller.js'
import type { QuickActionsController } from '../../src/client/controller.js'
import type {
  ComposerBlock,
  ComposerBlocks,
  InputState,
  SessionSnapshot,
  SnapshotSelectorHook,
  Translate,
} from '../../src/client/dsh.js'
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

/** A stand-in for `ctx.conversation.blocks`, so the `blocked` guard can be driven. */
class FakeComposerBlocks implements ComposerBlocks {
  private block: ComposerBlock | undefined
  private readonly listeners = new Set<() => void>()

  storeFor(): { getSnapshot(): ComposerBlock | undefined; subscribe(listener: () => void): () => void } {
    return {
      getSnapshot: () => this.block,
      subscribe: (listener) => {
        this.listeners.add(listener)
        return () => {
          this.listeners.delete(listener)
        }
      },
    }
  }

  raise(reason: string | undefined): void {
    this.block = reason === undefined ? undefined : { reason }
    for (const listener of Array.from(this.listeners)) listener()
  }
}

/** The whole Client, wired the way `apply` wires it, but rendered by the test. */
class SurfaceHarness {
  readonly document = new FakeSettingsDocument()
  readonly connection = new FakeConnection()
  readonly input = new FakeComposerInput()
  readonly blocks = new FakeComposerBlocks()
  readonly residency = createResidentComposerRegistry()
  readonly sessions = createQuickActionSessionRegistry()
  readonly controller: QuickActionsController
  readonly entries: ReturnType<typeof createQuickActionDockEntries>
  private session: SessionSnapshot = fakeSession()
  private readonly sessionListeners = new Set<() => void>()

  constructor(layout: QuickActionLayout, presets: readonly Record<string, unknown>[]) {
    this.document.register(QUICK_ACTIONS_CATALOG_NAMESPACE, {
      base: { schemaVersion: 1, revision: 'r', presets },
    })
    this.document.register(QUICK_ACTIONS_SETTINGS_NAMESPACE, {
      defaults: { schemaVersion: 1, layout: 'ribbon', userActionsById: {}, actionOrder: [], presetStateById: {} },
      user: { schemaVersion: 1, layout, userActionsById: {}, actionOrder: [], presetStateById: {} },
    })
    this.controller = createQuickActionsController({
      settingsScope: fakeSettingsScope(this.document),
      connection: this.connection,
    })
    this.entries = createQuickActionDockEntries({
      controller: this.controller,
      sessions: this.sessions,
      residency: this.residency,
      blocks: () => this.blocks,
    })
  }

  get slotProps(): {
    sessionId: string
    useSession: SnapshotSelectorHook<SessionSnapshot>
    useInput: SnapshotSelectorHook<InputState>
    inputActions: FakeComposerInput['actions']
    t: Translate
  } {
    return {
      sessionId: 'session-1',
      useSession: hookOver({
        getSnapshot: () => this.session,
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

  setSession(next: SessionSnapshot): void {
    this.session = next
    for (const listener of Array.from(this.sessionListeners)) listener()
  }

  dispose(): void {
    this.sessions.dispose()
    this.controller.dispose()
  }
}

const PRESETS = [
  { id: 'p1', kind: 'send', label: '继续', text: '继续', confirm: false },
  { id: 'p2', kind: 'send', label: '压缩', text: '/compact', confirm: true },
]

let harness: SurfaceHarness

function mount(): void {
  const { InputDock, ComposerDock } = harness.entries
  const props = harness.slotProps
  render(
    <>
      <InputDock {...props} session={fakeSession()} input={harness.input.snapshot} />
      <ComposerDock {...props} />
    </>,
  )
}

/** The hero's shape: the input dock alone, with no composer dock beside it. */
function InputDockOnly(): ReactElement {
  const { InputDock } = harness.entries
  return <InputDock {...harness.slotProps} session={fakeSession()} input={harness.input.snapshot} />
}

function setup(layout: QuickActionLayout, presets: readonly Record<string, unknown>[] = PRESETS): void {
  harness = new SurfaceHarness(layout, presets)
}

afterEach(() => {
  cleanup()
  harness.dispose()
})

describe('the Resident Composer predicate', () => {
  beforeEach(() => {
    setup('ribbon')
  })

  it('renders nothing above a composer that publishes no composer dock', () => {
    // The blank-session hero renders the input dock but no composer dock, so
    // its beacon never marks the Session and the ribbon must stay away.
    const { container } = render(<InputDockOnly />)

    expect(screen.queryByRole('button', { name: '管理' })).toBeNull()
    expect(document.querySelector('[data-quick-actions-layout]')).toBeNull()
    // Not one element either: the composer stack is a flex column with a gap,
    // so an empty wrapper would still shift the hero's input box.
    expect(container.innerHTML).toBe('')
  })

  it('adds no element to the dock that does not own the current layout', () => {
    setup('bar')
    const { InputDock, ComposerDock } = harness.entries
    const props = harness.slotProps
    const { container } = render(
      <>
        <span data-input-dock="">
          <InputDock {...props} session={fakeSession()} input={harness.input.snapshot} />
        </span>
        <ComposerDock {...props} />
      </>,
    )

    expect(container.querySelector('[data-input-dock]')?.innerHTML).toBe('')
    expect(document.querySelector('[data-quick-actions-layout="bar"]')).not.toBeNull()
  })

  it('renders the ribbon once the composer dock marks the Session resident', () => {
    mount()

    expect(document.querySelector('[data-quick-actions-layout="ribbon"]')).not.toBeNull()
  })

  it('withdraws the ribbon when the composer dock unmounts', () => {
    const { InputDock, ComposerDock } = harness.entries
    const props = harness.slotProps
    const view = render(
      <>
        <InputDock {...props} session={fakeSession()} input={harness.input.snapshot} />
        <ComposerDock {...props} />
      </>,
    )
    expect(document.querySelector('[data-quick-actions-layout="ribbon"]')).not.toBeNull()

    view.rerender(
      <>
        <InputDock {...props} session={fakeSession()} input={harness.input.snapshot} />
      </>,
    )

    expect(document.querySelector('[data-quick-actions-layout="ribbon"]')).toBeNull()
  })
})

describe('the three layouts', () => {
  it('draws the ribbon above the composer card', () => {
    setup('ribbon')
    mount()

    const root = document.querySelector('[data-quick-actions-layout="ribbon"]')
    expect(root?.className).toBe('dsh-cqa-ribbon')
    expect(screen.getByText('快捷动作')).toBeTruthy()
    expect(screen.getByRole('button', { name: /继续/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: '管理' })).toBeTruthy()
  })

  it('draws the bar below the composer card, from the composer dock', () => {
    setup('bar')
    mount()

    const root = document.querySelector('[data-quick-actions-layout="bar"]')
    expect(root?.className).toBe('dsh-cqa-bar')
    // The input dock stays empty: only one layout renders at a time.
    expect(document.querySelectorAll('[data-quick-actions-layout]')).toHaveLength(1)
  })

  it('draws the launcher as one compact entry carrying the Composer projection count', () => {
    setup('launcher')
    mount()

    expect(document.querySelector('[data-quick-actions-layout="launcher"]')).not.toBeNull()
    expect(screen.getByRole('button', { name: '快捷动作 2' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /继续/ })).toBeNull()
  })

  it('opens the shared action list from the launcher entry', () => {
    setup('launcher')
    mount()

    fireEvent.click(screen.getByRole('button', { name: '快捷动作 2' }))

    expect(screen.getByRole('dialog', { name: '选择快捷动作' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /继续/ })).toBeTruthy()
  })

  it('keeps a compact management entry when nothing is left to run', () => {
    setup('launcher', [])
    mount()

    expect(screen.getByRole('button', { name: '管理' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '快捷动作 0' })).toBeTruthy()
  })

  it('keeps the management entry in the ribbon when nothing is left to run', () => {
    setup('ribbon', [])
    mount()

    expect(screen.getByRole('button', { name: '管理' })).toBeTruthy()
    expect(screen.getByText('暂无可用快捷动作')).toBeTruthy()
  })
})

describe('the Unavailable Quick Action projection', () => {
  beforeEach(() => {
    setup('ribbon')
    mount()
  })

  it('shows an action disabled with its reason rather than removing it', () => {
    act(() => {
      harness.input.type('half a thought')
    })

    const control = screen.getByRole('button', { name: /继续/ })
    expect(control).toHaveProperty('disabled', true)
    expect(control.getAttribute('title')).toBe(zh['unavailable.occupied-draft'])
  })

  it('honours a Composer block raised by another plugin', () => {
    act(() => {
      harness.blocks.raise('another feature owns this composer')
    })

    expect(screen.getByRole('button', { name: /继续/ })).toHaveProperty('disabled', true)
  })

  it('honours a removed Session', () => {
    act(() => {
      harness.setSession(fakeSession({ removed: true }))
    })

    expect(screen.getByRole('button', { name: /继续/ })).toHaveProperty('disabled', true)
  })
})

describe('executing from a surface', () => {
  it('sends a confirmation-free action through the official path', () => {
    setup('ribbon')
    mount()

    fireEvent.click(screen.getByRole('button', { name: /继续/ }))

    expect(harness.input.sends).toEqual(['继续'])
  })

  it('opens the confirmation panel with the complete text and the no-menu notice', () => {
    setup('ribbon')
    mount()

    fireEvent.click(screen.getByRole('button', { name: /压缩/ }))

    const panel = screen.getByRole('dialog', { name: '确认发送' })
    expect(panel.textContent).toContain('/compact')
    expect(panel.querySelector('[data-quick-actions-command-notice]')?.textContent).toBe(zh['confirm.command'])
    expect(harness.input.sends).toEqual([])
  })

  it('cancels a confirmation without touching the draft', () => {
    setup('ribbon')
    mount()
    fireEvent.click(screen.getByRole('button', { name: /压缩/ }))

    fireEvent.click(screen.getByRole('button', { name: '取消' }))

    expect(screen.queryByRole('dialog', { name: '确认发送' })).toBeNull()
    expect(harness.input.snapshot.draft).toBe('')
    expect(harness.input.sends).toEqual([])
  })

  it('cancels a confirmation on a backdrop click', () => {
    setup('ribbon')
    mount()
    fireEvent.click(screen.getByRole('button', { name: /压缩/ }))

    fireEvent.click(document.querySelector('[data-quick-actions-backdrop]') as Element)

    expect(screen.queryByRole('dialog', { name: '确认发送' })).toBeNull()
    expect(harness.input.sends).toEqual([])
  })

  it('closes a confirmation whose action is deleted while it waits', () => {
    setup('ribbon')
    mount()
    fireEvent.click(screen.getByRole('button', { name: /压缩/ }))
    expect(screen.getByRole('dialog', { name: '确认发送' })).toBeTruthy()

    act(() => {
      harness.document.concurrentWrite(QUICK_ACTIONS_SETTINGS_NAMESPACE, {
        schemaVersion: 1,
        layout: 'ribbon',
        userActionsById: {},
        actionOrder: [],
        presetStateById: { p2: { hidden: true } },
      })
    })

    expect(screen.queryByRole('dialog', { name: '确认发送' })).toBeNull()
    expect(harness.input.sends).toEqual([])
  })

  it('traps Tab inside the confirmation panel', () => {
    setup('ribbon')
    mount()
    fireEvent.click(screen.getByRole('button', { name: /压缩/ }))
    const cancel = screen.getByRole('button', { name: '取消' })
    const send = screen.getByRole('button', { name: '发送' })

    // Tab off the last control wraps to the first rather than reaching the draft.
    fireEvent.keyDown(send, { key: 'Tab' })
    expect(document.activeElement).toBe(cancel)

    fireEvent.keyDown(cancel, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(send)
  })

  it('falls back to the management entry when the opener cannot take focus back', () => {
    setup('ribbon')
    mount()
    const control = screen.getByRole('button', { name: /压缩/ })
    act(() => {
      control.focus()
    })
    fireEvent.click(control)

    // Confirming disables the opener for the flight, so focus must not be lost.
    fireEvent.click(screen.getByRole('button', { name: '发送' }))

    expect(document.activeElement).toBe(screen.getByRole('button', { name: '管理' }))
  })

  it('returns focus to the control that opened the confirmation', () => {
    setup('ribbon')
    mount()
    const control = screen.getByRole('button', { name: /压缩/ })
    act(() => {
      control.focus()
    })
    fireEvent.click(control)

    fireEvent.click(screen.getByRole('button', { name: '取消' }))

    expect(document.activeElement).toBe(control)
  })

  it('cancels a confirmation on Escape', () => {
    setup('ribbon')
    mount()
    fireEvent.click(screen.getByRole('button', { name: /压缩/ }))

    fireEvent.keyDown(screen.getByRole('dialog', { name: '确认发送' }), { key: 'Escape' })

    expect(screen.queryByRole('dialog', { name: '确认发送' })).toBeNull()
    expect(harness.input.sends).toEqual([])
  })

  it('sends the command action on confirmation, through the same two steps', () => {
    setup('ribbon')
    mount()
    fireEvent.click(screen.getByRole('button', { name: /压缩/ }))

    fireEvent.click(screen.getByRole('button', { name: '发送' }))

    expect(harness.input.snapshot.phase).toBe('adjudicating')
    act(() => {
      harness.input.settleAdjudication('default')
    })
    expect(harness.input.sends).toEqual(['/compact'])
  })

  it('reports a retained draft when the submission call fails, and keeps the text', () => {
    setup('ribbon')
    mount()
    harness.input.failSubmit = true

    fireEvent.click(screen.getByRole('button', { name: /继续/ }))

    expect(harness.input.snapshot.draft).toBe('继续')
    expect(screen.getByText(zh['feedback.retained'])).toBeTruthy()
  })

  it('never sends twice for two clicks in one tick', () => {
    setup('ribbon')
    mount()
    const control = screen.getByRole('button', { name: /继续/ })

    act(() => {
      fireEvent.click(control)
      fireEvent.click(control)
    })

    expect(harness.input.sends).toEqual(['继续'])
  })

  it('opens the management panel from the compact entry', () => {
    setup('ribbon')
    mount()

    fireEvent.click(screen.getByRole('button', { name: '管理' }))

    expect(harness.controller.getSnapshot().manager.open).toBe(true)
  })
})

describe('the catalog error state', () => {
  it('offers a retry where the layout would be, and does not reject into the page', async () => {
    setup('ribbon')
    // The Host serves no catalog layer: no action may render, and the entry
    // becomes the retryable catalog error of spec 10.
    harness.document.register(QUICK_ACTIONS_CATALOG_NAMESPACE, {})
    mount()

    const notice = document.querySelector('[data-quick-actions-catalog-error="unavailable"]')
    expect(notice).not.toBeNull()
    expect(screen.queryByRole('button', { name: /继续/ })).toBeNull()

    const rejections: unknown[] = []
    const onRejection = (event: PromiseRejectionEvent): void => {
      rejections.push(event.reason)
    }
    window.addEventListener('unhandledrejection', onRejection)
    harness.document.loadRejects = true

    fireEvent.click(screen.getByRole('button', { name: '重试' }))
    await act(async () => {
      await Promise.resolve()
    })

    window.removeEventListener('unhandledrejection', onRejection)
    expect(rejections).toEqual([])
  })
})

describe('failure isolation', () => {
  it('replaces the Quick Action area alone, with a retry, when a surface throws', () => {
    setup('ribbon')
    let explode = true
    function Boom(): null {
      if (explode) throw new Error('surface exploded')
      return null
    }

    render(
      <>
        <div data-composer-card="">composer</div>
        <SurfaceErrorBoundary t={t}>
          <Boom />
        </SurfaceErrorBoundary>
      </>,
    )

    // The Composer itself is untouched; only the Quick Action area is replaced.
    expect(screen.getByText('composer')).toBeTruthy()
    expect(screen.getByText('快捷动作出错了')).toBeTruthy()

    explode = false
    fireEvent.click(screen.getByRole('button', { name: '重新加载' }))

    expect(screen.queryByText('快捷动作出错了')).toBeNull()
  })
})
