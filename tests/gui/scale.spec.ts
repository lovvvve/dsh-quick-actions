import { expect, test } from '@playwright/test'
import { actionFaces, ensureLayout, layoutCell, manageEntry, openResidentComposer } from './support.js'

/**
 * Scale, on the live GUI. Spec section 13.2 asks for 0, 1, 6, 25 and 50 normal actions
 * plus the 53-action passive overflow that an upgrade or a Host config change can form —
 * so the state is seeded into Settings before the profile boots, exactly the way those
 * scenarios arise, rather than by driving 50 form submissions through the overlay.
 *
 * The runner seeds the state and then says what to expect:
 *   DSH_QA_EXPECTED  how many actions the projection should render
 *   DSH_QA_OVERCAP   `1` when the seeded total is above the 50-action limit
 */
const expected = Number(process.env.DSH_QA_EXPECTED ?? '3')
const overCap = process.env.DSH_QA_OVERCAP === '1'

test.describe(`quick actions at ${expected} actions`, () => {
  test.beforeEach(async ({ page }) => {
    await openResidentComposer(page)
    await ensureLayout(page, 'ribbon')
  })

  test('renders every seeded action without dropping data', async ({ page }) => {
    // The ribbon scrolls rather than folding, so all of them stay in the DOM even at 53.
    await expect(actionFaces(page)).toHaveCount(expected)
  })

  test('reports the limit state the seeded total implies', async ({ page }) => {
    await manageEntry(page).click()
    const limit = page.locator('[data-quick-actions-limit]')

    if (overCap) {
      // A passive overflow keeps every action and blocks only growth.
      await expect(limit).toHaveAttribute('data-quick-actions-limit', 'overflow')
      await expect(page.locator('[data-quick-actions-new]')).toBeDisabled()
    } else if (expected >= 50) {
      await expect(limit).toHaveAttribute('data-quick-actions-limit', 'reached')
    } else {
      await expect(limit).toHaveCount(0)
      await expect(page.locator('[data-quick-actions-new]')).toBeEnabled()
    }
  })

  test('keeps the equal-width surface intact at this scale', async ({ page }) => {
    // Many actions must not push the row past the composer it tracks.
    const cell = await layoutCell(page).boundingBox()
    const viewport = page.viewportSize()!
    expect(cell).not.toBeNull()
    expect(cell!.x).toBeGreaterThanOrEqual(0)
    expect(cell!.x + cell!.width).toBeLessThanOrEqual(viewport.width)
  })
})
