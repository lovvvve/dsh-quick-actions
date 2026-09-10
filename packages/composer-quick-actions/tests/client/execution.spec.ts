/**
 * The per-Session execution contract of spec 9.2–9.5: preconditions, final
 * re-verification, the two-step official load, the single-flight window judged
 * from the public Input snapshot, and the conservative failure semantics.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  createQuickActionSessionEngine,
  createQuickActionSessionRegistry,
} from '../../src/client/session/execution.js'
import type { QuickActionSessionEngine, QuickActionSessionState } from '../../src/client/session/execution.js'
import { composerGate, isOccupiedDraft } from '../../src/client/session/guards.js'
import type { ComposerBlock, InputState, SessionSnapshot } from '../../src/client/dsh.js'
import type { ProjectedQuickAction } from '../../src/model/index.js'
import { FakeComposerInput, fakeSession } from './composer.js'

function action(overrides: Partial<ProjectedQuickAction> = {}): ProjectedQuickAction {
  const text = overrides.text ?? 'ship it'
  return {
    ref: { source: 'custom', id: 'a' },
    label: 'Ship',
    text,
    icon: undefined,
    confirm: false,
    command: text.trimStart().startsWith('/'),
    editable: true,
    hidden: false,
    clonedFromPresetId: undefined,
    ...overrides,
  }
}

const OTHER = action({ ref: { source: 'custom', id: 'b' }, text: 'again' })

/**
 * One engine wired to one fake composer the way a mounted Slot entry is.
 *
 * `act` is the commit boundary React supplies in the real Client: a handler or a
 * store change runs to completion, and only then does the owning entry re-render
 * and hand the engine the resulting snapshot. Every interaction in these specs
 * goes through it, so nothing here can settle a flight in a way no real commit
 * would — which is exactly what the same-tick duplicate-send case turns on.
 */
class Harness {
  readonly input = new FakeComposerInput()
  readonly engine: QuickActionSessionEngine
  session: SessionSnapshot = fakeSession()
  block: ComposerBlock | undefined
  composer: readonly ProjectedQuickAction[] = []

  constructor() {
    this.engine = createQuickActionSessionEngine('session-1')
  }

  /** Run one interaction, then commit — what a click on a control amounts to. */
  act(interaction: () => void): void {
    interaction()
    this.commit()
  }

  /** Re-publish DSH state and the current Composer projection into the engine. */
  sync(actions: readonly ProjectedQuickAction[] = this.composer): void {
    this.composer = actions
    this.commit()
  }

  get state(): QuickActionSessionState {
    return this.engine.getSnapshot()
  }

  private commit(): void {
    this.engine.bind(this.input.actions, this.composer)
    this.engine.observe(this.input.snapshot, this.session, this.block)
  }
}

let harness: Harness

beforeEach(() => {
  harness = new Harness()
})

describe('draft occupancy', () => {
  const empty: InputState = { draft: '', attachmentIds: [], draftRev: 0, phase: 'plain', occurrences: [], queue: [] }

  it('counts any text, pure whitespace included', () => {
    expect(isOccupiedDraft({ ...empty, draft: ' ' })).toBe(true)
    expect(isOccupiedDraft({ ...empty, draft: '\n' })).toBe(true)
    expect(isOccupiedDraft(empty)).toBe(false)
  })

  it('counts every public attachment field', () => {
    expect(isOccupiedDraft({ ...empty, attachmentIds: ['a1'] })).toBe(true)
    expect(isOccupiedDraft({ ...empty, occurrences: [{ occurrenceId: 1, source: 'file', ref: 'a' }] })).toBe(true)
  })

  it('does not count the transient queue: a send may join a running turn', () => {
    expect(isOccupiedDraft({ ...empty, queue: [{ placement: 'queued' }] })).toBe(false)
    expect(
      composerGate({ ...empty, queue: [{ placement: 'queued' }] }, fakeSession({ running: true }), undefined),
    ).toBeUndefined()
  })

  it('refuses every composer state the shipped send button refuses', () => {
    expect(composerGate({ ...empty, phase: 'adjudicating' }, fakeSession(), undefined)).toBe('composer-busy')
    expect(composerGate({ ...empty, phase: 'submitting' }, fakeSession(), undefined)).toBe('composer-busy')
    expect(composerGate({ ...empty, phase: 'claimed' }, fakeSession(), undefined)).toBe('composer-busy')
    expect(composerGate(empty, fakeSession({ removed: true }), undefined)).toBe('session-removed')
    expect(composerGate(empty, fakeSession(), { reason: 'busy' })).toBe('composer-blocked')
    expect(composerGate(empty, fakeSession({ subagent: { address: { mode: 'continuable' } } }), undefined)).toBe(
      'parent-offline',
    )
  })
})

