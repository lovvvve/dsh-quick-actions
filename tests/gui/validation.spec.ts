import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  customActionKeys,
  ensureLayout,
  layoutCell,
  manageEntry,
  managerPanel,
  openResidentComposer,
  removeCustomActionsAddedSince,
} from './support.js'

/**
 * The shared model's validation rules, exercised through the real form in the real browser
 * — spec 13.2's placeholder rejection and its Unicode code point / `trim()` conventions.
 *
 * Those rules are covered exhaustively at the model layer; what only the integration can
 * show is that the form the user actually types into runs that same implementation (spec
 * 4.3 requires one set of rules across config, form, migration and mutation), and that a
 * draft the form accepts is one the Host accepts on save.
 *
 * Desktop only: the form does not vary with width, and the responsive gates of spec 13.3
 * are measured in `surface.spec.ts` on the surfaces that do.
 */
test.describe('custom action validation', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1000, 'the form does not vary with viewport')

  /** Two UTF-16 code units per code point: this is what tells the two counts apart. */
  const ASTRAL = String.fromCodePoint(0x1d538)
  const LABEL_MAX = 40
  /** Whitespace to ECMAScript `trim()` — and to nothing simpler. */
  const NBSP = '\u00A0'
  const ZWNBSP = '\uFEFF'
  /**
   * DSH's reference placeholders: the published tail of the reserved range, and the first
   * code point of the private-use range it reserves ahead of it.
   */
  const OBJECT_REPLACEMENT = '\uFFFC'
  const RESERVED_PRIVATE_USE = '\u{E100}'

  const form = (page: Page): Locator => page.locator('[data-quick-actions-form="new"]')
  const labelInput = (page: Page): Locator => form(page).getByLabel('标签', { exact: true })
  const textInput = (page: Page): Locator => form(page).getByLabel('发送文本', { exact: true })
  const issue = (page: Page, field: 'label' | 'text'): Locator =>
    form(page).locator(`[data-quick-actions-issue="${field}"]`)
  const save = (page: Page): Locator => form(page).getByRole('button', { name: '保存' })
  const row = (page: Page, label: string): Locator =>
    managerPanel(page).locator('[data-quick-action]', { hasText: label })

  let baseline: string[] = []

  test.beforeEach(async ({ page }) => {
    await openResidentComposer(page)
    await ensureLayout(page, 'ribbon')
    baseline = await customActionKeys(page)
    await manageEntry(page).click()
    await managerPanel(page).locator('[data-quick-actions-new]').click()
    await expect(form(page)).toBeVisible()
  })

  test.afterEach(async ({ page }) => {
    if (await layoutCell(page).count() === 0) return
    // Through their own controls, both of them. Escape would do it when focus happens to be
    // in the right place, and when it is not it reaches DSH's composer — which listens for
    // Escape too, and clearing the user's draft is not this suite's to do.
    if (await form(page).count() > 0) await form(page).getByRole('button', { name: '取消' }).click()
    if (await managerPanel(page).count() > 0) {
      await page.locator('[data-quick-actions-manager-close]').click()
      await expect(managerPanel(page)).toHaveCount(0)
    }
    await removeCustomActionsAddedSince(page, baseline)
  })

  test('measures the label limit in Unicode code points, not UTF-16 units', async ({ page }) => {
    await labelInput(page).fill(ASTRAL.repeat(LABEL_MAX + 1))
    await expect(issue(page, 'label')).toHaveText('标签超出长度上限')

    // 40 code points are 80 UTF-16 units, so a `.length` limit would reject this label —
    // here, and again on the Host if the two ran different rules.
    const label = ASTRAL.repeat(LABEL_MAX)
    await labelInput(page).fill(label)
    await expect(issue(page, 'label')).toHaveCount(0)
    await textInput(page).fill('Unicode 口径验证文本')
    await save(page).click()

    await expect(form(page)).toHaveCount(0)
    await expect(row(page, label)).toHaveCount(1)
  })

  test('applies trim() whitespace to blankness and to the stored label', async ({ page }) => {
    const label = '口径裁剪验证'
    await labelInput(page).fill(` ${NBSP}${label} ${ZWNBSP}`)
    await textInput(page).fill(`${ZWNBSP} ${NBSP}\n`)
    // A blank field stays quiet until a save is attempted, so nothing is reported yet.
    await expect(issue(page, 'text')).toHaveCount(0)

    await save(page).click()

    await expect(issue(page, 'text')).toHaveText('发送文本至少要有一个非空白字符')
    // Refused inside the form, so it never became a write: no failure note, no action.
    await expect(managerPanel(page).locator('[data-quick-actions-write-failure]')).toHaveCount(0)
    await expect(row(page, label)).toHaveCount(0)

    // Text keeps its own whitespace and newlines; only the label is trimmed (spec 4.3).
    const text = '  第一行\n  第二行  '
    await textInput(page).fill(text)
    await save(page).click()
    await expect(form(page)).toHaveCount(0)

    const stored = row(page, label)
    await expect(stored).toHaveCount(1)
    // Read rather than matched: `toHaveText` normalizes the very whitespace under test.
    expect(await stored.locator('.dsh-cqa-label').textContent()).toBe(label)

    const edit = stored.getByRole('button', { name: '编辑' })
    await edit.click()
    const editing = page.locator('[data-quick-actions-form="edit"]')
    expect(await editing.getByLabel('发送文本', { exact: true }).inputValue()).toBe(text)

    // Ticket 25: the form takes the caret on open, so the first Escape is typed *inside*
    // it and leaves the form alone — before that fix it was still aimed at the row's Edit
    // button and closed the whole panel. Focus then returns to that button, inside the panel.
    await expect(editing.getByLabel('标签', { exact: true })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(editing).toHaveCount(0)
    await expect(managerPanel(page)).toBeVisible()
    await expect(edit).toBeFocused()
  })

  test('refuses a text holding a DSH-reserved reference placeholder', async ({ page }) => {
    const label = '占位符拒绝验证'
    await labelInput(page).fill(label)

    // `setDraft` strips both of these, so a static text carrying one is not the text it
    // claims to be — which is why spec 4.3 rejects it at the source instead.
    for (const placeholder of [OBJECT_REPLACEMENT, RESERVED_PRIVATE_USE]) {
      await textInput(page).fill(`引用 ${placeholder} 文本`)
      await expect(issue(page, 'text'))
        .toHaveText('发送文本包含 DSH 保留的引用占位符，无法作为静态文本提交')

      await save(page).click()

      // The draft survives a refused save (spec 10), and no write was ever made.
      await expect(form(page)).toBeVisible()
      await expect(managerPanel(page).locator('[data-quick-actions-write-failure]')).toHaveCount(0)
    }

    await expect(row(page, label)).toHaveCount(0)
  })
})
