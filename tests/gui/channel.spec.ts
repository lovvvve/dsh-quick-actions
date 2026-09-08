import { expect, test } from '@playwright/test'

/**
 * Channel probe. Everything else in `tests/gui/` assumes these hold, so this spec
 * reports the two prerequisites of spec section 13.3 separately from the plugin's own
 * behaviour: the official GUI answers, and this plugin's dock cells reached the page.
 *
 * A failure here is an environment fact, not a plugin defect — read the message.
 */
test.describe('DSH GUI channel', () => {
  test('the official GUI answers on the verification channel', async ({ page, baseURL }) => {
    const response = await page.goto('/')

    expect(response, `no response from ${baseURL}; start the web profile first`).not.toBeNull()
    expect(
      response!.status(),
      `${baseURL} answered ${response!.status()}; 401/403 means the browser-trust fence rejected this fresh browser profile`,
    ).toBeLessThan(400)
  })

  test('the conversation composer is present', async ({ page }) => {
    await page.goto('/')

    // The composer owns the only textbox DSH renders on a fresh conversation.
    await expect(page.getByRole('textbox').first()).toBeVisible({ timeout: 20_000 })
  })

  test('the plugin dock cells reached the page', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('textbox').first()).toBeVisible({ timeout: 20_000 })

    // `conversation.input.dock` carries the layout cell and the manager overlay cell;
    // with an empty projection the layout collapses to the compact manager entry, so
    // the manager trigger is the one marker present in every projection.
    await expect(
      page.locator('[data-quick-actions-manager]'),
      'plugin surfaces absent: the bundle row is not installed, or the profile has not restarted since',
    ).toHaveCount(1)
  })
})
