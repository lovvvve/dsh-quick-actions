/**
 * The Client's single owner of authoritative Quick Action state (spec 7.1).
 *
 * It binds the two Settings namespaces the Host registers — the read-only
 * catalog namespace, read off its composition `base` layer, and the user-state
 * namespace — derives the projection every surface renders, and serializes
 * revision-fenced writes back through the same scope.
 *
 * What it deliberately does not own:
 *
 * - **Validation and migration authority.** The Host owns both (spec 6.3). Every
 *   rule applied here comes from the shared model, and a snapshot is decoded
 *   defensively rather than repaired: this face never rewrites before validating,
 *   never writes a file, and never treats browser storage as a source of truth.
 * - **Anything session-scoped.** No Session, InputState, Slot props or
 *   `InputActions` object reaches this module — long-lived global state must not
 *   pin a session's runtime objects (spec 7.1). Draft occupancy, confirmation and
 *   send single-flight belong to the per-session execution layer (spec 7.2).
 * - **Its own copy of the settings document.** Both bindings derive from the one
 *   browser-side describe mirror, so the catalog costs no read of its own and
 *   refreshes with that mirror after a reconnect (spec 17.3).
 */
import {
  DEFAULT_QUICK_ACTION_SETTINGS,
  QUICK_ACTIONS_CATALOG_NAMESPACE,
  QUICK_ACTIONS_SETTINGS_NAMESPACE,
  decodeCatalogSnapshot,
  decodeQuickActionSettings,
  deepEqualJson,
  normalizeQuickActionSettings,
  planClonePresetQuickAction,
  planCreateCustomQuickAction,
  planDeleteCustomQuickAction,
  planMoveQuickAction,
  planReorderQuickActions,
  planSetCustomQuickActionEnabled,
  planSetPresetQuickActionHidden,
  planSetQuickActionLayout,
  planUpdateCustomQuickAction,
  projectQuickActions,
} from '../model/index.js'
import type {
  CustomActionId,
  PresetActionId,
  PresetCatalog,
  QuickActionDraft,
  QuickActionLayout,
  QuickActionMutationContext,
  QuickActionMutationOutcome,
  QuickActionMutationRejection,
  QuickActionProjection,
  QuickActionRef,
  QuickActionSettingsV1,
} from '../model/index.js'

// ---------------------------------------------------------------------------
// The DSH faces this module consumes
//
// Declared structurally, and only as wide as this controller actually reads, so
// the behaviour above is testable against a controlled transport. The shipped
// `ctx.settingsScope` and `ctx.connection` satisfy them as-is.
// ---------------------------------------------------------------------------

/**
 * One path-addressed edit inside a namespace section. The transport also accepts
 * an `unset` form; this plugin writes the whole section field by field and never
 * clears one, so only the form it submits is declared.
 */
export interface SettingsSetOp {
  readonly op: 'set'
  readonly path: readonly string[]
  readonly value: unknown
}

/** One bound namespace as the scope publishes it. */
export interface SettingsScopeSnapshot {
  /** `loading` until the shared document answers; `unavailable` when the namespace is not served. */
  readonly status: 'loading' | 'ready' | 'unavailable'
  /** Resolved section: schema defaults, then composition base, then the user layer. */
  readonly value?: unknown
  /** Composition base layer, where an author-owned layer such as the catalog rides. */
  readonly base?: unknown
  /** Revision of the raw user section, sent back to fence a write. */
  readonly revision?: number
  /** Whether the provider accepts writes at all. */
  readonly writable: boolean
  /** `memory` on a page this Client keeps process-local; no write ever crosses the wire. */
  readonly mode: 'host' | 'memory'
}

/** The namespace contract handed to `bind`. */
export interface SettingsScopeSpec {
  readonly namespace: string
  /** Narrows the resolved value; returning `undefined` publishes no value at all. */
  readonly decode?: (value: unknown) => unknown
}

/** One namespace scope: a derived read plus that namespace's serialized writes. */
export interface BoundSettingsScope {
  getSnapshot(): SettingsScopeSnapshot
  subscribe(listener: () => void): () => void
  mutate(ops: readonly SettingsSetOp[], expectedRevision?: number): Promise<void>
}

/** The shared settings document as the mirror holds it. */
export interface SettingsMirrorSnapshot {
  /** Whether any document answer is held at all; absent while no read has succeeded. */
  readonly view?: unknown
  /** The last read's failure message, or `null` when it answered. */
  readonly error: string | null
}

/**
 * The shared describe mirror's read face. A bound scope publishes nothing at all
 * while the document is unanswered, so a read that *failed* is only visible here
 * — which is what tells a first catalog read failure apart from one still in
 * flight (spec 10).
 */
