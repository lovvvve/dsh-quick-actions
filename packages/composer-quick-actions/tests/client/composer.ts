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

  /** The optimistic commit that follows an accepted ordinary send. */
  private commit(text: string): void {
    this.sends.push(text)
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
