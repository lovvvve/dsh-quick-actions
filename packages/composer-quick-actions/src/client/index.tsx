/**
 * Client composition entry for Composer Quick Actions.
 *
 * This fiber owns everything the feature holds in the browser: one global
 * `QuickActionsController` over the two Settings namespaces, the per-Session
 * execution registry, the Resident Composer registry, the locale dictionaries,
 * the stylesheet, and the two dock Slot registrations. All of it is installed
 * through `ctx.effect` and `ctx.slots.inject`, so unloading the plugin leaves
 * no listener, registration, namespace, style tag or subscription behind
 * (spec 7.3).
 *
 * `settingsScope` is how this Client reaches Host-authoritative state at all — it
 * never writes a file, never treats browser storage as a source of truth, and
 * never reaches past Settings to a provider (spec 6.3). `connection` supplies the
 * generation state the read-only-while-disconnected rule needs (spec 10).
 */
import type { Context } from '@deepseek-ai/cordis'
import { createQuickActionsController } from './controller.js'
import type { ConnectionLike, SettingsScopeService } from './controller.js'
import { createQuickActionSessionRegistry } from './session/execution.js'
import { createResidentComposerRegistry } from './surfaces/residency.js'
import { createQuickActionDockEntries } from './surfaces/entries.js'
import type { ComponentType, ConversationLike, LocaleService, SlotsService } from './dsh.js'
import { QUICK_ACTIONS_LOCALE_NAMESPACE, quickActionsDictionaries } from '../locales/index.js'
import { installQuickActionStyles } from '../styles/index.js'

// `@deepseek-ai/dsh-client-ui-settings`, `@deepseek-ai/dsh-client-connection`,
// `@deepseek-ai/dsh-client-ui-renderer` and `@deepseek-ai/dsh-client-locale`
// publish no `.d.ts` this package can depend on at build time — the Client
// bundle may only `require` the specifiers the build adapter declares external —
// so the shapes this plugin consumes are declared in `./dsh.ts` and in
// `./controller.ts`, deliberately no wider than what is actually read.
declare module '@deepseek-ai/cordis' {
  interface Context {
    settingsScope: SettingsScopeService
    connection: ConnectionLike
    slots: SlotsService
    locale: LocaleService
    conversation: ConversationLike
  }
}

export const name = 'composer-quick-actions'

/**
 * The services this Client requires (spec 7.3). `conversation` is deliberately
 * absent: its Composer-block registry is read through `ctx.get`, the documented
 * read "without the inject requirement", because the service is guaranteed
 * present wherever the two dock Slots it declares are rendered.
 */
export const inject: readonly string[] = ['slots', 'settingsScope', 'connection', 'locale']

/** Ascending position among the shipped dock entries; late enough to sit last. */
const DOCK_ORDER = 100

/**
 * Start the feature and tie every piece of it to this fiber.
 *
 * Nothing is returned and no internal type is re-exported: the controller, the
 * execution engine and the surfaces are internal to this package (spec 14).
 */
export function apply(ctx: Context): void {
  const controller = createQuickActionsController({
    settingsScope: ctx.settingsScope,
    connection: ctx.connection,
  })
  const sessions = createQuickActionSessionRegistry()
  const residency = createResidentComposerRegistry()

  ctx.effect(
    () => () => {
      sessions.dispose()
      controller.dispose()
    },
    'composer-quick-actions: client controller',
  )
  ctx.effect(
    () => ctx.locale.register(QUICK_ACTIONS_LOCALE_NAMESPACE, quickActionsDictionaries),
    'composer-quick-actions: dictionaries',
  )
  ctx.effect(installQuickActionStyles, 'composer-quick-actions: surface styles')

  const { InputDock, ComposerDock } = createQuickActionDockEntries({
    controller,
    sessions,
    residency,
    blocks: () => ctx.get('conversation')?.blocks,
  })

  // Both docks are always registered; the current layout decides which one draws
  // (spec 8.1). The composer dock is also the Resident Composer beacon, so it is
  // registered whatever the layout is.
  ctx.slots.inject('conversation.input.dock', () =>
    ctx.slots.register(
      {
        name: 'conversation.input.dock',
        id: 'composer-quick-actions',
        order: DOCK_ORDER,
        locale: QUICK_ACTIONS_LOCALE_NAMESPACE,
      },
      InputDock as ComponentType<never>,
    ),
  )
  ctx.slots.inject('conversation.composer.dock', () =>
    ctx.slots.register(
      {
        name: 'conversation.composer.dock',
        id: 'composer-quick-actions',
        order: DOCK_ORDER,
        locale: QUICK_ACTIONS_LOCALE_NAMESPACE,
      },
      ComposerDock as ComponentType<never>,
    ),
  )
}
