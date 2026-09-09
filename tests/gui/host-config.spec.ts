import { expect, test } from '@playwright/test'
import { actionFaces, ensureLayout, manageEntry, managerPanel, openResidentComposer } from './support.js'

/**
 * A Host `Config.presets` change reaching the Client (spec section 13.2's "Host Config 变化"
 * row). `Config.presets` is the only authorized channel for third-party presets — there is
 * no runtime registration API — so this is what an integrator's own catalog entry does.
 *
 * Driven by `tests/gui/host-config-round.sh`, which boots the profile with an extra patch
 * overlay rather than editing the user's own `cordis.patch.yml`: `dsh --patch` applies after
 * every bundle layer, which is exactly where a profile-level preset would land.
 */
const overlaid = process.env.DSH_QA_HOST_CONFIG === '1'
const OVERLAY_PRESET_LABEL = '主机配置验证'

test.describe('a preset declared in Host config', () => {
  test.skip(!overlaid, 'run through tests/gui/host-config-round.sh, which boots the overlay')

  test.beforeEach(async ({ page }) => {
    await openResidentComposer(page)
    await ensureLayout(page, 'ribbon')
  })

  test('joins the catalog after the packaged presets', async ({ page }) => {
    // The packaged three, then the composition's own — the order is fixed by spec section 5.
    await expect(actionFaces(page)).toHaveCount(4)
    const labels = await actionFaces(page).evaluateAll(
      elements => elements.map(element => (element.textContent ?? '').replace(/\s+/g, '')),
    )
    expect(labels.at(-1)).toContain(OVERLAY_PRESET_LABEL)
  })

  test('is read-only like every other preset', async ({ page }) => {
    await manageEntry(page).click()

    const row = managerPanel(page).locator('[data-quick-action]', { hasText: OVERLAY_PRESET_LABEL })
    await expect(row).toHaveCount(1)
    // Presets can be cloned and hidden, never edited or deleted: a Host-declared entry is
    // the package author's, not the user's.
    await expect(row.locator('[data-quick-actions-clone]')).toHaveCount(1)
    await expect(row.locator('[data-quick-actions-delete]')).toHaveCount(0)
  })
})
