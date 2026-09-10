/**
 * The DSH Client faces the Composer surfaces and the per-session execution layer
 * consume, declared structurally and no wider than this plugin actually reads.
 *
 * Every shape here is transcribed from a published declaration of the target
 * DSH release (0.1.5-rc.1) rather than guessed:
 *
 * - `InputState`, `InputActions`, `Occurrence`
 *   → `@deepseek-ai/dsh-client-ui-conversation/lib/types/client/contract/input.d.ts`
 * - `SessionSnapshot`
 *   → `@deepseek-ai/dsh-api-session-controller/lib/types/client/contract/snapshot.d.ts`
 * - the two dock Slot contracts and their standard props
 *   → `@deepseek-ai/dsh-client-ui-conversation/lib/types/client/contract/slots.d.ts`
 *     and the generated Slot ledger in `@deepseek-ai/dsh-cordis-client-runner`
 * - `ComposerBlock` / `ComposerBlocks`
 *   → `@deepseek-ai/dsh-client-ui-conversation/lib/types/client/contract/composer-blocks.d.ts`
 * - `slots.inject` / `slots.register` and `locale.register` / `locale.bind`
 *   → the generated Service ledger in `@deepseek-ai/dsh-cordis-client-runner`
 *
 * They are declared here instead of imported because the plugin ships against a
 * DSH it does not depend on at build time: the Client bundle may only `require`
 * specifiers the build adapter lists as externals (`react` and
 * `react/jsx-runtime`), and every DSH face arrives as a Slot prop or a Cordis
 * service on `ctx`. Declaring them narrowly also keeps the compiler honest about
 * spec 9.1: nothing outside these shapes is reachable, so no DOM, Lexical,
 * private shell, private event or private keyboard path can be typed into
 * existence by accident.
 */
import type { ComponentType, ReactNode } from 'react'

export type { ComponentType }

// ---------------------------------------------------------------------------
// Input machine (the public currency)
// ---------------------------------------------------------------------------

/** Browser-runtime identity of one unsent attachment draft. */
export type DraftAttachmentId = string

/**
 * One reference occurrence projected from the editor's chip nodes. Only the
 * fields this plugin reads are declared; an occurrence's presence is what
 * matters here, never its content.
 */
export interface InputOccurrence {
  readonly occurrenceId: number
  readonly source: string
  readonly ref: string
}

/** One row of the read-only transient queue projection. */
export interface InputQueueRow {
  readonly placement: 'queued' | 'steering' | 'context'
}

/**
 * The published per-Session input state — the whole public snapshot, listed
 * field by field because spec 9.5 makes this exact set the only evidence the
 * send single-flight may be judged from.
 */
export interface InputState {
  /** Clipboard-text projection of the editor document (chips expanded). */
  readonly draft: string
  /** Ordered runtime-only attachment ids. */
  readonly attachmentIds: readonly DraftAttachmentId[]
  /** Monotonic editor revision; bumps once per content-changing editor commit. */
  readonly draftRev: number
  /** Submit-plane phase; `plain` is the only phase that accepts a new submission. */
  readonly phase: 'plain' | 'adjudicating' | 'claimed' | 'submitting'
  /** Present exactly while claimed/submitting. */
  readonly claim?: {
    readonly token: string
    readonly hint?: string
    readonly attachments?: boolean
  }
  /** Reference chips currently in the draft, sorted by offset. */
  readonly occurrences: readonly InputOccurrence[]
  /** Read-only transient inbox projection from Session control. */
  readonly queue: readonly InputQueueRow[]
}

/**
 * The public input action face handed to every session-scope Slot component.
 *
 * Only the two members spec 9.4 allows are declared. The shipped object also
 * carries `addAttachments`, `removeAttachment` and `pruneAttachments`; leaving
 * them out is deliberate — this plugin owns no draft attachment and must never
 * touch one.
 */
export interface InputActions {
  /** Replace the whole draft. */
  setDraft(text: string): void
  /** Enter submission: the same official path the composer's send button takes. */
  submit(): void
}

