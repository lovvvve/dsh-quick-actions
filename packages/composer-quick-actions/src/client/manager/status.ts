/**
 * How the management panel names the state it is in (spec 10).
 *
 * Both readings are pure functions over the snapshot the controller publishes,
 * kept beside the panel rather than inside it — the same split the surfaces use
 * for `layout.ts` and the action panel for `search.ts`.
 */
import { quickActionsLocaleKey } from '../../locales/index.js'
import type { QuickActionsClientState, QuickActionWriteFailure } from '../controller.js'
import type { Translate } from '../dsh.js'

/** Why every write is refused right now, or `undefined` when none is. */
export type ManagerReadOnlyReason =
  /** The connection cannot vouch for the held snapshot, so it must not be written over. */
  | 'offline'
  /** No writable namespace: an unreadable first read, or a process-local page. */
  | 'storage'

/**
 * Report read-only state, and only read-only state.
 *
 * Spec 10 keeps two first-read failures apart: a catalog that could not be read
 * shows a retryable catalog error, while a *readable* catalog whose user
 * namespace failed shows "storage unavailable". Without the projection guard
 * below, a loading or failed catalog also reads as read-only — the write gate
 * refuses on `not-ready` — and the panel would print both notices at once,
 * telling the user their storage is broken when it is the catalog that is
 * missing. With no catalog there is nothing to be read-only *about*: the catalog
 * notice is the whole story.
 */
export function managerReadOnlyReason(client: QuickActionsClientState): ManagerReadOnlyReason | undefined {
  if (client.projection === undefined) return undefined
  if (!client.readOnly) return undefined
  // Staleness is reported first: it is the one the user can act on, and it also
  // explains why an otherwise writable namespace is refusing writes.
  return client.stale ? 'offline' : 'storage'
}

/** One write failure as a sentence, with the recovery it implies (spec 10). */
export function managerFailureMessage(failure: QuickActionWriteFailure, t: Translate): string {
  if (failure.kind === 'failed') return t('write.failed', { message: failure.message })
  const candidate = failure.kind === 'rejected' ? `write.${failure.rejection.reason}` : `write.${failure.kind}`
  return t(quickActionsLocaleKey(candidate, 'write.refused'))
}
