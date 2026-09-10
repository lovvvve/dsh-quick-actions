/**
 * The per-Session Quick Action execution layer (spec 7.2, 9.2–9.5).
 *
 * One engine per Session owns the current `InputActions`, the confirmation in
 * flight and the send single-flight. Nothing global holds it: the registry below
 * hands the same engine to whichever Slot entry is currently rendering the
 * layout, so switching layouts re-mounts a component without ever minting a
 * second lock for the same Session (spec 7.2).
 *
 * ## The single-flight window
 *
 * Spec 9.5 asks for a window that runs from the first activation until the
 * official submission stage ends, judged only from the published Input snapshot
 * `{ draft, attachmentIds, draftRev, phase, claim?, occurrences, queue }`, with the
 * hard acceptance criterion that it never produces a duplicate send.
 *
 * The mutex itself is this module's own: {@link QuickActionSessionEngine.activate}
 * claims it synchronously, before any await and before the draft is touched. It
 * is deliberately not derived from draft occupancy — the official default sink
 * clears optimistically, so a second activation one frame later would find an
 * empty draft and pass every precondition. That is the duplicate-send trap, and
 * the regression test for it pins two activations in the same tick.
 *
 * What the public snapshot is used for is deciding *when the window may close*,
 * and the answer differs by the path the official machine took. Both readings
 * come from one place: `SessionInputShell.submit()` feeds an `enter` event to a
 * pure submit machine and executes the resulting effects synchronously, then
 * publishes. So the first snapshot observed after `submit()` returns already
 * carries the machine's verdict.
 *
 * - **The machine kept the frozen slot** (`phase` is `adjudicating` or
 *   `submitting`). Our attempt owns that slot exclusively — the machine refuses
 *   another `enter` while it is held — so the phase is attributable to this
 *   submission. The window stays open until the phase leaves those states; that
 *   is the latest reliable public boundary of the official stage, and past it
 *   every outcome belongs to DSH's own feedback (spec 9.5).
 * - **The machine committed an ordinary send** (`phase` back to `plain` and
 *   `draft` empty). The optimistic commit is the official stage's last publicly
 *   observable step: the default sink runs detached, and nothing about it
 *   reaches the public snapshot. So the commit is the latest boundary
 *   attributable to this submission, and the window closes there.
 * - **The machine refused the submission** (`phase` still `plain` and `draft`
 *   still holding content). Nothing was sent; the text stays exactly as loaded
 *   and the window closes with "not sent, text retained".
 *
 * The ordinary-send test is emptiness, not equality with the text that was
 * loaded: `draft` is the editor's clipboard-text projection rather than the
 * string handed to `setDraft`, so comparing the two would make the verdict
 * depend on that round trip. Emptiness needs no such assumption — the load only
 * ever runs against a verified-unoccupied draft, so anything in `draft` after it
 * is this feature's own text, and only the official commit clears it.
 *
 * The window also never closes inside the activation that opened it: settlement
 * is read from {@link QuickActionSessionEngine.observe}, which the owning entry
 * calls once per commit, so two activations in one tick can only ever produce
 * one send however fast the official sink empties the draft.
 *
 * Nothing here reads the DOM, Lexical, a private event or a private state, and
 * no DSH object is retained beyond the Session it belongs to.
 */
import { composerGate } from './guards.js'
import type { QuickActionUnavailableReason } from './guards.js'
import type { ComposerBlock, InputActions, InputState, SessionSnapshot } from '../dsh.js'
import { quickActionRefKey } from '../../model/index.js'
import type { ProjectedQuickAction, QuickActionRef } from '../../model/index.js'

/** The action awaiting the user's confirmation (spec 9.3). */
export interface PendingQuickActionConfirmation {
  readonly ref: QuickActionRef
  readonly label: string
  /** The complete text that will be submitted; the panel shows it verbatim. */
  readonly text: string
  /** Whether this is a Command Send Action, so the panel can carry its notice. */
  readonly command: boolean
}

