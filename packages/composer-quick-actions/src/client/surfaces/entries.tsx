/**
 * The two dock Slot entries (spec 7.3, 8.1).
 *
 * Both are always registered; which one renders the layout is decided at render
 * time from the authoritative Settings snapshot, and both render nothing at all
 * unless the Resident Composer predicate holds for their Session:
 *
 * - `conversation.composer.dock` is the residency beacon. Its mount is DSH's own
 *   statement that this Session's composer is in its resident variant, so it
 *   marks the Session while mounted and additionally renders the `bar` layout.
 * - `conversation.input.dock` renders `ribbon` or `launcher`, but only while the
 *   beacon's mark stands — that Slot also mounts on the blank-session hero, and
 *   the first release must never appear there.
 *
 * Each entry carries its own error boundary, so a failure replaces the Quick
 * Action area alone.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useSyncExternalStore } from 'react'
import type { ReactElement } from 'react'
import { SurfaceErrorBoundary } from './ErrorBoundary.js'
import { QuickActionsSurface } from './QuickActionsSurface.js'
import type { ResidentComposerRegistry } from './residency.js'
import type { QuickActionSessionRegistry } from '../session/execution.js'
import type { QuickActionsClientState, QuickActionsController } from '../controller.js'
import type {
  ComposerBlock,
  ComposerBlocks,
  ComposerDockProps,
  InputDockProps,
  SessionSlotProps,
} from '../dsh.js'
import type { ProjectedQuickAction, QuickActionLayout } from '../../model/index.js'

/** Everything the Slot entries reach outside React. */
export interface QuickActionSurfaceDeps {
  readonly controller: QuickActionsController
  readonly sessions: QuickActionSessionRegistry
  readonly residency: ResidentComposerRegistry
  /**
   * Resolves `ctx.conversation.blocks`, the registry face documented as "how a
   * plugin the composer cannot import makes a session's input inert". It is the
   * only public reading of the `blocked` guard of spec 9.2, and it is reached
   * through `ctx.get`, which the Cordis reflection layer documents as a read
   * "without the inject requirement" — so the Client's declared dependencies
   * stay exactly the four of spec 7.3. Absent, the guard degrades to "not
   * blocked" rather than guessing from the DOM.
   */
  readonly blocks: () => ComposerBlocks | undefined
}

function useControllerState(controller: QuickActionsController): QuickActionsClientState {
  return useSyncExternalStore(
    useCallback((listener: () => void) => controller.subscribe(listener), [controller]),
    () => controller.getSnapshot(),
  )
}

function useResident(residency: ResidentComposerRegistry, sessionId: string): boolean {
  return useSyncExternalStore(
    useCallback((listener: () => void) => residency.subscribe(listener), [residency]),
    () => residency.isResident(sessionId),
  )
}

function useComposerBlock(blocks: () => ComposerBlocks | undefined, sessionId: string): ComposerBlock | undefined {
  const store = useMemo(() => blocks()?.storeFor(sessionId), [blocks, sessionId])
  return useSyncExternalStore(
    useCallback((listener: () => void) => store?.subscribe(listener) ?? (() => {}), [store]),
    () => store?.getSnapshot(),
  )
}

/**
 * The body both entries render once residency and the layout agree.
 *
 * It owns the Session's execution engine for as long as it is mounted: every
 * commit republishes the live `InputActions` and the live Composer projection
 * into it, and unmounting cancels whatever has not reached the official state
 * machine (spec 7.2).
 */
