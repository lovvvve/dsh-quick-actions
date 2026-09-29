# Core composer footer patch — verification

**Follow-up:** the missing Remote declarations and unresolved workspace artifacts recorded below have since been resolved by restoring the complete dependency graph and following the official Host/Typert→Client build order. See the [build diagnosis and artifact verification](../../verification/footer-build.md). The historical logs below remain unchanged; the running GUI is still not updated.

## Deliverable and baseline

- [Patch](./conversation-composer-footer.patch), [per-file hashes](./patch-manifest.json), and [reproduction script](./make-patch.py).
- Exact requested base: `dsh-v0.1.7-rc.2`, commit `477b4f420553e8a52c2fbccc464d7561b239c443`.
- Source archive: `/tmp/dsh-footer-source.gZQq0j/source.tar.gz`; SHA-256 `a6b78577dec0653bf336f6aa093c55dd93cb3350f220f91efde951b18c7eda83`.
- Edited tree: `/tmp/dsh-footer-source.gZQq0j/deepseek-harness-477b4f420553e8a52c2fbccc464d7561b239c443` (below, `$ARCHIVE`). Node `v26.4.0`, pnpm `11.7.0`, macOS arm64.
- Patch SHA-256: `1095ea6198eacad4fe9a3f3fd3a4c7dfe9433105f2101a664ba08fbba51802a3`.
- 13 changed tracked archive files: four implementation files, three test files, five documentation/pair files, one generated inspection catalog. No manifest, lockfile, plugin runtime, plugin tests, issue/spec/plan, installed GUI, or original checkout changes are included.
- This is an unapplied core patch, not an official release or deployed GUI capability.

## Public API and layout

`conversation.composer.footer` is `kind: 'list'`, `scope: 'session'`, with **no owner props**. Entries derive `PropsRuntime<'conversation.composer.footer'>`; standard Session props include `sessionId`, `useSession`, `useInput`, and `inputActions`. The `conversation.composer.bar` registration declares the child, and `ComposerBarProps` authorizes its renderer. The generated client inspection catalog agrees.

The footer is a separate full-card-width row after the existing dock/statistics/ContextMeter line. Its guard exactly matches the dock: `variant === 'composer' && input !== undefined && sessionId !== undefined`. Hero, missing Session, and missing input do not dispatch it. A takeover hides it with the existing resident fallback. **Overlay takeover preserves that hidden fallback's mounted components**; this patch deliberately does not change that lifecycle or treat mount as visibility.

The renderer always emits a `display: contents` Slot anchor, even for zero entries or components returning `null`. Therefore outer `:empty` would be wrong. The minimal footer wrapper has the card's width/max-width, column flex, no padding/margin/min-height, and a 4px inter-item gap. Empty contents generate no flex items, height, or gap. Existing dock JSX/CSS and ContextMeter are unchanged. There is no sibling measurement, outer-layout override, new effect, or new state.

## TDD evidence

Tests were changed first; no production source was edited before the RED run.

```sh
cd "$ARCHIVE"
./node_modules/.bin/vitest run \
  packages/client/ui-conversation/tests/input-bar.client.spec.tsx \
  packages/client/ui-conversation/tests/apply-wiring.client.spec.tsx \
  packages/client/ui-conversation/tests/skeleton.client.spec.tsx \
  -t 'resident composer footer|owns shell slots|sticky composer seat wraps'
```

**RED:** exit 1, four expected failures: missing footer declaration, missing action in its own row, missing empty renderer anchor, and missing footer inside the hidden takeover fallback. Three negative-guard cases passed. See [RED log](./red.log).

After the four-file implementation, the same three files without `-t` passed: **135 tests / 3 files**, exit 0. See [GREEN log](./green.log). Coverage includes row ordering and separation, the real ContextMeter remaining in the dock, empty owner props, hero/no-session/no-input exclusion, null content, hidden takeover containment, declaration and disposal, and unchanged existing composer behavior.

## Additional verification

