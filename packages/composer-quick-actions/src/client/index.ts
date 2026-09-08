/**
 * Client composition entry for Composer Quick Actions.
 *
 * It owns one global `QuickActionsController` on this fiber: the controller binds
 * the two Settings namespaces and the connection state, and everything it holds
 * is released when the fiber unloads. Slot registration, the Composer surfaces
 * and the per-session execution layer are added by the surface tasks.
 *
 * `settingsScope` is how this Client reaches Host-authoritative state at all — it
 * never writes a file, never treats browser storage as a source of truth, and
 * never reaches past Settings to a provider (spec 6.3). `connection` supplies the
 * generation state the read-only-while-disconnected rule needs (spec 10).
 */
import type { Context } from '@deepseek-ai/cordis'
import { createQuickActionsController } from './controller.js'
import type { ConnectionLike, SettingsScopeService } from './controller.js'

// `@deepseek-ai/dsh-client-ui-settings` and `@deepseek-ai/dsh-client-connection`
// publish no `.d.ts` for their client services (checked against 0.1.2-rc.1, whose
// `files` list ships only the bundles), so the shapes this plugin consumes are
// declared here from those bundles. They are deliberately no wider than what the
// controller reads.
declare module '@deepseek-ai/cordis' {
  interface Context {
    settingsScope: SettingsScopeService
    connection: ConnectionLike
  }
}

export const name = 'composer-quick-actions'
export const inject: readonly string[] = ['settingsScope', 'connection']

/**
 * Start the global controller and tie it to this fiber.
 *
 * Nothing is returned and no controller type is re-exported: the controller is
 * internal to this package (spec 14), and the Composer surfaces reach it inside
 * the fiber rather than across the package boundary.
 */
export function apply(ctx: Context): void {
  const controller = createQuickActionsController({
    settingsScope: ctx.settingsScope,
    connection: ctx.connection,
  })
  ctx.effect(() => () => {
    controller.dispose()
  }, 'composer-quick-actions: client controller')
}