function SessionSurface(props: SessionSlotProps & { readonly deps: QuickActionSurfaceDeps; readonly layout: QuickActionLayout; readonly actions: readonly ProjectedQuickAction[] }): ReactElement {
  const { deps, layout, actions, sessionId, useInput, useSession, inputActions, t } = props
  const engine = useMemo(() => deps.sessions.engineFor(sessionId), [deps.sessions, sessionId])
  const input = useInput((state) => state)
  const session = useSession((state) => state)
  const block = useComposerBlock(deps.blocks, sessionId)

  // One layout effect with no dependency list: the engine is handed the state of
  // every commit, which is also the boundary its single-flight settlement reads.
  // Running before paint means the first frame already carries the real
  // availability, rather than flashing every control disabled for one frame.
  useLayoutEffect(() => {
    engine.bind(inputActions, actions)
    engine.observe(input, session, block)
  })

  useEffect(
    () => () => {
      engine.cancelPending()
    },
    [engine],
  )

  const state = useSyncExternalStore(
    useCallback((listener: () => void) => engine.subscribe(listener), [engine]),
    () => engine.getSnapshot(),
  )

  const onActivate = useCallback(
    (action: ProjectedQuickAction) => {
      engine.activate(action)
    },
    [engine],
  )

  return (
    <QuickActionsSurface
      layout={layout}
      actions={actions}
      session={state}
      t={t}
      onActivate={onActivate}
      onConfirm={() => {
        engine.confirm()
      }}
      onCancelConfirm={() => {
        engine.cancel()
      }}
      onDismissFeedback={() => {
        engine.dismissFeedback()
      }}
      onManage={() => {
        deps.controller.openManager()
      }}
    />
  )
}

/** The catalog error and loading states of spec 10, rendered where the layout would be. */
function CatalogNotice(props: {
  readonly client: QuickActionsClientState
  readonly t: SessionSlotProps['t']
  readonly onRetry: () => void
}): ReactElement | null {
  const { client, t, onRetry } = props
  if (client.catalog.status === 'loading') return null
  if (client.catalog.status === 'ready') return null
  return (
    <div className="dsh-cqa-note" role="status" data-quick-actions-catalog-error={client.catalog.reason}>
      <span className="dsh-cqa-note-text">{t(`catalog.${client.catalog.reason}`)}</span>
      <button type="button" className="dsh-cqa-link" onClick={onRetry}>
        {t('catalog.retry')}
      </button>
    </div>
  )
}

/** Build both Slot entry components over one set of fiber-owned dependencies. */
export function createQuickActionDockEntries(deps: QuickActionSurfaceDeps): {
  readonly InputDock: (props: InputDockProps) => ReactElement
  readonly ComposerDock: (props: ComposerDockProps) => ReactElement
} {
  function Body(props: SessionSlotProps & { readonly owns: readonly QuickActionLayout[] }): ReactElement | null {
    const { owns, ...slot } = props
    const client = useControllerState(deps.controller)
    const projection = client.projection
    const onRetry = useCallback(() => {
      void deps.controller.refresh()
    }, [])

    if (projection === undefined) {
      // No authoritative catalog: the layout is unknown, so only the retryable
      // catalog error may be shown, and only by the entry that owns the default.
      return owns.includes('ribbon') ? <CatalogNotice client={client} t={slot.t} onRetry={onRetry} /> : null
    }
    if (!owns.includes(projection.layout)) return null
    return (
      <SessionSurface
        {...slot}
        deps={deps}
        layout={projection.layout}
        actions={projection.composer}
      />
    )
  }

  function InputDock(props: InputDockProps): ReactElement {
    const resident = useResident(deps.residency, props.sessionId)
    return (
      <SurfaceErrorBoundary t={props.t}>
        {resident ? <Body {...props} owns={INPUT_DOCK_LAYOUTS} /> : null}
      </SurfaceErrorBoundary>
    )
  }

  function ComposerDock(props: ComposerDockProps): ReactElement {
    const { sessionId } = props
    // The beacon. A layout effect, so the mark lands — and the input dock's own
    // re-render lands with it — before the browser paints this commit: a hero
    // that becomes resident brings the ribbon up in the same frame, not the next.
    // The effect's own cleanup withdraws it, so a remount re-adds it.
    useLayoutEffect(() => deps.residency.mark(sessionId), [sessionId])

    return (
      <SurfaceErrorBoundary t={props.t}>
        <Body {...props} owns={COMPOSER_DOCK_LAYOUTS} />
      </SurfaceErrorBoundary>
    )
  }

  return { InputDock, ComposerDock }
}

/** `ribbon` and `launcher` render above the composer card (spec 8.1). */
const INPUT_DOCK_LAYOUTS: readonly QuickActionLayout[] = ['ribbon', 'launcher']
/** `bar` renders below it. */
const COMPOSER_DOCK_LAYOUTS: readonly QuickActionLayout[] = ['bar']