export interface SettingsMirror {
  getSnapshot(): SettingsMirrorSnapshot
  subscribe(listener: () => void): () => void
  load(): Promise<void>
}

/** `ctx.settingsScope`. */
export interface SettingsScopeService {
  bind(spec: SettingsScopeSpec): BoundSettingsScope
  describe(): SettingsMirror
}

/** Connection lifecycle as `ctx.connection` publishes it; `undefined` before the loop starts. */
export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | undefined

/** `ctx.connection`, narrowed to the observable state this controller reads. */
export interface ConnectionLike {
  readonly state: {
    getSnapshot(): ConnectionState
    subscribe(listener: () => void): () => void
  }
}

// ---------------------------------------------------------------------------
// Published state
// ---------------------------------------------------------------------------

/** Why the authoritative catalog cannot be shown (spec 10). */
export type CatalogErrorReason =
  /** The settings document could not be read at all; retrying is the remedy. */
  | 'unreadable'
  /** The Host serves no catalog namespace, or published no `base` layer on it. */
  | 'unavailable'
  /** A `base` layer this release cannot read in full; never a truncated catalog (spec 5.1). */
  | 'undecodable'

/** The authoritative Preset Catalog as the Client currently knows it. */
export type CatalogState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly catalog: PresetCatalog }
  | { readonly status: 'error'; readonly reason: CatalogErrorReason }

/** The last Host-confirmed user state, and the fence a write against it must carry. */
export type SettingsState =
  | { readonly status: 'loading' }
  /** No namespace to read or write: unserved, or a page kept process-local. */
  | { readonly status: 'unavailable' }
  | {
      readonly status: 'ready'
      readonly settings: QuickActionSettingsV1
      readonly revision: number
      readonly writable: boolean
    }

/** Why a write did not reach the stored state. */
export type QuickActionWriteFailure =
  /** No catalog or no readable namespace yet, or the controller is disposed. */
  | { readonly kind: 'not-ready' }
  /** The provider accepts no writes, or the connection is not current (spec 10). */
  | { readonly kind: 'read-only' }
  /** The shared model refused the plan; nothing crossed the wire. */
  | { readonly kind: 'rejected'; readonly rejection: QuickActionMutationRejection }
  /** The Host refused the write itself; the authoritative snapshot was re-read. */
  | { readonly kind: 'refused' }
  /** The revision fence was lost: refresh, then ask the user to confirm again (spec 10). */
  | { readonly kind: 'conflict' }
  /** The write never settled against the Host. Never retried automatically. */
  | { readonly kind: 'failed'; readonly message: string }

/**
 * The structured result every mutation answers with (spec 15, decision 4).
 *
 * The shipped `SettingsScope.mutate` resolves to `void`, and this release adds no
 * DSH core interface (spec 16.4), so success, refusal and conflict are told apart
 * here, from the authoritative snapshot the scope publishes after the write: the
 * write committed when the stored state now reads back as the plan, the fence was
 * lost when the namespace revision moved elsewhere, and anything else is a Host
 * refusal. Each failing case leaves the caller's form content untouched — the
 * caller owns the draft — and the recovery read has already happened by the time
 * this resolves.
 */
export type QuickActionWriteOutcome =
  | { readonly ok: true; readonly changed: boolean }
  | { readonly ok: false; readonly failure: QuickActionWriteFailure }

/** The global management panel's own state (spec 7.1). */
export interface QuickActionManagerState {
  readonly open: boolean
}

/** Everything the Quick Action surfaces render from. */
export interface QuickActionsClientState {
  readonly catalog: CatalogState
  readonly settings: SettingsState
  /**
   * What the surfaces list, or `undefined` while no catalog is readable. With a
   * catalog but no readable user state it projects the defaults, so the
   * authoritative presets still render while management stays read-only (spec 10).
   */
  readonly projection: QuickActionProjection | undefined
  /** Whether any write may be attempted right now. */
  readonly readOnly: boolean
  /** The connection is not current, so the held snapshot may have moved on (spec 10). */
  readonly stale: boolean
  readonly manager: QuickActionManagerState
  /** A write is in flight; the panel disables its controls rather than queueing clicks. */
  readonly writing: boolean
  /** The last failure, until it is dismissed or superseded by the next write. */
  readonly failure?: QuickActionWriteFailure
}

