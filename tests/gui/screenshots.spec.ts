import { expect, test } from '@playwright/test'
import { ensureLayout, layoutCell, openResidentComposer } from './support.js'

/**
 * The visual baselines spec section 13.3 requires: the three layouts across the desktop and
 * narrow viewports. Each shot is clipped to the plugin's own cell — the page around it is
 * one of the user's conversations, and section 13.1 forbids putting that in the evidence.
 *
 * Driven by `tests/gui/screenshots-round.sh`, which seeds the packaged catalog first so the
 * baselines show the shipped presets rather than whatever the profile happens to hold.
 * Cross-platform font differences are not a blocker per section 13.3, which is why the
 * comparison allows a small ratio of differing pixels.
 */
const seeded = process.env.DSH_QA_SCREENSHOTS === '1'

test.describe('layout baselines', () => {
  test.skip(!seeded, 'run through tests/gui/screenshots-round.sh, which seeds the catalog')

  for (const layout of ['ribbon', 'bar', 'launcher'] as const) {
    test(`${layout} layout`, async ({ page }) => {
      await openResidentComposer(page)
      await ensureLayout(page, layout)

      // Playwright appends the project and platform, so the name carries only the layout.
      await expect(layoutCell(page)).toHaveScreenshot(`${layout}.png`, {
        maxDiffPixelRatio: 0.02,
      })
    })
  }

  test.afterAll(async ({ browser }) => {
    // Hand the profile back on the default layout.
    const page = await browser.newPage()
    await openResidentComposer(page)
    await ensureLayout(page, 'ribbon')
    await page.close()
  })
})
