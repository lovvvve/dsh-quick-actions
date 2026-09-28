import { expect, test } from '@playwright/test'
import { actionFaces, manageEntry, managerPanel, openResidentComposer, storedNamespace } from './support.js'

/**
 * What a `dsh --patch` overlay carrying this plugin's `config` does (ticket 34, and the
 * README warning under "配置预置动作"). DSH replaces a patch row's `config` whole, so the
 * overlay's presets reach the Client while the state stored on the profile row falls back to
 * the schema defaults, and config-editor refuses every form write to the overridden entry.
 *
 * Driven by `tests/gui/overlay-round.sh`, which seeds one Custom Quick Action on the profile
 * row and boots with an overlay that declares one preset.
 */
const overlaid = process.env.DSH_QA_OVERLAY === '1'
const OVERLAY_PRESET_LABEL = 'overlay 分发验证'
const SEEDED_CUSTOM_LABEL = '规模动作 1'

test.describe('a preset shipped through a command-line overlay', () => {
  test.skip(!overlaid, 'run through tests/gui/overlay-round.sh')

  test.beforeEach(async ({ page }) => {
    await openResidentComposer(page)
  })

  test('reaches the Client while the stored actions are hidden', async ({ page }) => {
    await expect(actionFaces(page).filter({ hasText: OVERLAY_PRESET_LABEL })).toHaveCount(1)
    await expect(actionFaces(page).filter({ hasText: SEEDED_CUSTOM_LABEL })).toHaveCount(0)
    // Hidden, not lost: the profile row on disk still holds the seeded action.
    const labels = Object.values(storedNamespace().userActionsById ?? {}).map(action => action.label)
    expect(labels).toContain(SEEDED_CUSTOM_LABEL)
  })

  test('turns every save into a refusal', async ({ page }) => {
    await manageEntry(page).click()
    const row = managerPanel(page).locator('[data-quick-action]', { hasText: OVERLAY_PRESET_LABEL })
    await row.getByRole('button', { name: '隐藏' }).click()

    // Nothing marks the panel read-only beforehand — the form reports itself writable — so
    // the refusal only shows once a write comes back unapplied.
    await expect(page.locator('[data-quick-actions-write-failure="refused"]')).toBeVisible()
  })
})
