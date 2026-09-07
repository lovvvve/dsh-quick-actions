/**
 * Host composition entry for Composer Quick Actions.
 *
 * `settings` is a hard dependency: the concrete provider (`dsh-settings-file`)
 * *is* the service, so injecting it is how this plugin waits for the backend
 * instead of inventing an in-memory, browser or private-file store (spec 6.1).
 * A provider that is present but not writable is a supported state, not a
 * missing one — the stored section is left untouched and the surfaces go
 * read-only (spec 10).
 *
 * Everything this entry registers — the Settings namespace and the startup
 * rewrite's reporting — is owned by this fiber and withdrawn when it unloads.
 * The user's stored section deliberately survives unload, so reinstalling
 * restores the user's actions.
 *
 * The public surface is the plugin contract only. The shared model, the
 * Settings rewrite and the catalog assembly stay internal to the package
 * (spec 11.2); whether any of them becomes a published runtime export belongs
 * to the release-surface decision.
 */
import type { Context } from '@deepseek-ai/cordis'
// Loads the `Context.settings` declaration merge. Typing `ctx.settings` as the real
// provider is what makes the assignment below a genuine check that it satisfies the
// narrower face this plugin asks for.
import type {} from '@deepseek-ai/dsh-settings'
import { startQuickActionsHost } from './host/index.js'
import type { QuickActionsHost, QuickActionsSettingsProvider } from './host/index.js'

export const name = 'composer-quick-actions'
export const inject: readonly string[] = ['settings']

export type { ComposerQuickActionsConfig } from './host/config.js'
export type { CatalogSnapshot, QuickActionsHost } from './host/index.js'

/**
 * Load the Preset Catalog, register the Settings namespace and canonicalize the
 * stored section. An invalid preset configuration throws here, failing plugin
 * loading loudly rather than shipping a partial catalog (spec 5.1).
 *
 * @returns the running Host, so a composition that embeds this plugin directly
 * can reach the catalog projection; the cordis loader ignores the value.
 */
export function apply(ctx: Context, config?: unknown): QuickActionsHost {
  const settings: QuickActionsSettingsProvider = ctx.settings
  const host = startQuickActionsHost(settings, config)
  const logger = ctx.logger('composer-quick-actions')

  ctx.effect(() => {
    let owned = true
    void host.ready.then(
      (outcome) => {
        if (!owned) return
        if (outcome.status === 'conflict') {
          logger.warn(
            'settings kept moving during the canonical rewrite after %d attempts; leaving the stored section as the concurrent writer left it',
            outcome.attempts,
          )
        } else if (outcome.status === 'read-only') {
          logger.warn('settings are read-only; the stored section was left untouched')
        } else if (outcome.status === 'newer-version') {
          logger.warn(
            'the stored section declares schemaVersion %d; leaving it untouched so downgrading loses nothing',
            outcome.schemaVersion,
          )
        }
      },
      (error: unknown) => {
        if (owned) logger.error(error)
      },
    )
    return () => {
      owned = false
    }
  }, 'composer-quick-actions: canonical settings rewrite')

  return host
}
