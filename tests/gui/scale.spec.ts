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
const requested = process.env.DSH_QA_EXPECTED
const expected = Number(requested)
const overCap = process.env.DSH_QA_OVERCAP === '1'

test.describe(`quick actions at ${requested ?? 'no'} seeded actions`, () => {
  // Without the driver nothing has been seeded, so these would assert against whatever
  // the profile already holds and report it as a scale row — a green line in the log
  // that proves nothing. `restart.spec.ts` guards itself the same way.
  test.skip(
    requested === undefined || !Number.isInteger(expected) || expected < 0,
    'run through tests/gui/scale-round.sh, which seeds the row first',
  )

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

  test('folds the bar into "more" once, accounting for every action', async ({ page }) => {
    // Since DSH 0.1.6-alpha.2 the bar is a content-sized member of DSH's composer dock row
    // (spec 22.9), so the region its overflow split measures is itself sized by what it
    // shows. A rounding slip there would fold one action after another, or flip between
    // folding and not. The split must settle, show at least one face when there is any
    // action, and give each action exactly one place: a face, or a count in "more".
    await ensureLayout(page, 'bar')
    const more = page.locator('[data-quick-actions-entry="bar"]')
    const split = async (): Promise<{ faces: number; folded: number }> => ({
      faces: await actionFaces(page).count(),
      folded: await more.count() === 0 ? 0 : Number(/\d+/.exec((await more.textContent()) ?? '')?.[0] ?? Number.NaN),
    })

    const first = await split()
    await page.waitForTimeout(1_500)
    const settled = await split()

    expect(settled, 'the split kept moving').toEqual(first)
    expect(settled.faces + settled.folded).toBe(expected)
    if (expected > 0) expect(settled.faces).toBeGreaterThan(0)
    const cell = await layoutCell(page).boundingBox()
    const viewport = page.viewportSize()!
    expect(cell!.x).toBeGreaterThanOrEqual(0)
    expect(cell!.x + cell!.width).toBeLessThanOrEqual(viewport.width)
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
