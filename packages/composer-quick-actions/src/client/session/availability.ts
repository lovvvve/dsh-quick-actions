/**
 * Which control one Quick Action renders as, given its Session's execution
 * state (spec 3, 9.2).
 *
 * Shared by every surface that offers an action for execution — the three
 * layouts and the shared searchable action panel — so a control cannot explain
 * itself one way in the ribbon and another way behind "more".
 */
import type { QuickActionSessionState } from './execution.js'
import type { QuickActionUnavailableReason } from './guards.js'
import { quickActionRefKey } from '../../model/index.js'
import type { ProjectedQuickAction } from '../../model/index.js'

/**
 * The reason this action cannot run right now, or `undefined` when it can.
 *
 * While a send holds the Session's single flight, only the action holding it
 * explains itself as "sending"; the rest are simply unavailable while the
 * Composer is busy with it (spec 9.5).
 */
export function unavailableReasonFor(
  action: ProjectedQuickAction,
  session: QuickActionSessionState,
): QuickActionUnavailableReason | undefined {
  if (session.unavailable === 'sending') {
    return session.activeRef !== undefined && quickActionRefKey(session.activeRef) === quickActionRefKey(action.ref)
      ? 'sending'
      : 'composer-busy'
  }
  return session.unavailable
}