/** What the surfaces report after an execution attempt (spec 9.3, 9.5). */
export type QuickActionFeedback =
  /** A re-verification found the action, Session, draft or guard changed. */
  | { readonly kind: 'state-changed' }
  /** The text was loaded but the machine did not take it; the draft keeps it. */
  | { readonly kind: 'retained' }
  /** Nothing was loaded; the draft is untouched and the action can be retried. */
  | { readonly kind: 'failed'; readonly message: string }

/** Everything the surfaces render about this Session's execution state. */
export interface QuickActionSessionState {
  /** Why no action may run right now, or `undefined` when they may (spec 3). */
  readonly unavailable: QuickActionUnavailableReason | undefined
  /** The confirmation panel's subject, when one is open. */
  readonly confirming: PendingQuickActionConfirmation | undefined
  /** Whether a send holds this Session's single flight. */
  readonly sending: boolean
  /** The action holding the flight, so its own control can show the state. */
  readonly activeRef: QuickActionRef | undefined
  /** The last execution feedback, until dismissed or superseded. */
  readonly feedback: QuickActionFeedback | undefined
}

/** The per-Session engine as the surfaces consume it. */
export interface QuickActionSessionEngine {
  getSnapshot(): QuickActionSessionState
  subscribe(listener: () => void): () => void
  /**
   * Publish the current DSH state into the engine. Called on every commit of
   * the entry that owns the layout, and the only way a snapshot reaches here —
   * the engine never subscribes to a DSH store of its own.
   */
  observe(input: InputState, session: SessionSnapshot, block: ComposerBlock | undefined): void
  /** Bind the live `InputActions` and the live Composer projection (spec 7.2). */
  bind(face: InputActions | undefined, composer: readonly ProjectedQuickAction[]): void
  /** Begin one Quick Action: claims the single flight, or is ignored. */
  activate(action: ProjectedQuickAction): void
  /** Confirm the pending action after re-verifying everything (spec 9.3). */
  confirm(): void
  /** Cancel the pending confirmation with no side effect (spec 9.3). */
  cancel(): void
  dismissFeedback(): void
  /**
   * Drop everything that has not entered the official state machine — the
   * Session-switch, layout-unmount and Slot-replacement rule of spec 7.2. A send
   * the machine already accepted is left alone: it belongs to its own Session.
   */
  cancelPending(): void
  dispose(): void
}

/** Where one activation stands. */
type Flight =
  /**
   * The mutex is held and nothing has been written yet: either the confirmation
   * panel is open, or the confirmation-free path is re-verifying (spec 9.3).
   */
  | { readonly stage: 'pending'; readonly ref: QuickActionRef }
  /**
   * `setDraft` + `submit` have been called; the next observed commit carries the
   * machine's verdict, because both calls publish synchronously before the
   * activation returns.
   */
  | { readonly stage: 'submitted'; readonly ref: QuickActionRef }
  /** The machine holds the frozen slot for this attempt; wait for it to release. */
  | { readonly stage: 'official'; readonly ref: QuickActionRef }

/** The last DSH state the engine was handed. */
interface Observed {
  readonly input: InputState
  readonly session: SessionSnapshot
  readonly block: ComposerBlock | undefined
}

/**
 * The executable identity of an action: everything a re-verification must find
 * unchanged before the draft is touched (spec 9.3). `command` is included even
 * though it is derived from `text`, so a rewrite that moves the action across
 * the Command Send Action boundary is rejected under its own name.
 */
