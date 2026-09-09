import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import {
  actionFaces,
  composerInput,
  ensureLayout,
  layoutCell,
  manageEntry,
  managerPanel,
  openResidentComposer,
} from './support.js'

/**
 * What the Client does when the connection under it goes away and comes back — spec
 * section 10's read-only and reconnect semantics, and section 13.2's "断线恢复" row.
 *
 * Driven by `tests/gui/lifecycle-round.sh`, which boots the profile, runs the `down` half
 * (that half stops the profile itself, mid-test), boots again and runs the `up` half. The
 * halves skip at group level so a plain `verify:gui` run neither kills a server nor claims
 * to have tested a reconnect it never caused.
 */
const half = process.env.DSH_QA_LIFECYCLE
const SEND_FIXTURE = '11111111-1111-4111-8111-111111111111'
const SEND_TEXT = '回复 ok'

/**
 * Stop the profile this round booted, addressed by the process group `boot.sh` recorded.
 * `process.kill` with a negative pid signals the group; the external `kill` binary reads a
 * leading `-<pid>` as an option instead.
 */
function stopTheProfile(): void {
  const group = Number(readFileSync('.playwright/dsh-web.pid', 'utf8').trim())
  if (!Number.isInteger(group) || group <= 1) throw new Error('no profile process group recorded')
  process.kill(-group, 'SIGTERM')
}

test.describe('while the connection is down', () => {
  test.skip(half !== 'down', 'run through tests/gui/lifecycle-round.sh')

  // One test, because the page has to be loaded before the profile goes away: a second
  // test would get a fresh browser context with nothing left to load from.
  test('holds its last snapshot read-only and keeps a loaded draft', async ({ page }) => {
    await openResidentComposer(page)
    await ensureLayout(page, 'ribbon')
    const before = await actionFaces(page).count()

    stopTheProfile()

    // The bundle is already loaded, so the surface must stay up on what it last confirmed
    // rather than blanking: spec section 10 calls for read-only, not empty.
    await expect(actionFaces(page)).toHaveCount(before, { timeout: 30_000 })

    await manageEntry(page).click()
    await expect(managerPanel(page)).toBeVisible()
    // The overlay says why nothing can be changed instead of letting a write fail silently.
    await expect(managerPanel(page).locator('[data-quick-actions-readonly]')).toHaveCount(1, {
      timeout: 30_000,
    })
    await page.keyboard.press('Escape')
    await expect(managerPanel(page)).toHaveCount(0)

    // Loading is two steps — `setDraft(text)` then `submit()` — and the shipped `submit()`
    // has no connection check: the machine answers `default-sink` + `commit-draft` and the
    // shell runs both synchronously, so the text is cleared optimistically *before* the sink
    // fails. Then DSH's own `restoreFailedDrafts` puts it back, and DSH raises its own error
    // notice. Spec 9.5: the user loses nothing, and the failure of a message that entered the
    // official path is DSH's to report.
    await page.locator(`[data-quick-action="custom:${SEND_FIXTURE}"]`).click()

    await expect(composerInput(page)).toHaveText(SEND_TEXT, { timeout: 30_000 })

    // The plugin adds no note of its own over DSH's (spec 9.5 forbids a second error): the
    // engine read the optimistic clear as the official machine accepting the text and closed
    // the flight there. Pinned at the unit level in `client/execution.spec.ts` ("a send the
    // connection cannot carry"); asserted here as well since ticket 25 (the ticket-18
    // evidence had recorded the mechanism as the engine "stuck in its observation stage",
    // which the shipped source does not bear out).
    await expect(layoutCell(page).locator('[data-quick-actions-feedback]')).toHaveCount(0)
    await composerInput(page).fill('')
  })
})

test.describe('once the connection is back', () => {
  test.skip(half !== 'up', 'run through tests/gui/lifecycle-round.sh')

  test('accepts writes again and registers its surfaces once', async ({ page }) => {
    await openResidentComposer(page)

    // No read-only note, and a write lands: the reconnect restored authority.
    await manageEntry(page).click()
    await expect(managerPanel(page).locator('[data-quick-actions-readonly]')).toHaveCount(0)
    await page.locator('[data-quick-actions-layout-choice="bar"]').click()
    await expect(layoutCell(page)).toHaveAttribute('data-quick-actions-layout', 'bar')

    // One profile boot, one registration: a fiber that leaked its dock cells or its
    // stylesheet across the restart would show up here as a duplicate.
    await expect(layoutCell(page)).toHaveCount(1)
    const styleTags = await page.evaluate(
      () => [...document.querySelectorAll('style')].filter(tag => (tag.textContent ?? '').includes('dsh-cqa-')).length,
    )
    expect(styleTags).toBe(1)

    // Close the overlay before the restore: its backdrop would swallow the manage click.
    await page.keyboard.press('Escape')
    await expect(managerPanel(page)).toHaveCount(0)
    await ensureLayout(page, 'ribbon')

    // And an activation still works: the single-flight window from the dropped connection
    // did not stay held. This is the one real model turn this round spends.
    const before = await page.locator('[data-chat-flow-kind="user"]', { hasText: SEND_TEXT }).count()
    await page.locator(`[data-quick-action="custom:${SEND_FIXTURE}"]`).click()
    await expect(page.locator('[data-chat-flow-kind="user"]', { hasText: SEND_TEXT }))
      .toHaveCount(before + 1, { timeout: 60_000 })
  })
})