// ---------------------------------------------------------------------------
// Session snapshot
// ---------------------------------------------------------------------------

/** The Session lifecycle fields the composer's own send guard reads. */
export interface SessionSnapshot {
  readonly sessionId: string
  readonly removed: boolean
  readonly running: boolean
  readonly subagent: {
    readonly address: { readonly mode: string }
    readonly parentAvailable?: boolean
  } | null
}

// ---------------------------------------------------------------------------
// Composer blocks
// ---------------------------------------------------------------------------

/** Why one session's composer is inert (a feature-owned block). */
export interface ComposerBlock {
  readonly reason: string
}

/** An observable value as the DSH stores publish it. */
export interface ObservableSnapshot<T> {
  getSnapshot(): T
  subscribe(listener: () => void): () => void
}

/**
 * `ctx.conversation.blocks` — documented as "the registry face other plugins
 * reach": how a plugin the composer cannot import makes a session's input
 * inert. Reading it is the only public way to honour the `blocked` guard of
 * spec 9.2. The Client reaches it through `ctx.get`, the documented read
 * "without the inject requirement", so the declared dependency list stays
 * exactly the four of spec 7.3, and degrades to "not blocked" when absent.
 */
export interface ComposerBlocks {
  storeFor(sessionId: string): ObservableSnapshot<ComposerBlock | undefined>
}

/** The narrow slice of `ctx.conversation` this plugin reads. */
export interface ConversationLike {
  readonly blocks: ComposerBlocks
}

// ---------------------------------------------------------------------------
// Slot machinery
// ---------------------------------------------------------------------------

/** `SnapshotSelectorHook<T>`: a `useSyncExternalStoreWithSelector` binding. */
export type SnapshotSelectorHook<T> = <S>(
  selector: (value: T) => S,
  equality?: (a: S, b: S) => boolean,
) => S

/** Point-in-time owner values of `conversation.input.dock`. */
export interface InputZoneOwnerProps {
  readonly session: SessionSnapshot
  readonly input: InputState
}

/** Translation function bound to one locale namespace. */
export type Translate = (key: string, params?: Record<string, string | number>) => string

/** The standard props both dock Slots hand every session-scoped entry. */
export interface SessionSlotProps {
  readonly sessionId: string
  readonly useSession: SnapshotSelectorHook<SessionSnapshot>
  readonly useInput: SnapshotSelectorHook<InputState>
  readonly inputActions: InputActions
  readonly t: Translate
}

/** Props of the `conversation.input.dock` entry (standard props plus the zone). */
export type InputDockProps = SessionSlotProps & InputZoneOwnerProps

/** Props of the `conversation.composer.dock` entry (this Slot declares no owner props). */
export type ComposerDockProps = SessionSlotProps

/** Registration options both dock Slots accept. */
export interface SlotRegisterOptions {
  readonly name: 'conversation.input.dock' | 'conversation.composer.dock'
  /** Cell key; a fresh id is added beside the shipped entries. */
  readonly id: string
  /** Position among the entries, ascending. */
  readonly order?: number
  /** Locale namespace backing the entry's `t` prop. */
  readonly locale?: string
}

/** One synchronous effect installed while an injected Slot declaration is live. */
export type SlotInjectionEffect = (() => void) | Iterable<() => void>

/** `ctx.slots`, narrowed to the two calls this plugin makes. */
export interface SlotsService {
  /**
   * Install an effect for each declaration lifetime of a Slot. The controller
   * belongs to the caller's fiber, so plugin unload removes the contribution.
   */
  inject(key: string, callback: () => SlotInjectionEffect): () => void
  /** Register one entry; disposal runs through the caller's `ctx.effect`. */
  register(options: SlotRegisterOptions, component: ComponentType<never>): () => void
}

/** `ctx.locale`, narrowed to dictionary registration and namespace binding. */
export interface LocaleService {
  register(ns: string, dictionaries: Record<string, Record<string, string>>): () => void
  bind(ns: string): Translate
}

/** A React element, kept as a type alias so surfaces need no React value import. */
export type SurfaceNode = ReactNode