function identityOf(action: ProjectedQuickAction): string {
  return JSON.stringify([
    quickActionRefKey(action.ref),
    action.label,
    action.text,
    action.confirm,
    action.command,
    action.hidden,
  ])
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Create the execution engine for one Session. */
export function createQuickActionSessionEngine(sessionId: string): QuickActionSessionEngine {
  const listeners = new Set<() => void>()
  let disposed = false
  let observed: Observed | undefined
  let actions: InputActions | undefined
  let composer: readonly ProjectedQuickAction[] = []
  let flight: Flight | undefined
  let confirming: PendingQuickActionConfirmation | undefined
  let identity: string | undefined
  let feedback: QuickActionFeedback | undefined
  /** True while `run` is on the stack, so no settlement can close its own flight. */
  let running = false
  let state = derive()

  function derive(): QuickActionSessionState {
    const gate =
      flight !== undefined
        ? ('sending' as const)
        : observed === undefined
          ? ('composer-busy' as const)
          : composerGate(observed.input, observed.session, observed.block)
    return {
      unavailable: gate,
      confirming,
      sending: flight !== undefined,
      activeRef: flight?.ref,
      feedback,
    }
  }

  function publish(): void {
    if (disposed) return
    const next = derive()
    if (
      next.unavailable === state.unavailable &&
      next.confirming === state.confirming &&
      next.sending === state.sending &&
      next.activeRef === state.activeRef &&
      next.feedback === state.feedback
    ) {
      return
    }
    state = next
    for (const listener of Array.from(listeners)) listener()
  }

  /** End the flight, optionally reporting why. */
  function settle(next: QuickActionFeedback | undefined): void {
    flight = undefined
    confirming = undefined
    identity = undefined
    feedback = next
    publish()
  }

  /** The action as the current Composer projection carries it, if it still does. */
  function shownAction(ref: QuickActionRef): ProjectedQuickAction | undefined {
    const key = quickActionRefKey(ref)
    const found = composer.find((action) => quickActionRefKey(action.ref) === key)
    return found === undefined || found.hidden ? undefined : found
  }

  /** Re-read everything spec 9.3 lists, immediately before the draft is touched. */
  function reverify(ref: QuickActionRef): ProjectedQuickAction | undefined {
    const found = shownAction(ref)
    if (found === undefined) return undefined
    if (identity !== undefined && identityOf(found) !== identity) return undefined
    if (observed === undefined || observed.session.sessionId !== sessionId) return undefined
    if (composerGate(observed.input, observed.session, observed.block) !== undefined) return undefined
    return found
  }

  /**
   * Load the static text and hand it to the official submit path (spec 9.4).
   * The two calls are the whole write side of this feature; everything before
   * them is verification and everything after is observation.
   */
  function run(action: ProjectedQuickAction): void {
    const face = actions
    if (face === undefined || observed === undefined) {
      settle({ kind: 'state-changed' })
      return
    }
    running = true
    try {
      try {
        face.setDraft(action.text)
      } catch (error) {
        // Nothing reached the draft, so the user's own content — an empty draft
        // at this point — is intact and the action may simply be retried.
        settle({ kind: 'failed', message: messageOf(error) })
        return
      }
      flight = { stage: 'submitted', ref: action.ref }
      confirming = undefined
      try {
        face.submit()
      } catch (error) {
        // The text is loaded but no submission started. Spec 9.5: keep it exactly
        // as loaded, say so, and never retry on the user's behalf.
        void error
        settle({ kind: 'retained' })
        return
      }
    } finally {
      running = false
    }
    publish()
  }

  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    observe(input, session, block) {
      if (disposed) return
      observed = { input, session, block }
      // Publications made by this feature's own two calls carry no verdict: the
      // machine's answer is read on the next commit of the owning entry.
      if (running) return

      if (flight?.stage === 'submitted') {
        if (input.phase === 'adjudicating' || input.phase === 'submitting') {
          flight = { stage: 'official', ref: flight.ref }
          confirming = undefined
          feedback = undefined
        } else if (input.draft === '') {
          // The official optimistic commit cleared the load: accepted. The local
          // message echo is the success feedback (spec 9.5).
          settle(undefined)
        } else {
          settle({ kind: 'retained' })
        }
      } else if (flight?.stage === 'official' && input.phase !== 'adjudicating' && input.phase !== 'submitting') {
        // The frozen slot was released: the official stage this submission
        // entered has ended, and whatever it produced is DSH's to report.
        settle(undefined)
      }

      publish()
    },

    bind(face, projection) {
      if (disposed) return
      actions = face
      composer = projection
      // An action deleted or hidden while its confirmation is open cancels that
      // confirmation outright, with no side effect (spec 9.3). A *rewritten*
      // definition deliberately does not: spec 9.3 treats that as a change the
      // user is told about, so the panel stays and the confirmation refuses.
      if (confirming !== undefined && shownAction(confirming.ref) === undefined) settle(undefined)
      publish()
    },

    activate(action) {
      if (disposed) return
      // The mutex, claimed before anything else can observe an empty draft.
      if (flight !== undefined) return
      if (observed === undefined || observed.session.sessionId !== sessionId) {
        settle({ kind: 'state-changed' })
        return
      }
      if (
        shownAction(action.ref) === undefined ||
        composerGate(observed.input, observed.session, observed.block) !== undefined
      ) {
        settle({ kind: 'state-changed' })
        return
      }

      identity = identityOf(action)
      feedback = undefined
      flight = { stage: 'pending', ref: action.ref }
      if (action.confirm) {
        confirming = {
          ref: action.ref,
          label: action.label,
          text: action.text,
          command: action.command,
        }
        publish()
        return
      }
      // A confirmation-free action still re-reads everything immediately before
      // the draft is touched (spec 9.3); `run` is reached with the same
      // guarantees the confirmed path has.
      const fresh = reverify(action.ref)
      if (fresh === undefined) {
        settle({ kind: 'state-changed' })
        return
      }
      run(fresh)
    },

    confirm() {
      if (disposed || flight?.stage !== 'pending' || confirming === undefined) return
      const fresh = reverify(flight.ref)
      if (fresh === undefined) {
        settle({ kind: 'state-changed' })
        return
      }
      run(fresh)
    },

    cancel() {
      if (disposed || flight?.stage !== 'pending' || confirming === undefined) return
      // Cancelling never touched the draft, so there is nothing to undo.
      settle(undefined)
    },

    dismissFeedback() {
      if (disposed || feedback === undefined) return
      feedback = undefined
      publish()
    },

    cancelPending() {
      if (disposed || flight === undefined) return
      if (flight.stage !== 'pending') return
      settle(undefined)
    },

    dispose() {
      disposed = true
      listeners.clear()
      actions = undefined
      observed = undefined
      composer = []
    },
  }
}

/**
 * The fiber-owned registry of per-Session engines.
 *
 * The engine is looked up by Session id rather than constructed by the surface,
 * which is what keeps one lock per Session across a layout switch: the ribbon
 * unmounts as the bar mounts, and the engine in between is the same object
 * (spec 7.2). Engines live until the Client fiber unloads; each one is a handful
 * of fields, and tying their lifetime to the fiber avoids a reference count that
 * a double-invoked render could get wrong.
 */
export interface QuickActionSessionRegistry {
  /** This Session's engine, created on first use. */
  engineFor(sessionId: string): QuickActionSessionEngine
  /** Release every engine — the Client fiber's own disposer. */
  dispose(): void
}

export function createQuickActionSessionRegistry(): QuickActionSessionRegistry {
  const engines = new Map<string, QuickActionSessionEngine>()

  return {
    engineFor(sessionId) {
      let engine = engines.get(sessionId)
      if (engine === undefined) {
        engine = createQuickActionSessionEngine(sessionId)
        engines.set(sessionId, engine)
      }
      return engine
    },
    dispose() {
      for (const engine of engines.values()) {
        engine.cancelPending()
        engine.dispose()
      }
      engines.clear()
    },
  }
}
