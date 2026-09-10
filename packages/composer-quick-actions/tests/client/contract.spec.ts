/**
 * The one place the hand-written DSH faces of `src/client/dsh.ts` are checked
 * against the declarations DSH actually publishes.
 *
 * `dsh.ts` transcribes the contract by hand on purpose: the Client bundle may
 * only `require` the specifiers the build adapter lists as externals, so the
 * plugin cannot import these types at build time (spec 9.1). The fake composer
 * in `composer.ts` is then built from that same hand-written type, which means
 * the plugin and its whole suite move together. That is how ticket 29 happened:
 * DSH renamed `imageIds` to `attachmentIds` in 0.1.5-rc.1, every test stayed
 * green, and the surface still crashed in a real shell.
 *
 * Tests are the only place this import is allowed — they are never bundled, and
 * `@deepseek-ai/dsh-client-ui-conversation` is a devDependency-resolved peer
 * here rather than something the shipped artefact reaches for. It reaches the
 * contract declaration by path rather than through the package's `./client`
 * entry on purpose: that entry augments Cordis `Context` with the full
 * `conversation` service, which collides (TS2717) with the narrow
 * `ConversationLike` this plugin augments it with in `src/client/index.tsx`.
 * The file imported here augments only Cordis `Events`, which this plugin never
 * touches.
 *
 * These assertions carry no runtime behaviour; they fail in `pnpm typecheck`'s
 * second pass (`tsconfig.test.json` — the only pass that covers `*.spec.ts`).
 * The case body keeps them inside a live vitest run as well, so the file cannot
 * quietly stop being compiled.
 */
import type {
  InputActions as ShippedInputActions,
  InputState as ShippedInputState,
} from '../../node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/types/client/contract/input.js'
import { expectTypeOf, it } from 'vitest'

import type { InputActions, InputState } from '../../src/client/dsh.js'

it('declares no more of the DSH Input contract than DSH publishes', () => {
  // The direction is the whole point: DSH publishes and this plugin consumes,
  // so a shipped value must satisfy the declared shape — never the reverse. The
  // declared shapes are deliberately narrower (spec 9.5 admits only the fields
  // listed there as evidence, and `InputActions` deliberately omits the
  // attachment verbs), and narrowing stays legal in this direction while a
  // renamed, removed or retyped field does not.
  expectTypeOf<ShippedInputState>().toExtend<InputState>()
  expectTypeOf<ShippedInputActions>().toExtend<InputActions>()
})
