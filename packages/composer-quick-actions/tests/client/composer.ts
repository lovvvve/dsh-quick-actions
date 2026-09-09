/**
 * A controlled stand-in for one DSH Session's input machine.
 *
 * It reproduces the behaviours the Quick Action execution layer actually depends
 * on, transcribed from `@deepseek-ai/dsh-client-ui-conversation` 0.1.2-rc.1
 * (`lib/client.js`): the `SubmitMachine.onEnter` / `onAdjudicated` transitions,
 * `SessionInputShell.setDraft`'s identical-text no-op and single revision bump,
 * the `commit-draft` optimistic clear that follows an accepted ordinary send,
 * and the rule that every `submit()` which reaches the machine publishes a fresh
 * snapshot even when the machine refuses it.
 *
 * No real LLM, network, DOM or Lexical is involved: the tests drive the official
 * outcomes from here.
 */
import type { InputActions, InputState, SessionSnapshot } from '../../src/client/dsh.js'

const EMPTY: InputState = {
  draft: '',
  imageIds: [],
  draftRev: 0,
  phase: 'plain',
  occurrences: [],
  queue: [],
}

/** How an adjudicated `/` line settles (the `PickOutcome` arms that matter here). */
export type AdjudicationOutcome =
  /** No source claimed the line: it falls through to the ordinary default sink. */
  | 'default'
  /** A source claimed it: the machine enters `submitting` until the claim settles. */
  | 'claim'
  /** A source handled it outright: the phase returns to plain, draft retained. */
  | 'handled'

export class FakeComposerInput {
  private state: InputState = EMPTY
  private readonly listeners = new Set<() => void>()

  /** Texts the default sink accepted, in submission order — the duplicate-send ledger. */
  readonly sends: string[] = []

  /** Set to make the next `setDraft` throw synchronously. */
  failSetDraft = false
  /** Set to make the next `submit` throw synchronously. */
  failSubmit = false
  /**
   * Set to make the machine answer no effects, the way `onEnter` does when the
   * frozen slot is already held. The call still publishes a fresh snapshot.
   */
  refuseSubmit = false
  /**
   * Set to keep each ordinary send's default sink open instead of accepting it
   * at once — a connection with nothing behind it. The shipped machine has no
   * connection check anywhere on the `enter` path: `onEnter` answers
   * `default-sink` + `commit-draft` for any non-blank plain text, and the shell
   * runs both synchronously, so the draft is cleared *before* the sink can fail.
   * The failure arrives later, through {@link failHeldSinks}.
   */
  holdSink = false
  /** Texts whose sink is still open, in submission order. */
  private held: string[] = []

  /** The public action face a Slot entry receives. */
  readonly actions: InputActions = {
    setDraft: (text) => {
      this.setDraft(text)
    },
    submit: () => {
      this.submit()
    },
  }

  get snapshot(): InputState {
    return this.state
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  get listenerCount(): number {
    return this.listeners.size
  }

  /** Seed draft content the way a user typing would. */
  type(draft: string): void {
    this.patch({ draft, draftRev: this.state.draftRev + 1 })
  }

  /** Attach a draft image, so occupancy can be tested through every public field. */
  attachImage(id = 'image-1'): void {
    this.patch({ imageIds: [...this.state.imageIds, id] })
  }

  /** Insert a reference chip occurrence. */
  attachReference(): void {
    this.patch({ occurrences: [{ occurrenceId: 1, source: 'file', ref: 'a.ts' }] })
  }

  /** Put a message in the Session's transient inbox (never an occupancy signal). */
  enqueue(): void {
    this.patch({ queue: [{ placement: 'queued' }] })
  }

  private setDraft(text: string): void {
    if (this.failSetDraft) throw new Error('setDraft failed')
    // The shipped shell returns early when the sanitized text already matches.
    if (text === this.state.draft) return
    this.patch({ draft: text, draftRev: this.state.draftRev + 1 })
  }

  private submit(): void {
    if (this.failSubmit) throw new Error('submit failed')
    const draft = this.state.draft
    if (this.refuseSubmit || this.state.phase === 'adjudicating' || this.state.phase === 'submitting') {
      // `onEnter` answers no effects, and `run([])` still publishes.
      this.publish()
      return
    }
    const trimmed = draft.trim()
    if (trimmed === '') {
      this.publish()
      return
    }
    if (trimmed.startsWith('/')) {
      this.patch({ phase: 'adjudicating' })
      return
    }
    this.commit(trimmed)
  }

  /** Settle a `/` line the machine is adjudicating. */
  settleAdjudication(outcome: AdjudicationOutcome): void {
    if (this.state.phase !== 'adjudicating') throw new Error('fake composer: nothing is adjudicating')
    if (outcome === 'claim') {
      this.patch({ phase: 'submitting' })
      return
    }
    if (outcome === 'handled') {
      this.patch({ phase: 'plain' })
      return
    }
    this.patch({ phase: 'plain' })
    this.commit(this.state.draft.trim())
  }

  /** Settle a claimed command submission. */
  settleClaim(ok: boolean): void {
    if (this.state.phase !== 'submitting') throw new Error('fake composer: nothing is submitting')
    if (!ok) {
      this.patch({ phase: 'plain' })
      return
    }
    this.sends.push(this.state.draft.trim())
    this.patch({ phase: 'plain', draft: '', draftRev: this.state.draftRev + 1 })
  }

  /**
   * Every held sink rejects — the shell's `settleDetachedFailure` for each:
   * nothing was sent, and `restoreFailedDrafts` rebuilds the failed texts into
   * the draft in submission order, a blank line apart. The shipped shell also
   * raises its own error notice here; that notice is DSH's, and the plugin
   * neither sees nor duplicates it (spec 9.5).
   *
   * Only the empty-draft case is modelled. The shipped shell restores into an
   * empty draft, or over a restoration of its own the user has not touched; a
   * user who typed something new before the failure keeps what they typed and
   * the failed records wait. A test that needs that branch has to model it
   * rather than lean on this one.
   */
  failHeldSinks(): void {
    const failed = this.held.splice(0)
    if (failed.length === 0) throw new Error('fake composer: no send is held')
    if (this.state.draft !== '') throw new Error('fake composer: restoring over a typed draft is not modelled')
    this.patch({ draft: failed.join('\n\n'), draftRev: this.state.draftRev + 1 })
  }

  /** The optimistic commit that follows an accepted ordinary send. */
  private commit(text: string): void {
    if (this.holdSink) this.held.push(text)
    else this.sends.push(text)
    this.patch({ draft: '', draftRev: this.state.draftRev + 1, imageIds: [], occurrences: [] })
  }

  private patch(next: Partial<InputState>): void {
    this.state = { ...this.state, ...next }
    this.publish()
  }

  private publish(): void {
    // `compose()` mints a new object on every publish, so subscribers are
    // notified even when nothing observable changed.
    this.state = { ...this.state }
    for (const listener of Array.from(this.listeners)) listener()
  }
}

/** A live, ordinary Session snapshot with the fields under test overridden. */
export function fakeSession(overrides: Partial<SessionSnapshot> = {}): SessionSnapshot {
  return {
    sessionId: 'session-1',
    removed: false,
    running: false,
    subagent: null,
    ...overrides,
  }
}
