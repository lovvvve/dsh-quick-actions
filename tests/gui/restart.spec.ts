import { expect, test } from '@playwright/test'
import { ensureLayout, layoutCell, openResidentComposer } from './support.js'

/**
 * Persistence across a DSH restart (spec section 13.2: "Settings 持久化先于 UI 提交，刷新
 * 和重启后恢复"). Playwright cannot restart the harness mid-test, so the two halves run as
 * separate passes with a profile boot in between — `tests/gui/restart-round.sh` drives it.
 *
 * Without that driver these tests would pass without ever restarting anything, which is
 * worse than not running them: each half therefore skips at the group level, which keeps
 * its hooks from paying for a session entry it is not going to use.
 */
const half = process.env.DSH_QA_RESTART

test.describe('choosing a layout', () => {
  test.skip(half !== 'store', 'run through tests/gui/restart-round.sh')

  test('stores the chosen layout', async ({ page }) => {
    await openResidentComposer(page)
    await ensureLayout(page, 'bar')

    await expect(layoutCell(page)).toHaveAttribute('data-quick-actions-layout', 'bar')
  })
})

test.describe('after the harness restarts', () => {
  test.skip(half !== 'restore', 'run through tests/gui/restart-round.sh')

  test('restores the stored layout', async ({ page }) => {
    await openResidentComposer(page)

    // The profile has been restarted since the layout was chosen: Host Settings is the
    // authority, so the Client must come back on `bar` rather than the default.
    await expect(layoutCell(page)).toHaveAttribute('data-quick-actions-layout', 'bar')

    await ensureLayout(page, 'ribbon')
  })
})