describe('one send', () => {
  it('loads the static text and submits it through the official path', () => {
    harness.sync([action()])
    harness.act(() => harness.engine.activate(action()))

    expect(harness.input.sends).toEqual(['ship it'])
    expect(harness.input.snapshot.draft).toBe('')
    expect(harness.state.sending).toBe(false)
  })

  it('produces no success feedback of its own', () => {
    harness.sync([action()])
    harness.act(() => harness.engine.activate(action()))
    expect(harness.state.feedback).toBeUndefined()
  })

  it('refuses to run against an occupied draft rather than carrying its content', () => {
    harness.act(() => harness.input.type('half a thought'))
    harness.sync([action()])

    expect(harness.state.unavailable).toBe('occupied-draft')
    harness.act(() => harness.engine.activate(action()))

    expect(harness.input.sends).toEqual([])
    expect(harness.input.snapshot.draft).toBe('half a thought')
    expect(harness.state.feedback).toEqual({ kind: 'state-changed' })
  })

  it('refuses to run while a draft attachment is present', () => {
    harness.act(() => harness.input.attach())
    harness.sync([action()])

    harness.act(() => harness.engine.activate(action()))
    expect(harness.input.sends).toEqual([])
    expect(harness.state.unavailable).toBe('occupied-draft')
  })

  it('refuses to run while a reference chip is in the draft', () => {
    harness.act(() => harness.input.attachReference())
    harness.sync([action()])

    harness.act(() => harness.engine.activate(action()))
    expect(harness.input.sends).toEqual([])
    expect(harness.state.unavailable).toBe('occupied-draft')
  })

  it('sends while the model is streaming, because the native queue allows it', () => {
    harness.session = fakeSession({ running: true })
    harness.act(() => harness.input.enqueue())
    harness.sync([action()])

    expect(harness.state.unavailable).toBeUndefined()
    harness.act(() => harness.engine.activate(action()))
    expect(harness.input.sends).toEqual(['ship it'])
  })
})

describe('the single-flight window', () => {
  it('never sends twice for two activations in the same tick', () => {
    harness.sync([action(), OTHER])

    harness.act(() => {
      harness.engine.activate(action())
      harness.engine.activate(action())
    })

    expect(harness.input.sends).toEqual(['ship it'])
  })

  it('is not fooled by the optimistic clear reopening the draft in the same tick', () => {
    // The official sink empties the draft inside `submit()`, so a second
    // activation one statement later passes every precondition again. Only the
    // flight itself stops it — "occupied draft" is not the mutex.
    harness.sync([action(), OTHER])

    harness.act(() => {
      harness.engine.activate(action())
      expect(isOccupiedDraft(harness.input.snapshot)).toBe(false)
      harness.engine.activate(OTHER)
    })

    expect(harness.input.sends).toEqual(['ship it'])
  })

  it('closes on the commit that observes the official optimistic commit, and does not jam', () => {
    harness.sync([action(), OTHER])

    harness.act(() => harness.engine.activate(action()))
    expect(harness.state.sending).toBe(false)

    harness.act(() => harness.engine.activate(OTHER))
    expect(harness.input.sends).toEqual(['ship it', 'again'])
  })

  it('holds the flight through the whole adjudication of a command send', () => {
    const command = action({ text: '/compact' })
    harness.sync([command])

    harness.act(() => harness.engine.activate(command))
    expect(harness.input.snapshot.phase).toBe('adjudicating')
    expect(harness.state.sending).toBe(true)

    // A second activation while the machine holds the frozen slot is ignored.
    harness.act(() => harness.engine.activate(command))
    expect(harness.state.activeRef).toEqual(command.ref)

    harness.act(() => harness.input.settleAdjudication('claim'))
    expect(harness.state.sending).toBe(true)

    harness.act(() => harness.input.settleClaim(true))
    expect(harness.state.sending).toBe(false)
    expect(harness.input.sends).toEqual(['/compact'])
  })

  it('releases the flight when an adjudicated command falls through to the default sink', () => {
    const command = action({ text: '/notacommand' })
    harness.sync([command])

    harness.act(() => harness.engine.activate(command))
    harness.act(() => harness.input.settleAdjudication('default'))

    expect(harness.input.sends).toEqual(['/notacommand'])
    expect(harness.state.sending).toBe(false)
  })

  it('releases the flight, and reports nothing, when a source handled the command itself', () => {
    const command = action({ text: '/handled' })
    harness.sync([command])

    harness.act(() => harness.engine.activate(command))
    harness.act(() => harness.input.settleAdjudication('handled'))

    expect(harness.state.sending).toBe(false)
    // The outcome belongs to DSH's own feedback, not to a second error here.
    expect(harness.state.feedback).toBeUndefined()
  })

  it('releases the flight when a claimed command submission fails', () => {
    const command = action({ text: '/deploy' })
    harness.sync([command])

    harness.act(() => harness.engine.activate(command))
    harness.act(() => harness.input.settleAdjudication('claim'))
    harness.act(() => harness.input.settleClaim(false))

    expect(harness.state.sending).toBe(false)
    expect(harness.input.sends).toEqual([])
    // DSH keeps the draft and reports the failure itself; no second error here.
    expect(harness.state.feedback).toBeUndefined()
  })

  it('reports "not sent, text retained" when the machine refuses the submission', () => {
    harness.sync([action()])
    harness.input.refuseSubmit = true

    harness.act(() => harness.engine.activate(action()))

    expect(harness.input.sends).toEqual([])
    expect(harness.input.snapshot.draft).toBe('ship it')
    expect(harness.state.feedback).toEqual({ kind: 'retained' })
    expect(harness.state.sending).toBe(false)
  })
})

