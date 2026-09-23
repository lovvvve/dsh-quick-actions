/**
 * Host composition entry for Composer Quick Actions.
 *
 * Since DSH 0.1.7 the stored section is this entry's own Config (spec 22): the
 * exported `Config` declares it, the Loader hands it over, and DSH Settings
 * reads and writes it through the active profile. There is no namespace to
 * register and no second namespace for the catalog.
 *
 * `settings` is therefore an optional dependency, as for every first-party
 * plugin: the Quick Actions run without it, and while it is present this entry
 * opts out of an auto-generated Settings page — the plugin ships its own
 * management panel — and canonicalizes the stored section once every entry of
 * the profile has settled.
 *
 * Everything this entry installs is owned by this fiber and withdrawn when it
 * unloads. The user's stored section deliberately survives unload, so
 * reinstalling restores the user's actions.
 *
 * The public surface is the plugin contract only. The shared model, the
 * Settings rewrite and the catalog assembly stay internal to the package
 * (spec 11.2).
 */
import type { Context } from '@deepseek-ai/cordis'
// Loads the `Context.settings` declaration merge. Typing `ctx.settings` as the real
// provider is what makes the assignment below a genuine check that it satisfies the
// narrower face this plugin asks for.
import type {} from '@deepseek-ai/dsh-settings'
import { startQuickActionsHost } from './host/index.js'
import type { QuickActionsHost, QuickActionsSettingsProvider } from './host/index.js'

export const name = 'composer-quick-actions'

export { Config } from './host/settings.js'
export type { ComposerQuickActionsConfig } from './host/config.js'
export type { CatalogSnapshot, QuickActionsHost } from './host/index.js'

/** The Loader as far as this entry needs it: the promise that every entry has settled. */
interface SettlingLoader {
  await(): Promise<unknown>
}

/**
 * Settles once every profile entry has, which is when DSH serves this entry's
 * form at all: an entry is described only while its fiber is active, and the
 * legacy `settings.yaml` import waits on the same promise. A composition with
 * no Loader has nothing to wait for.
 */
function entriesSettled(ctx: Context): Promise<unknown> {
  const loader = ctx.get('loader') as Partial<SettlingLoader> | undefined
  return typeof loader?.await === 'function' ? loader.await() : Promise.resolve()
}

/**
 * Load the Preset Catalog and, while Settings is present, canonicalize the
 * stored section. An invalid preset configuration throws here, failing plugin
 * loading loudly rather than shipping a partial catalog (spec 5.1).
 *
 * @returns the running Host, so a composition that embeds this plugin directly
 * can reach the catalog projection; the cordis loader ignores the value.
 */
export function apply(ctx: Context, config?: unknown): QuickActionsHost {
  const host = startQuickActionsHost(config)
  const logger = ctx.logger('composer-quick-actions')

  ctx.inject(['settings'], (scoped) => {
    const settings: QuickActionsSettingsProvider = scoped.settings

    // The page policy belongs to this entry's fiber, not to the inject child the
    // callback runs in — the child is a fiber of its own.
    scoped.effect(
      () => scoped.settings.configure({ auto: false }, ctx.fiber),
      'composer-quick-actions: settings page policy',
    )

    scoped.effect(() => {
      let owned = true
      void entriesSettled(ctx)
        .then(() => (owned ? host.canonicalize(settings) : undefined))
        .then(
          (outcome) => {
            if (!owned || outcome === undefined) return
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
  })

  return host
}
