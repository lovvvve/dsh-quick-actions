import { expect, test } from '@playwright/test'
import {
  ensureLayout,
  enterSession,
  layoutCell,
  manageEntry,
  managerPanel,
  openResidentComposer,
  storedNamespace,
} from './support.js'

/**
 * Uninstall, reinstall, and the user's own configuration coming back — spec 13.2's
 * "stop、update、unload、卸载、重装、重启激活和配置恢复" row, and the promise the feature
 * package README makes explicitly: uninstalling does *not* remove the Settings section,
 * "因为重装应当恢复你的动作".
 *
 * Driven by `tests/gui/reinstall-round.sh`, which marks the configuration, uninstalls the
 * plugin, boots, reinstalls, and boots again. The three phases skip at group level so a
 * plain `verify:gui` run neither uninstalls anything nor claims to have tested a reinstall.
 */
// No retries: the `mark` phase creates a configuration the next phases read back, so a
// second attempt would try to create it again on top of itself.
test.describe.configure({ retries: 0 })

const phase = process.env.DSH_QA_REINSTALL
const MARK_LABEL = '重装恢复标记'
const MARK_TEXT = '重装恢复验证文本'

test.describe('before the uninstall', () => {
  test.skip(phase !== 'mark', 'run through tests/gui/reinstall-round.sh')

  test('takes a configuration that is the user\'s own', async ({ page }) => {
    await openResidentComposer(page)

    // Two different kinds of user data: a global setting and an action of their own.
    await ensureLayout(page, 'launcher')
    await manageEntry(page).click()
    await managerPanel(page).locator('[data-quick-actions-new]').click()
    const form = page.locator('[data-quick-actions-form="new"]')
    await form.getByLabel('标签', { exact: true }).fill(MARK_LABEL)
    await form.getByLabel('发送文本', { exact: true }).fill(MARK_TEXT)
    await form.getByRole('button', { name: '保存' }).click()
    await expect(form).toHaveCount(0)

    const row = managerPanel(page).locator('[data-quick-action^="custom:"]', { hasText: MARK_LABEL })
    await expect(row).toHaveCount(1)

    const stored = storedNamespace()
    expect(stored.layout).toBe('launcher')
    expect(Object.values(stored.userActionsById ?? {}).map(action => action.label)).toContain(MARK_LABEL)
  })
})

test.describe('while the plugin is uninstalled', () => {
  test.skip(phase !== 'gone', 'run through tests/gui/reinstall-round.sh')

  test('renders nothing and leaves the stored configuration alone', async ({ page }) => {
    // A session with history, not just any screen: the hero screen has no surfaces either,
    // so landing on it would prove nothing about the uninstall.
    await enterSession(page, 'history')

    await expect(layoutCell(page)).toHaveCount(0)
    await expect(manageEntry(page)).toHaveCount(0)
    // No orphaned stylesheet either: an uninstalled plugin leaves no trace on the page.
    const styleTags = await page.evaluate(
      () => [...document.querySelectorAll('style')].filter(tag => (tag.textContent ?? '').includes('dsh-cqa-')).length,
    )
    expect(styleTags).toBe(0)

    // And the user's data is still on disk. Removing it is a separate, manual step in the
    // README precisely so that a reinstall restores what they had.
    const stored = storedNamespace()
    expect(stored.layout).toBe('launcher')
    expect(Object.values(stored.userActionsById ?? {}).map(action => action.label)).toContain(MARK_LABEL)
  })
})

test.describe('after the reinstall', () => {
  test.skip(phase !== 'back', 'run through tests/gui/reinstall-round.sh')

  test('comes back on the stored configuration', async ({ page }) => {
    await openResidentComposer(page)

    // The layout the user chose before the uninstall, read back from Settings — not the
    // packaged default, which is `ribbon`.
    await expect(layoutCell(page)).toHaveAttribute('data-quick-actions-layout', 'launcher')

    await manageEntry(page).click()
    const row = managerPanel(page).locator('[data-quick-action^="custom:"]', { hasText: MARK_LABEL })
    await expect(row).toHaveCount(1)
    await expect(row.locator('.dsh-cqa-label')).toHaveText(MARK_LABEL)
    await expect(row.locator('.dsh-cqa-list-text')).toHaveText(MARK_TEXT)

    // Put the surface back on the default before the round restores the namespace, so a
    // failed restore cannot leave the user looking at this round's layout. The mark itself
    // is left to the restore: deleting "every editable row" is what would take the user's
    // own actions with it if a seed had ever failed to run.
    await page.locator('[data-quick-actions-manager-close]').click()
    await expect(managerPanel(page)).toHaveCount(0)
    await ensureLayout(page, 'ribbon')
  })
})