describe('a send the connection cannot carry', () => {
  // Ticket 25, gap 1. The shipped `submit()` has no connection check: for any
  // non-blank plain text the machine answers `default-sink` + `commit-draft`
  // and the shell runs both synchronously, so the optimistic clear happens
  // before the sink can fail. Reading that clear, the engine closes the flight
  // as accepted — the message *has* entered the official path — and when the
  // sink fails later, DSH restores the draft and raises its own notice. Spec
  // 9.5 puts that failure with DSH's feedback, so the plugin must add nothing.
  it('closes the flight on the optimistic commit and reports nothing of its own', () => {
    harness.sync([action()])
    harness.input.holdSink = true

    harness.act(() => harness.engine.activate(action()))

    // The official machine took the text: cleared, flight released, no verdict.
    expect(harness.input.snapshot.draft).toBe('')
    expect(harness.state.sending).toBe(false)
    expect(harness.state.feedback).toBeUndefined()
  })

  it('leaves the restored draft, and its explanation, to DSH', () => {
    harness.sync([action()])
    harness.input.holdSink = true
    harness.act(() => harness.engine.activate(action()))

    harness.act(() => harness.input.failHeldSinks())

    expect(harness.input.sends).toEqual([])
    expect(harness.input.snapshot.draft).toBe('ship it')
    // No second error over DSH's own (spec 9.5)...
    expect(harness.state.feedback).toBeUndefined()
    // ...and the restored text is simply an Occupied Draft from here on, which
    // is how the controls explain why they are unavailable now.
    expect(harness.state.unavailable).toBe('occupied-draft')
    expect(harness.state.sending).toBe(false)
  })

  it('never retries the send on the user’s behalf', () => {
    harness.sync([action(), OTHER])
    harness.input.holdSink = true
    harness.act(() => harness.engine.activate(action()))
    harness.act(() => harness.input.failHeldSinks())

    // The user clears the restored text and the connection is back: the next
    // send is the user's own next activation, never a replay of the failed one.
    harness.input.holdSink = false
    harness.act(() => harness.input.type(''))
    harness.act(() => harness.engine.activate(OTHER))

    expect(harness.input.sends).toEqual(['again'])
  })
})