/** The controller as the surfaces consume it. */
export interface QuickActionsController {
  /** Current state; the same reference until something actually changes. */
  getSnapshot(): QuickActionsClientState
  subscribe(listener: () => void): () => void
  /** Re-read the shared settings document — the retry behind a catalog error (spec 10). */
  refresh(): Promise<void>
  openManager(): void
  closeManager(): void
  dismissFailure(): void
  createCustomAction(draft: QuickActionDraft): Promise<QuickActionWriteOutcome>
  clonePreset(presetId: PresetActionId): Promise<QuickActionWriteOutcome>
  updateCustomAction(id: CustomActionId, draft: QuickActionDraft): Promise<QuickActionWriteOutcome>
  setCustomActionEnabled(id: CustomActionId, enabled: boolean): Promise<QuickActionWriteOutcome>
  deleteCustomAction(id: CustomActionId): Promise<QuickActionWriteOutcome>
  setPresetHidden(presetId: PresetActionId, hidden: boolean): Promise<QuickActionWriteOutcome>
  reorderActions(order: readonly QuickActionRef[]): Promise<QuickActionWriteOutcome>
  moveAction(ref: QuickActionRef, toIndex: number): Promise<QuickActionWriteOutcome>
  setLayout(layout: QuickActionLayout): Promise<QuickActionWriteOutcome>
  /** Release the scope subscriptions and the connection listener. */
  dispose(): void
}

/** What the controller is built over. */
export interface QuickActionsControllerOptions {
  readonly settingsScope: SettingsScopeService
  readonly connection: ConnectionLike
  /** Mints one Custom Action ID. Defaults to `crypto.randomUUID()`. */
  readonly mintCustomActionId?: () => string
}

/**
 * How many Custom Action IDs a create or clone tries before giving up.
 * Normalization must never renumber a stored id (spec 4.1), so the planner
 * refuses a taken id and the controller mints another rather than overwriting
 * anything; exhausting the attempts surfaces the refusal instead of hiding it.
 */
const ID_MINT_ATTEMPTS = 4

/** The five top-level fields of the persisted section (spec 4.2). */
function sectionOps(next: QuickActionSettingsV1): readonly SettingsSetOp[] {
  return [
    { op: 'set', path: ['schemaVersion'], value: next.schemaVersion },
    { op: 'set', path: ['layout'], value: next.layout },
    { op: 'set', path: ['userActionsById'], value: next.userActionsById },
    { op: 'set', path: ['actionOrder'], value: next.actionOrder },
    { op: 'set', path: ['presetStateById'], value: next.presetStateById },
  ]
}

/**
 * Read the catalog off a bound namespace.
 *
 * `base` is read, never `value`: `base` is the author's own layer, so a user who
 * hand-writes a section of that name into the settings document still sees the
 * Host's catalog (spec 17.2).
 */
function readCatalog(snapshot: SettingsScopeSnapshot, document: SettingsMirrorSnapshot): CatalogState {
  if (snapshot.status === 'loading') {
    // No namespace answer yet. A held document means the read succeeded and the
    // namespace simply is not served; no document plus a reported error means the
    // read itself failed, which is the retryable catalog error of spec 10.
    if (document.view !== undefined) return { status: 'error', reason: 'unavailable' }
    return document.error === null ? { status: 'loading' } : { status: 'error', reason: 'unreadable' }
  }
  if (snapshot.status === 'unavailable' || snapshot.base === undefined) {
    return { status: 'error', reason: 'unavailable' }
  }
  const catalog = decodeCatalogSnapshot(snapshot.base)
  if (catalog === undefined) return { status: 'error', reason: 'undecodable' }
  return { status: 'ready', catalog }
}

/**
 * Read the confirmed user state off a bound namespace.
 *
 * Decoded, not canonicalized: canonicalization is catalog-relative, and whether
 * a namespace is readable has nothing to do with whether the catalog is. Every
 * consumer that needs the canonical form — the projection, each planner, the
 * post-write comparison — derives it against the catalog it already holds.
 */
function readSettings(snapshot: SettingsScopeSnapshot): SettingsState {
  if (snapshot.status === 'loading') return { status: 'loading' }
  if (snapshot.status === 'unavailable' || snapshot.revision === undefined) return { status: 'unavailable' }
  return {
    status: 'ready',
    settings: decodeQuickActionSettings(snapshot.value),
    revision: snapshot.revision,
    writable: snapshot.writable,
  }
}

/**
 * Either the everything one write needs, or the reason no write may be attempted.
 * One gate so the surfaces' read-only state and a write's refusal can never
 * disagree about why (spec 10).
 */
type WriteGate =
  | {
      readonly ok: true
      readonly context: QuickActionMutationContext
      readonly catalog: PresetCatalog
      readonly revision: number
    }
  | { readonly ok: false; readonly failure: QuickActionWriteFailure }

