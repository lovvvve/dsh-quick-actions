import { expect, test, type Page } from '@playwright/test'
import { ensureLayout, layoutCell, manageEntry, managerPanel, openResidentComposer } from './support.js'

/**
 * The revision conflict branch of the structured mutation outcome (spec 10, and spec 13.2's
 * "写入拒绝与 revision 冲突必须按第 10 节区分处理").
 *
 * Every write carries the revision it was planned against (spec 6.3), so a conflict needs a
 * second writer — which at the GUI means a second connection. Two browser contexts are two
 * clients of the same DSH.
 *
 * It has to be a *race*, and that is this round's finding: DSH's settings mirror is live
 * across connections. A second client that waits for the first one's write is told about it
 * and re-plans against the new revision, so it never goes stale — asserted directly below,
 * before the race is staged. A lost fence therefore only happens when both writes leave
 * before either client can be told, which is what the two synchronous dispatches do.
 *
 * `refused` and `conflict` are told apart by the controller from the authoritative snapshot
 * that follows the write, so this is also what proves the classification is not guesswork:
 * a refusal leaves the revision where it was, and only a lost fence moves it.
 *
 * Desktop only: the outcome is not a matter of width, and a second context would ignore the
 * project viewport anyway.
 */
test.describe('two clients writing the same namespace', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1000, 'the outcome does not vary with viewport')

  const DESKTOP = { width: 1440, height: 900 }

  /** Which failure, if any, this client's management panel is reporting. */
  async function failureKind(page: Page): Promise<string | null> {
    const note = managerPanel(page).locator('[data-quick-actions-write-failure]')
    if (await note.count() === 0) return null
    return note.getAttribute('data-quick-actions-write-failure')
  }

  test('reports the loser of a simultaneous write as a conflict, refreshed to the authority', async ({ browser }) => {
    const firstContext = await browser.newContext({ viewport: DESKTOP })
    const secondContext = await browser.newContext({ viewport: DESKTOP })
    try {
      const first = await firstContext.newPage()
      const second = await secondContext.newPage()

      await openResidentComposer(first)
      await ensureLayout(first, 'ribbon')
      // Opened after the first client settled, so both start from the same revision.
      await openResidentComposer(second)
      await expect(layoutCell(second)).toHaveAttribute('data-quick-actions-layout', 'ribbon')

      // Both panels open first: the race below must not include a panel opening.
      await manageEntry(first).click()
      await manageEntry(second).click()
      await expect(managerPanel(first)).toBeVisible()
      await expect(managerPanel(second)).toBeVisible()

      // A live mirror, seen from here: the second client is told about the first one's
      // write with no reload of its own. This is why the conflict has to be raced for.
      await first.locator('[data-quick-actions-layout-choice="bar"]').click()
      await expect(layoutCell(first)).toHaveAttribute('data-quick-actions-layout', 'bar')
      await expect(layoutCell(second)).toHaveAttribute('data-quick-actions-layout', 'bar')
      await expect(managerPanel(second).locator('[data-quick-actions-write-failure]')).toHaveCount(0)

      // The race. Two synchronous dispatches, neither awaiting the other and neither paying
      // for a Playwright actionability round trip, so both writes are in flight before
      // either client can be told about the other's.
      const choices: readonly [Page, string][] = [[first, 'ribbon'], [second, 'launcher']]
      await Promise.all(choices.map(([page, layout]) => page.evaluate((wanted) => {
        const control = document.querySelector<HTMLElement>(`[data-quick-actions-layout-choice="${wanted}"]`)
        if (control === null) throw new Error(`no layout choice control for ${wanted}`)
        control.click()
      }, layout)))

      // Exactly one of them lost its fence, and it is the one that is told so.
      await expect(async () => {
        const kinds = await Promise.all([failureKind(first), failureKind(second)])
        expect(kinds.filter(kind => kind === 'conflict')).toHaveLength(1)
      }).toPass({ timeout: 20_000 })

      const loserIsFirst = await failureKind(first) === 'conflict'
      const loser = loserIsFirst ? first : second
      const winner = loserIsFirst ? second : first
      const wanted = choices.find(([page]) => page === loser)?.[1]
      expect(wanted).toBeDefined()

      const note = managerPanel(loser).locator('[data-quick-actions-write-failure]')
      await expect(note).toHaveRole('alert')
      await expect(note).toContainText('设置已在别处被修改')
      // The winner's write landed and it was told nothing.
      await expect(managerPanel(winner).locator('[data-quick-actions-write-failure]')).toHaveCount(0)

      // Spec 10: refresh the authority and ask the user to confirm again — never keep a
      // second offline truth. So the loser is now showing the *winner's* value, not the one
      // its own click asked for.
      const settled = await layoutCell(winner).getAttribute('data-quick-actions-layout')
      expect(settled).not.toBe(wanted)
      await expect(layoutCell(loser)).toHaveAttribute('data-quick-actions-layout', settled ?? '')

      // And the explicit retry spec 10 requires lands, because the fence it plans against
      // is the refreshed one.
      await managerPanel(loser).locator('[data-quick-actions-write-retry]').click()
      await expect(layoutCell(loser)).toHaveAttribute('data-quick-actions-layout', wanted ?? '')
      await expect(managerPanel(loser).locator('[data-quick-actions-write-failure]')).toHaveCount(0)

      // Close the overlay before restoring: its backdrop would swallow the manage click.
      await loser.locator('[data-quick-actions-manager-close]').click()
      await expect(managerPanel(loser)).toHaveCount(0)
      await ensureLayout(loser, 'ribbon')
    } finally {
      await firstContext.close()
      await secondContext.close()
    }
  })
})