describe('confirmation', () => {
  const confirmed = action({ confirm: true })

  it('opens the panel with the label and the complete text, and touches no draft', () => {
    harness.sync([confirmed])
    harness.act(() => harness.engine.activate(confirmed))

    expect(harness.state.confirming).toEqual({
      ref: confirmed.ref,
      label: 'Ship',
      text: 'ship it',
      command: false,
    })
    expect(harness.input.snapshot.draft).toBe('')
    expect(harness.input.sends).toEqual([])
  })

  it('marks a Command Send Action so the panel can carry its notice', () => {
    const command = action({ text: '/compact', confirm: true })
    harness.sync([command])
    harness.act(() => harness.engine.activate(command))
    expect(harness.state.confirming?.command).toBe(true)
  })

  it('holds the single flight while the panel is open', () => {
    harness.sync([confirmed, OTHER])
    harness.act(() => harness.engine.activate(confirmed))
    harness.act(() => harness.engine.activate(OTHER))

    expect(harness.state.confirming?.ref).toEqual(confirmed.ref)
    expect(harness.input.sends).toEqual([])
  })

  it('cancels with no side effect', () => {
    harness.sync([confirmed])
    harness.act(() => harness.engine.activate(confirmed))
    harness.act(() => harness.engine.cancel())

    expect(harness.state.confirming).toBeUndefined()
    expect(harness.state.sending).toBe(false)
    expect(harness.state.feedback).toBeUndefined()
    expect(harness.input.snapshot.draft).toBe('')
    expect(harness.input.sends).toEqual([])
  })

  it('sends on confirmation', () => {
    harness.sync([confirmed])
    harness.act(() => harness.engine.activate(confirmed))
    harness.act(() => harness.engine.confirm())

    expect(harness.input.sends).toEqual(['ship it'])
  })

  it('takes the same two official steps a confirmation-free action takes', () => {
    const command = action({ text: '/compact', confirm: true })
    harness.sync([command])
    harness.act(() => harness.engine.activate(command))
    harness.act(() => harness.engine.confirm())

    expect(harness.input.snapshot.phase).toBe('adjudicating')
    harness.act(() => harness.input.settleAdjudication('default'))
    expect(harness.input.sends).toEqual(['/compact'])
  })
})

describe('the final re-verification', () => {
  const confirmed = action({ confirm: true })

  it('cancels the confirmation outright when the action is deleted while it waits', () => {
    // Spec 9.3 lists deletion among the side-effect-free cancellations, not
    // among the changes the user is asked to retry.
    harness.sync([confirmed])
    harness.act(() => harness.engine.activate(confirmed))

    harness.sync([])

    expect(harness.state.confirming).toBeUndefined()
    expect(harness.state.sending).toBe(false)
    expect(harness.state.feedback).toBeUndefined()
    expect(harness.input.sends).toEqual([])
  })

  it('cancels the confirmation outright when the action is hidden while it waits', () => {
    harness.sync([confirmed])
    harness.act(() => harness.engine.activate(confirmed))

    harness.sync([action({ confirm: true, hidden: true })])

    expect(harness.state.confirming).toBeUndefined()
    expect(harness.input.sends).toEqual([])
  })

  it('refuses when the text was rewritten while the panel was open', () => {
    harness.sync([confirmed])
    harness.act(() => harness.engine.activate(confirmed))
    harness.sync([action({ confirm: true, text: 'something else' })])

    harness.act(() => harness.engine.confirm())
    expect(harness.input.sends).toEqual([])
    expect(harness.state.feedback).toEqual({ kind: 'state-changed' })
  })

  it('refuses when the rewrite crossed the Command Send Action boundary', () => {
    harness.sync([confirmed])
    harness.act(() => harness.engine.activate(confirmed))
    harness.sync([action({ confirm: true, text: '/ship' })])

    harness.act(() => harness.engine.confirm())
    expect(harness.input.sends).toEqual([])
    expect(harness.state.feedback).toEqual({ kind: 'state-changed' })
  })

  it('refuses when the draft became occupied while the panel was open', () => {
    harness.sync([confirmed])
    harness.act(() => harness.engine.activate(confirmed))
    harness.act(() => harness.input.type('typed while deciding'))

    harness.act(() => harness.engine.confirm())

    expect(harness.input.sends).toEqual([])
    expect(harness.input.snapshot.draft).toBe('typed while deciding')
    expect(harness.state.feedback).toEqual({ kind: 'state-changed' })
  })

  it('refuses when the Session changed under the panel', () => {
    harness.sync([confirmed])
    harness.act(() => harness.engine.activate(confirmed))
    harness.session = fakeSession({ sessionId: 'session-2' })
    harness.sync()

    harness.act(() => harness.engine.confirm())
    expect(harness.input.sends).toEqual([])
    expect(harness.state.feedback).toEqual({ kind: 'state-changed' })
  })

  it('refuses when a Composer block was raised while the panel was open', () => {
    harness.sync([confirmed])
    harness.act(() => harness.engine.activate(confirmed))
    harness.block = { reason: 'a plugin owns this composer' }
    harness.sync()

    harness.act(() => harness.engine.confirm())
    expect(harness.input.sends).toEqual([])
    expect(harness.state.feedback).toEqual({ kind: 'state-changed' })
  })

  it('re-reads a confirmation-free action immediately before touching the draft', () => {
    // The activation is the only chance to re-verify here, and it must still
    // refuse an action the current Composer projection no longer carries.
    harness.sync([])
    harness.act(() => harness.engine.activate(action()))

    expect(harness.input.sends).toEqual([])
    expect(harness.state.feedback).toEqual({ kind: 'state-changed' })
  })
})

