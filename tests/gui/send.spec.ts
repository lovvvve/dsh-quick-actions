import { expect, test, type Page } from '@playwright/test'
import { actionFaces, composerInput, ensureLayout, openResidentComposer } from './support.js'

/**
 * The send path on the live GUI, against the user's real model — spec section 13.2's
 * confirm/single-flight/queue rows, which no fake can stand in for because the whole point
 * is that DSH's own `submit()` adjudicates.
 *
 * Driven by `tests/gui/send-round.sh`, which seeds the two fixtures first: this file skips
 * itself otherwise, because without them it would activate whatever the profile holds —
 * and one packaged preset's text is the real `/compact` command.
 *
 * These tests submit into the conversation discovery enters, which is one of the user's own:
 * DSH routes sessions client-side and groups them under workspaces, so no stable handle
 * exists for a conversation made just for this round. Every activation of the normal fixture
 * is a real model turn on that account, so the fixture's text is the cheapest useful prompt
 * and each test spends at most one.
 */
const seeded = process.env.DSH_QA_SEND === '1'
const sendAction = '[data-quick-action="custom:11111111-1111-4111-8111-111111111111"]'
const commandAction = '[data-quick-action="custom:22222222-2222-4222-8222-222222222222"]'
const confirmPanel = '[data-quick-actions-confirm]'
const SEND_TEXT = '回复 ok'
const COMMAND_TEXT = '/qa-probe-unknown-command'

/**
 * How many times the user has sent this exact text. Scoped to `user` flows on purpose:
 * DSH renders many `data-chat-turn` elements per exchange, and the assistant quotes the
 * submitted text back inside an `assistant-step`, so both of those would inflate the count
 * and turn "sent once" into a number that proves nothing.
 */
function sentByUser(page: Page, text: string) {
  return page.locator('[data-chat-flow-kind="user"]', { hasText: text })
}

test.describe('quick action send path', () => {
  test.skip(!seeded, 'run through tests/gui/send-round.sh, which seeds the fixtures first')

  test.beforeEach(async ({ page }) => {
    await openResidentComposer(page)
    await ensureLayout(page, 'ribbon')
    // Only the two fixtures: the packaged presets are hidden by the seed.
    await expect(actionFaces(page)).toHaveCount(2)
  })

  test('the confirm panel previews a command and cancels without sending', async ({ page }) => {
    const before = await sentByUser(page, COMMAND_TEXT).count()

    await page.locator(commandAction).click()

    const panel = page.locator(confirmPanel)
    await expect(panel).toBeVisible()
    await expect(panel).toHaveRole('dialog')
    // Accessible name and modality are hard gates of spec section 13.3.
    await expect(panel).toHaveAttribute('aria-label', /.+/)
    await expect(panel).toHaveAttribute('aria-modal', 'true')
    // The panel shows the exact text that will be submitted, and says why no native
    // slash-command menu appears — spec section 16's requirement for command actions.
    await expect(panel).toContainText('/qa-probe-unknown-command')
    await expect(panel.locator('[data-quick-actions-command-notice]')).toContainText('候选菜单')
    await expect(page.locator('[data-quick-actions-confirm-send]')).toBeFocused()

    await page.keyboard.press('Escape')

    await expect(panel).toHaveCount(0)
    // Cancelling is what "no content loss" means here: nothing sent, nothing left behind.
    expect(await sentByUser(page, COMMAND_TEXT).count()).toBe(before)
    await expect(composerInput(page)).toHaveText('')
  })

  test('confirming a command send action submits it once', async ({ page }) => {
    const before = await sentByUser(page, COMMAND_TEXT).count()

    await page.locator(commandAction).click()
    await page.locator('[data-quick-actions-confirm-send]').click()

    await expect(page.locator(confirmPanel)).toHaveCount(0)
    // An unknown command still goes down DSH's own adjudication path, so the answer is
    // DSH's rather than the model's — which is why this fixture costs nothing to run.
    await expect(sentByUser(page, COMMAND_TEXT)).toHaveCount(before + 1, { timeout: 30_000 })
  })

  test('a send action with confirm off submits in one click and shows no panel', async ({ page }) => {
    const before = await sentByUser(page, SEND_TEXT).count()

    await page.locator(sendAction).click()

    // The panel must never appear for this action, and the path is otherwise identical.
    await expect(page.locator(confirmPanel)).toHaveCount(0)
    await expect(sentByUser(page, SEND_TEXT)).toHaveCount(before + 1, { timeout: 30_000 })
  })

  test('activating the same action twice in one tick sends once', async ({ page }) => {
    const before = await sentByUser(page, SEND_TEXT).count()
    const control = page.locator(sendAction)

    // The contract is one send per *tick*: two Playwright clicks are separated by
    // actionability waits, and a second activation after the first send has landed is
    // legitimate. Dispatching both synchronously in the page is what the single-flight
    // window actually guards — the official sink clears the draft optimistically, so
    // "the draft is taken" is not a mutex.
    await control.waitFor({ state: 'visible' })
    await page.evaluate((selector) => {
      const element = document.querySelector<HTMLElement>(selector)
      if (element === null) throw new Error('action control missing')
      element.click()
      element.click()
    }, sendAction)

    await expect(sentByUser(page, SEND_TEXT)).toHaveCount(before + 1, { timeout: 30_000 })
    // Give a second copy the chance to appear before calling it one.
    await page.waitForTimeout(5_000)
    expect(await sentByUser(page, SEND_TEXT).count()).toBe(before + 1)
  })

  test('a second activation while the first turn is in flight is queued by DSH', async ({ page }) => {
    const before = await sentByUser(page, SEND_TEXT).count()
    const control = page.locator(sendAction)

    // Two sequential activations, unlike the same-tick pair above: the first send has landed
    // and the model is answering, so the second is a legitimate activation that DSH's own
    // queue takes. The plugin must neither block it nor report a failure — spec 13.2's
    // "模型运行期间官方 queue" row.
    await control.click()
    await control.click()

    await expect(sentByUser(page, SEND_TEXT)).toHaveCount(before + 2, { timeout: 60_000 })
    await expect(page.locator('[data-quick-actions-feedback="failed"]')).toHaveCount(0)
  })

  test('an occupied draft disables activation instead of discarding it', async ({ page }) => {
    const before = await sentByUser(page, SEND_TEXT).count()
    await composerInput(page).fill('这是用户自己的草稿')

    // Spec section 6: a send action only ever writes into an unoccupied draft, so the
    // control reports itself unavailable rather than overwriting what the user typed.
    // Asserted mechanism-agnostically — `toBeDisabled` covers both the native attribute
    // this surface uses and the `aria-disabled` the manager rows use — plus the reason it
    // shows and, below, the behaviour that actually matters.
    await expect(page.locator(sendAction)).toBeDisabled()
    await expect(page.locator(sendAction)).toHaveAttribute('title', /草稿/)
    await page.locator(sendAction).click({ force: true })

    expect(await sentByUser(page, SEND_TEXT).count()).toBe(before)
    await expect(composerInput(page)).toHaveText('这是用户自己的草稿')

    await composerInput(page).fill('')
  })
})