function writeGate(catalog: CatalogState, settings: SettingsState, stale: boolean): WriteGate {
  if (catalog.status !== 'ready' || settings.status !== 'ready') {
    return { ok: false, failure: { kind: 'not-ready' } }
  }
  // A held snapshot the connection can no longer vouch for is served read-only:
  // it may still be executed against, but never written back over (spec 10).
  if (!settings.writable || stale) return { ok: false, failure: { kind: 'read-only' } }
  return {
    ok: true,
    context: {
      settings: settings.settings,
      catalog: catalog.catalog,
      revision: String(settings.revision),
    },
    catalog: catalog.catalog,
    revision: settings.revision,
  }
}

/**
 * Create the controller. Both bindings are made on the calling fiber, so the
 * scope disposers the binder registers are withdrawn with it; `dispose()`
 * releases what this module owns on top of that.
 */
export function createQuickActionsController(
  options: QuickActionsControllerOptions,
): QuickActionsController {
  const mintId = options.mintCustomActionId ?? (() => crypto.randomUUID())
  const catalogScope = options.settingsScope.bind({
    namespace: QUICK_ACTIONS_CATALOG_NAMESPACE,
    // The resolved value is passed through only so the scope reports readiness;
    // the catalog itself is read from `base`. `null` stands in for a namespace
    // that resolves to nothing, which would otherwise read as still loading.
    decode: (value) => value ?? null,
  })
  const settingsScope = options.settingsScope.bind({
    namespace: QUICK_ACTIONS_SETTINGS_NAMESPACE,
    // Decoding here rather than against the registered schema keeps the Client's
    // reading of a confirmed snapshot the shared model's, not the transport's.
    decode: (value) => decodeQuickActionSettings(value),
  })

  const mirror = options.settingsScope.describe()

  const listeners = new Set<() => void>()
  let disposed = false
  let manager: QuickActionManagerState = { open: false }
  let writing = 0
  let failure: QuickActionWriteFailure | undefined
  let connectionState: ConnectionState = options.connection.state.getSnapshot()
  let state = derive()

  /** Serializes this controller's own writes so each plan reads the previous one back. */
  let tail: Promise<unknown> = Promise.resolve()

  function derive(): QuickActionsClientState {
    const catalog = readCatalog(catalogScope.getSnapshot(), mirror.getSnapshot())
    const settings = readSettings(settingsScope.getSnapshot())
    const projection =
      catalog.status === 'ready'
        ? projectQuickActions(
            settings.status === 'ready' ? settings.settings : DEFAULT_QUICK_ACTION_SETTINGS,
            catalog.catalog,
          )
        : undefined
    const stale = connectionState !== undefined && connectionState !== 'connected'
    return {
      catalog,
      settings,
      projection,
      readOnly: !writeGate(catalog, settings, stale).ok,
      stale,
      manager,
      writing: writing > 0,
      ...(failure === undefined ? {} : { failure }),
    }
  }

  /** Republish only on a real change, so a subscriber never re-renders for nothing. */
  function publish(): void {
    if (disposed) return
    const next = derive()
    if (deepEqualJson(state, next)) return
    state = next
    // Snapshot: a listener may unsubscribe as it reacts to this very change.
    for (const listener of Array.from(listeners)) listener()
  }

  // The mirror is subscribed to as well as the two scopes: a failed document read
  // never reaches a scope snapshot, so it is only observable here.
  const stopSources = [mirror.subscribe(publish), catalogScope.subscribe(publish), settingsScope.subscribe(publish)]
  const stopConnection = options.connection.state.subscribe(() => {
    connectionState = options.connection.state.getSnapshot()
    publish()
  })

  /**
   * Run one planner, re-minting on a taken Custom Action ID. Only a planner that
   * mints can answer `id-in-use`, so this loop costs nothing for the others.
   */
  function plan(
    planner: (context: QuickActionMutationContext) => QuickActionMutationOutcome,
    context: QuickActionMutationContext,
  ): QuickActionMutationOutcome {
    let outcome = planner(context)
    for (let attempt = 1; attempt < ID_MINT_ATTEMPTS; attempt += 1) {
      if (outcome.ok || outcome.rejection.reason !== 'id-in-use') return outcome
      outcome = planner(context)
    }
    return outcome
  }

  /**
   * Classify one settled write against the snapshot the scope published for it.
   *
   * The stored state reading back as the plan is the only positive evidence of a
   * commit. Failing that, a namespace revision that moved elsewhere is a lost
   * fence and anything else is a Host refusal — with one bounded blind spot: if
   * the recovery read that follows a refusal also fails, a lost fence is
   * indistinguishable from a refusal and is reported as the latter. In that
   * window the connection is down, so the surfaces are already read-only, and
   * retrying against the stale fence is refused again rather than overwriting
   * the writer that won.
   */
  function classify(catalog: PresetCatalog, next: QuickActionSettingsV1, fence: number): QuickActionWriteOutcome {
    const snapshot = settingsScope.getSnapshot()
    const settings = readSettings(snapshot)
    if (
      settings.status === 'ready' &&
      deepEqualJson(normalizeQuickActionSettings(settings.settings, catalog), next)
    ) {
      return { ok: true, changed: true }
    }
    if (snapshot.revision !== fence) return { ok: false, failure: { kind: 'conflict' } }
    return { ok: false, failure: { kind: 'refused' } }
  }

  function settle(outcome: QuickActionWriteOutcome): QuickActionWriteOutcome {
    failure = outcome.ok ? undefined : outcome.failure
    return outcome
  }

  function submit(
    planner: (context: QuickActionMutationContext) => QuickActionMutationOutcome,
  ): Promise<QuickActionWriteOutcome> {
    if (disposed) return Promise.resolve({ ok: false, failure: { kind: 'not-ready' } })
    // Counted before the queue so a click is visibly in flight, not silently queued.
    writing += 1
    publish()
    const task = tail.then(async (): Promise<QuickActionWriteOutcome> => {
      if (disposed) return { ok: false, failure: { kind: 'not-ready' } }
      const gate = writeGate(state.catalog, state.settings, state.stale)
      if (!gate.ok) return settle(gate)
      try {
        const outcome = plan(planner, gate.context)
        if (!outcome.ok) return settle({ ok: false, failure: { kind: 'rejected', rejection: outcome.rejection } })
        // Nothing to persist is a success with no write: an unchanged plan must not
        // cost a round trip, and re-normalizing what is stored is not a change.
        if (!outcome.plan.changed) return settle({ ok: true, changed: false })

        await settingsScope.mutate(sectionOps(outcome.plan.next), gate.revision)
        return settle(classify(gate.catalog, outcome.plan.next, gate.revision))
      } catch (error) {
        // Either the plan could not be built or the write never settled against
        // the Host. Neither is replayed: a silent retry could submit a plan the
        // user has already moved past, and every write answers with an outcome
        // rather than rejecting into a click handler.
        //
        // The scope recovers by itself only when the Host *answered* a refusal,
        // so this branch owns the recovery read: whatever the surfaces render
        // next must come from the Host, not from a snapshot this write may have
        // already invalidated.
        await mirror.load().catch(() => undefined)
        return settle({ ok: false, failure: { kind: 'failed', message: messageOf(error) } })
      }
    })
    tail = task.catch(() => undefined)
    return task.finally(() => {
      writing -= 1
      publish()
    })
  }

  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    refresh: async () => {
      if (disposed) return
      await mirror.load()
    },
    openManager() {
      manager = { open: true }
      publish()
    },
    closeManager() {
      manager = { open: false }
      publish()
    },
    dismissFailure() {
      failure = undefined
      publish()
    },
    createCustomAction: (draft) =>
      submit((context) => planCreateCustomQuickAction(context, { id: mintId(), draft })),
    clonePreset: (presetId) =>
      submit((context) => planClonePresetQuickAction(context, { presetId, id: mintId() })),
    updateCustomAction: (id, draft) => submit((context) => planUpdateCustomQuickAction(context, { id, draft })),
    setCustomActionEnabled: (id, enabled) =>
      submit((context) => planSetCustomQuickActionEnabled(context, { id, enabled })),
    deleteCustomAction: (id) => submit((context) => planDeleteCustomQuickAction(context, { id })),
    setPresetHidden: (presetId, hidden) =>
      submit((context) => planSetPresetQuickActionHidden(context, { presetId, hidden })),
    reorderActions: (order) => submit((context) => planReorderQuickActions(context, { order })),
    moveAction: (ref, toIndex) => submit((context) => planMoveQuickAction(context, { ref, toIndex })),
    setLayout: (layout) => submit((context) => planSetQuickActionLayout(context, { layout })),
    /**
     * Release what this module owns. The two scope bindings are withdrawn by the
     * binder's own disposer on the fiber this controller was created on, so the
     * fiber and this call together leave nothing behind.
     */
    dispose() {
      disposed = true
      for (const stop of stopSources) stop()
      stopConnection()
      listeners.clear()
    },
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
