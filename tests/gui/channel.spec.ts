import { expect, test } from '@playwright/test'
import { composerInput, guiEntry, layoutCell, manageEntry, openGui, openResidentComposer } from './support.js'

/**
 * Channel probe. Everything else in `tests/gui/` assumes these hold, so this spec
 * reports the prerequisites of spec section 13.3 separately from the plugin's own
 * behaviour: the official GUI answers, its composer renders, the hero screen carries
 * no quick actions, and a Resident Composer does.
 *
 * A failure here is an environment fact, not a plugin defect — read the message.
 */
test.describe('DSH GUI channel', () => {
  test('the official GUI answers on the verification channel', async ({ page, baseURL }) => {
    const response = await openGui(page)

    expect(response, `no response from ${baseURL}; start the web profile first`).not.toBeNull()
    expect(
      response!.status(),
      guiEntry === '/'
        ? `${baseURL} answered ${response!.status()}; pass the token URL printed by dsh web as DSH_GUI_ENTRY`
        : `${baseURL} answered ${response!.status()} for the entry URL; the token may already be spent`,
    ).toBeLessThan(400)
  })

  test('the hero screen carries no quick actions', async ({ page }) => {
    await openGui(page)
    await expect(composerInput(page)).toBeVisible({ timeout: 20_000 })

    // Absence is only evidence once the plugin has had its say: `apply()` injects the
    // stylesheet, so waiting for that proves the Client bundle ran and then chose to
    // render nothing here. Asserting a zero count the moment the composer appears would
    // pass on render latency alone, and would stay green if a regression started
    // rendering the layout on the hero a second later.
    await page.waitForFunction(
      () => [...document.querySelectorAll('style')].some(tag => (tag.textContent ?? '').includes('dsh-cqa-')),
      undefined,
      { timeout: 30_000 },
    )

    // The hero deliberately does not mount `conversation.composer.dock`, and the plugin
    // treats that dock as the public Resident Composer beacon.
    await expect(layoutCell(page)).toHaveCount(0)
    await expect(manageEntry(page)).toHaveCount(0)
  })

  test('a Resident Composer carries the plugin surfaces', async ({ page }) => {
    await openResidentComposer(page)

    await expect(layoutCell(page)).toBeVisible()
    await expect(manageEntry(page)).toHaveCount(1)
  })
})