| Command / check | Observed result |
|---|---|
| `./node_modules/.bin/vitest run packages/client/ui-conversation packages/client/ui-renderer packages/client/ui-slots` | **706 tests / 55 files passed**, exit 0; [log](./regression.log). Existing renderer intentional-error cases print error stacks; Vite prints a tsconfig-paths migration notice. |
| `node <evidence-dir>/verify-layout.mjs "$ARCHIVE"` | **Passed** using installed Chrome headless, with no HTTP server or running-GUI connection; [script](./verify-layout.mjs), [log](./layout-chrome.log). |
| `./node_modules/.bin/oxlint` on the six changed `.ts/.tsx` source/test files, with `--deny-warnings` | Exit 0, **0 warnings / 0 errors**, 90 rules. |
| `./node_modules/.bin/tsx scripts/gen-client-catalog.ts` followed by `--check` | Exit 0; generated artifact current. |
| `./node_modules/.bin/tsx scripts/verify-translation-pairing.ts --write packages/client/ui-conversation/README.md docs/subsystems/slots.md` | README sidecar re-recorded; Slot hierarchy code-fence change does not alter sidecar hashes. |
| Same pairing command without `--write` | Exit 0; both named pairs consistent. |
| `./node_modules/.bin/tsx scripts/verify-md-wrap.ts` | Exit 0, 2277 files checked. |
| `python3 <evidence-dir>/make-patch.py "$ARCHIVE"` | **Passed**: source-archive comparison, `git apply --check --whitespace=error`, actual application, byte comparison with edited files, and reverse apply check. |
| Python byte comparison against archive originals | **Passed**: existing dock JSX block, dock CSS rule, and complete ContextMeter TSX/CSS remain byte-identical. |

The browser layout fixture uses the real owning CSS and the renderer's `display:contents` DOM convention, not a complete DSH application. At viewport widths **320 / 768 / 1440**, footer and card left edges and widths match exactly (288 / 720 / 720px). Empty footer height is **0px**; root geometry equals the same DOM with the footer hidden. Two entries add 46px. Card/dock geometry remains unchanged, and removing entries restores the initial geometry. This establishes the CSS layout mechanism, **not live plugin integration or GUI acceptance**.

## Dependency/build limitations (not hidden)

1. Dependencies were copied into the isolated archive from the old checkout's root cache; no original dependency files were modified. The first `pnpm exec vitest` unexpectedly triggered pnpm 11 auto-install and was stopped before tests ran. Subsequent network-capable commands explicitly used `HTTPS_PROXY=HTTP_PROXY=http://127.0.0.1:9999`.
2. An explicit full `pnpm install --frozen-lockfile --ignore-scripts` was stopped after unneeded LibreOffice/Claude/Codex platform binary downloads repeatedly failed. A `--no-optional --offline` attempt aborted without a TTY before purging modules. The successful setup was:

   ```sh
   HTTPS_PROXY=http://127.0.0.1:9999 HTTP_PROXY=http://127.0.0.1:9999 \
     pnpm --filter @deepseek-ai/dsh-client-ui-conversation... install \
       --frozen-lockfile --ignore-scripts --offline
   ```

   It linked 278 workspace projects from cached dependencies in 9.3 seconds. Subsequent checks used local executables directly to avoid pnpm auto-install.
3. `./node_modules/.bin/tsc -b packages/client/ui-conversation/tsconfig.json` **failed, exit 2**: the archive lacks generated Typert `/remote` declarations for API packages and the resulting `ClientRemote` members. See [type-build log](./typecheck.log). No claim of a passing full typecheck is made.
4. Running `../../../node_modules/.bin/tsdown` from the conversation package **exited 0** and emitted its Host and browser bundles, but warned about unresolved `@deepseek-ai/cosmokit` and `@deepseek-ai/dsh-brand` workspace artifacts. See [bundle log](./bundle.log). This is a successful isolated package bundling invocation **with warnings**, not a clean/releasable full build. Generated bundles are excluded from the patch.
5. `verify-client-domain-graph.ts` **failed, exit 1**, reporting 82 existing import-edge violations, including the pre-existing InputBar imports of DraftEditor, view-binding, and submission-policy. This patch adds no imports and does not address that unrelated baseline debt.
6. Default Playwright Chromium launch initially failed because its pinned browser download is absent ([log](./layout.log)); the successful run used installed Google Chrome with its own headless temporary profile.
7. No full `test:gui`, `test:web`, root build, complete doc-sync, real-host integration, or live GUI acceptance was run. Those broader lanes either require more generated/build dependencies or launch services outside this assignment's permission. No server was started, no GUI restarted, and nothing published. The assembled renderer reconnect regression uses in-process `RemoteMock.rpc`, not a listening Host.

## Applying

From a clean checkout of the exact base, run `git apply --check <patch>` and then `git apply <patch>`. The patch does not install itself into the running GUI. The patch-generation script reconstructs the changed files directly from the supplied base archive and checks forward/reverse applicability; its per-file before/after hashes are recorded in the manifest.