describe('write failures', () => {
  it('keeps the original draft and offers a retry when the load itself failed', () => {
    harness.sync([action()])
    harness.input.failSetDraft = true

    harness.act(() => harness.engine.activate(action()))

    expect(harness.input.snapshot.draft).toBe('')
    expect(harness.input.sends).toEqual([])
    expect(harness.state.sending).toBe(false)
    expect(harness.state.feedback).toEqual({ kind: 'failed', message: 'setDraft failed' })
  })

  it('retains the loaded text, and never retries, when the submission call threw', () => {
    harness.sync([action()])
    harness.input.failSubmit = true

    harness.act(() => harness.engine.activate(action()))

    expect(harness.input.snapshot.draft).toBe('ship it')
    expect(harness.input.sends).toEqual([])
    expect(harness.state.feedback).toEqual({ kind: 'retained' })
    expect(harness.state.sending).toBe(false)
  })

  it('clears the feedback on request', () => {
    harness.sync([action()])
    harness.input.failSubmit = true
    harness.act(() => harness.engine.activate(action()))

    harness.act(() => harness.engine.dismissFeedback())
    expect(harness.state.feedback).toBeUndefined()
  })
})

describe('the Session registry', () => {
  it('hands the same engine to every surface of one Session, so a layout switch mints no second lock', () => {
    const registry = createQuickActionSessionRegistry()
    const ribbon = registry.engineFor('session-1')
    const bar = registry.engineFor('session-1')

    expect(bar).toBe(ribbon)
    registry.dispose()
  })

  it('gives each Session its own engine', () => {
    const registry = createQuickActionSessionRegistry()
    expect(registry.engineFor('session-1')).not.toBe(registry.engineFor('session-2'))
    registry.dispose()
  })

  it('cancels a pending confirmation when the surface that opened it unmounts', () => {
    // Session switch, layout unmount and Slot replacement all land here: the
    // surface's own cleanup drops what never reached the official machine.
    const registry = createQuickActionSessionRegistry()
    const engine = registry.engineFor('session-1')
    const input = new FakeComposerInput()
    const confirmed = action({ confirm: true })
    engine.bind(input.actions, [confirmed])
    engine.observe(input.snapshot, fakeSession(), undefined)
    engine.activate(confirmed)
    expect(engine.getSnapshot().confirming).toBeDefined()

    engine.cancelPending()

    expect(input.sends).toEqual([])
    expect(engine.getSnapshot().confirming).toBeUndefined()
    registry.dispose()
  })

  it('leaves an accepted send with its own Session when the surface unmounts', () => {
    const registry = createQuickActionSessionRegistry()
    const engine = registry.engineFor('session-1')
    const input = new FakeComposerInput()
    const command = action({ text: '/compact' })
    engine.bind(input.actions, [command])
    engine.observe(input.snapshot, fakeSession(), undefined)
    engine.activate(command)

    engine.cancelPending()

    // The machine still owns the attempt; nothing here cancelled or retried it.
    expect(input.snapshot.phase).toBe('adjudicating')
    input.settleAdjudication('default')
    expect(input.sends).toEqual(['/compact'])
    registry.dispose()
  })

  it('releases every engine when the Client fiber unloads', () => {
    const registry = createQuickActionSessionRegistry()
    const engine = registry.engineFor('session-1')
    const input = new FakeComposerInput()
    engine.bind(input.actions, [action()])
    engine.observe(input.snapshot, fakeSession(), undefined)

    registry.dispose()

    engine.activate(action())
    expect(input.sends).toEqual([])
  })
})

describe('published state', () => {
  it('reports the same snapshot reference until something actually changes', () => {
    harness.sync([action()])
    const before = harness.state
    harness.sync([action()])
    expect(harness.state).toBe(before)
  })

  it('notifies subscribers when the flight opens and closes', () => {
    const seen: boolean[] = []
    harness.sync([action({ confirm: true })])
    harness.engine.subscribe(() => {
      seen.push(harness.state.sending)
    })

    harness.act(() => harness.engine.activate(action({ confirm: true })))
    harness.act(() => harness.engine.cancel())

    expect(seen).toEqual([true, false])
  })

  it('does nothing once disposed', () => {
    harness.sync([action()])
    harness.engine.dispose()
    harness.engine.activate(action())
    expect(harness.input.sends).toEqual([])
  })
})
