import { expect, test } from '@playwright/test'
import { ensureLayout, layoutCell, manageEntry, openResidentComposer } from './support.js'

/**
 * The management overlay and the layout setting, on the live GUI. Layout is a global
 * persisted setting, so these specs write to this plugin's own Settings namespace and
 * restore `ribbon` afterwards — nothing else in DSH's settings is touched, and nothing
 * here submits anything.
 */
test.describe('quick actions management', () => {
  test.beforeEach(async ({ page }) => {
    await openResidentComposer(page)
  })

  test.afterEach(async ({ page }) => {
    // Leave the user's DSH on the default layout however the test ended. An open panel
    // holds a backdrop that would swallow the manage click, so dismiss it first.
    if (await layoutCell(page).count() === 0) return
    await page.keyboard.press('Escape')
    await ensureLayout(page, 'ribbon')
  })

  test('opens a labelled dialog that lists the packaged presets', async ({ page }) => {
    await manageEntry(page).click()

    const dialog = page.locator('[data-quick-actions-manager]')
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveRole('dialog')
    // An accessible name is a hard gate of spec section 13.3.
    await expect(dialog).toHaveAttribute('aria-labelledby', /.+/)
    // Presets are read-only but reorderable, hideable and clonable.
    await expect(page.locator('[data-quick-actions-clone]')).toHaveCount(3)
  })

  test('closes on Escape and returns focus to the manage entry', async ({ page }) => {
    await manageEntry(page).click()
    await expect(page.locator('[data-quick-actions-manager]')).toBeVisible()

    await page.keyboard.press('Escape')

    await expect(page.locator('[data-quick-actions-manager]')).toHaveCount(0)
    await expect(manageEntry(page)).toBeFocused()
  })

  test('switches layout and keeps it across a page reload', async ({ page }) => {
    await manageEntry(page).click()
    await page.locator('[data-quick-actions-layout-choice="bar"]').click()

    await expect(layoutCell(page)).toHaveAttribute('data-quick-actions-layout', 'bar')

    // Settings are the authority, so a reload must come back on the stored layout —
    // this is the persistence requirement of spec section 13.2, seen from the GUI.
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(layoutCell(page)).toHaveAttribute('data-quick-actions-layout', 'bar', { timeout: 20_000 })
  })

  test('the launcher layout opens the shared searchable panel', async ({ page }) => {
    await manageEntry(page).click()
    await page.locator('[data-quick-actions-layout-choice="launcher"]').click()
    await expect(layoutCell(page)).toHaveAttribute('data-quick-actions-layout', 'launcher')
    await page.locator('[data-quick-actions-manager-close]').click()

    // The launcher is a single entry that opens the panel B and C share.
    await page.locator('[data-quick-actions-entry="launcher"]').click()
    const panel = page.locator('[data-quick-actions-panel]')
    await expect(panel).toBeVisible()

    const search = page.locator('[data-quick-actions-search]')
    await expect(search).toBeFocused()
    await search.fill('压缩')

    // Search matches labels and texts only, so one packaged preset survives.
    await expect(panel.locator('[data-quick-action]')).toHaveCount(1)

    await page.keyboard.press('Escape')
    await expect(panel).toHaveCount(0)
  })
})
