import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  actionFaces,
  composerBoxEdges,
  composerInput,
  edges,
  ensureLayout,
  enterSession,
  layoutCell,
  manageEntry,
  managerPanel,
  openResidentComposer,
  storedNamespace,
} from './support.js'

/**
 * Spec section 13.4, the final acceptance, driven step by step on the live GUI for ticket 21
 * when the user asks the agent to run it on their behalf. Every observation is printed with an
 * `ACCEPT:` prefix so the round can lift it into the evidence, and every picture is clipped to
 * a surface of this plugin (section 13.1 forbids the user's conversation in the evidence).
 *
 * Driven by `tests/gui/acceptance-round.sh`. The `walk` phase covers steps 2, 3, 4, 5 and 8 plus
 * the page refresh of step 6 in one browser session; `restarted` is step 6 after a profile
 * restart; `gone` and `back` are the two halves of step 7. The phases skip at group level so a
 * plain `verify:gui` run never submits anything or uninstalls anything.
 *
 * No real model turn is spent: the two submits of step 4 and the empty-draft send of step 5
 * use a Command Send Action whose command is unknown, which DSH adjudicates itself (ticket 18,
 * round 3). The normal-text send stays with the user, as section 13.4 requires.
 */
test.describe.configure({ retries: 0 })

const phase = process.env.DSH_QA_ACCEPTANCE
const shots = process.env.DSH_QA_SHOTS ?? '.scratch/dsh-composer-quick-actions/verification/acceptance-21'

const NORMAL_LABEL = '验收普通发送'
const NORMAL_LABEL_EDITED = '验收普通发送（已编辑）'
const NORMAL_TEXT = '验收：这是一条普通发送文本，保留原样。'
const COMMAND_LABEL = '验收命令动作'
const COMMAND_TEXT = '/qa-acceptance-unknown-command'
const OCCUPYING_DRAFT = '占用草稿：用户正在输入的内容'

function note(message: string): void {
  console.log(`ACCEPT: ${message}`)
}

async function shot(locator: Locator, name: string): Promise<void> {
  mkdirSync(shots, { recursive: true })
  await locator.screenshot({ path: join(shots, `${name}.png`) })
  note(`截图 ${name}.png`)
}

const row = (page: Page, label: string): Locator =>
  managerPanel(page).locator('[data-quick-action]', { hasText: label })
const face = (page: Page, label: string): Locator => actionFaces(page).filter({ hasText: label })
const confirmPanel = (page: Page): Locator => page.locator('[data-quick-actions-confirm]')
const sentByUser = (page: Page, text: string): Locator =>
  page.locator('[data-chat-flow-kind="user"]', { hasText: text })
const count = (page: Page): Locator => managerPanel(page).locator('[data-quick-actions-count]')

async function openManager(page: Page): Promise<void> {
  if (await managerPanel(page).count() > 0) return
  await manageEntry(page).click()
  await expect(managerPanel(page)).toBeVisible()
}

async function closeManager(page: Page): Promise<void> {
  if (await managerPanel(page).count() === 0) return
  await page.locator('[data-quick-actions-manager-close]').click()
  await expect(managerPanel(page)).toHaveCount(0)
}

async function faceLabels(page: Page): Promise<string[]> {
  return actionFaces(page).evaluateAll(elements =>
    elements.map(element => (element.textContent ?? '').replace(/\s+/g, '')))
}

/**
 * Toggle one action's confirmation through its label text, which is the interaction a user
 * has: the shell's sidebar width handle overlays the 13 px native box at this viewport, so
 * Playwright refuses to click the input itself (diagnosed in `switch-diagnose.spec.ts`).
 * Clicking the label — or Tab plus Space — toggles it, and both were checked by hand.
 */
async function setConfirm(page: Page, label: string, on: boolean): Promise<void> {
  await openManager(page)
  await row(page, label).getByRole('button', { name: '编辑' }).click()
  const form = page.locator('[data-quick-actions-form="edit"]')
  await expect(form).toBeVisible()
  const box = form.locator('[data-quick-actions-confirm-switch]')
  if (await box.isChecked() !== on) {
    await form.locator('.dsh-cqa-switch .dsh-cqa-field-label').click()
    await expect(box).toBeChecked({ checked: on })
  }
  await form.getByRole('button', { name: '保存' }).click()
  await expect(form).toHaveCount(0)
  await closeManager(page)
}

test.describe('final acceptance walk', () => {
  test.skip(phase !== 'walk', 'run through tests/gui/acceptance-round.sh')
  test.setTimeout(900_000)

  test('steps 2, 3, 4, 5, 8 and the refresh of step 6', async ({ page }) => {
    await openResidentComposer(page)
    await ensureLayout(page, 'ribbon')
    await expect(actionFaces(page)).toHaveCount(3)
    note(`步骤 1：安装后的 Resident Composer 上有 ${await actionFaces(page).count()} 条随包预置：${(await faceLabels(page)).join(' | ')}`)

    // ---- Step 2: create, edit, reorder, disable, hide, clone ----------------------------
    await openManager(page)
    await expect(managerPanel(page)).toHaveRole('dialog')
    await expect(managerPanel(page)).toHaveAccessibleName('管理快捷动作')
    await managerPanel(page).locator('[data-quick-actions-new]').click()
    const newForm = page.locator('[data-quick-actions-form="new"]')
    await expect(newForm).toBeVisible()
    await expect(newForm.getByLabel('标签', { exact: true })).toBeFocused()
    await newForm.getByLabel('标签', { exact: true }).fill(NORMAL_LABEL)
    await newForm.getByLabel('发送文本', { exact: true }).fill(NORMAL_TEXT)
    await expect(newForm.locator('[data-quick-actions-command-warning]')).toHaveCount(0)
    note(`步骤 2：普通发送动作的「发送前确认」默认为 ${await newForm.locator('[data-quick-actions-confirm-switch]').isChecked() ? '开' : '关'}`)
    await newForm.getByRole('button', { name: '保存' }).click()
    await expect(newForm).toHaveCount(0)
    await expect(row(page, NORMAL_LABEL)).toHaveCount(1)
    await expect(row(page, NORMAL_LABEL).getByText('自定义', { exact: true })).toBeVisible()

    await managerPanel(page).locator('[data-quick-actions-new]').click()
    await expect(newForm).toBeVisible()
    await newForm.getByLabel('标签', { exact: true }).fill(COMMAND_LABEL)
    await newForm.getByLabel('发送文本', { exact: true }).fill(COMMAND_TEXT)
    await expect(newForm.locator('[data-quick-actions-command-warning]')).toBeVisible()
    await expect(newForm.locator('[data-quick-actions-command-warning]')).toContainText('候选菜单')
    // Step 4's first half: a Command Send Action defaults to confirmation on.
    await expect(newForm.locator('[data-quick-actions-confirm-switch]')).toBeChecked()
    note('步骤 4：命令发送动作的表单出现命令警示，「发送前确认」默认为开')
    await shot(newForm, 'form-command-new')
    await newForm.getByRole('button', { name: '保存' }).click()
    await expect(newForm).toHaveCount(0)
    await expect(row(page, COMMAND_LABEL)).toHaveCount(1)
    await expect(row(page, COMMAND_LABEL).getByText('命令', { exact: true })).toBeVisible()
    await expect(count(page)).toContainText('共 5 / 50 项')

    // Edit: the label changes, the text stays.
    await row(page, NORMAL_LABEL).getByRole('button', { name: '编辑' }).click()
    const editForm = page.locator('[data-quick-actions-form="edit"]')
    await expect(editForm).toBeVisible()
    await expect(editForm.getByLabel('标签', { exact: true })).toBeFocused()
    expect(await editForm.getByLabel('发送文本', { exact: true }).inputValue()).toBe(NORMAL_TEXT)
    await editForm.getByLabel('标签', { exact: true }).fill(NORMAL_LABEL_EDITED)
    await editForm.getByRole('button', { name: '保存' }).click()
    await expect(editForm).toHaveCount(0)
    await expect(row(page, NORMAL_LABEL_EDITED)).toHaveCount(1)
    note('步骤 2：编辑——标签改名后行与按钮同步更新，发送文本原样保留')

    // Reorder: the command action climbs one place, in the manager and on the surface.
    const before = await managerPanel(page).locator('[data-quick-action] .dsh-cqa-label').allTextContents()
    await row(page, COMMAND_LABEL).locator('[data-quick-actions-move="up"]').click()
    await expect.poll(async () =>
      managerPanel(page).locator('[data-quick-action] .dsh-cqa-label').allTextContents(),
    ).not.toEqual(before)
    const after = await managerPanel(page).locator('[data-quick-action] .dsh-cqa-label').allTextContents()
    expect(after.indexOf(COMMAND_LABEL)).toBe(before.indexOf(COMMAND_LABEL) - 1)
    // Keyboard reorder keeps focus on the control that moved (spec 8.3).
    await expect(row(page, COMMAND_LABEL).locator('[data-quick-actions-move="up"]')).toBeFocused()
    note(`步骤 2：排序——上移后顺序 ${after.join(' > ')}，焦点仍在该行的「上移」`)

    // Disable and enable: the face leaves the surface and comes back.
    await row(page, NORMAL_LABEL_EDITED).getByRole('button', { name: '停用' }).click()
    await expect(row(page, NORMAL_LABEL_EDITED).getByText('已停用', { exact: true })).toBeVisible()
    await expect(count(page)).toContainText('共 5 / 50 项')
    await closeManager(page)
    await expect(face(page, NORMAL_LABEL_EDITED)).toHaveCount(0)
    await expect(actionFaces(page)).toHaveCount(4)
    await openManager(page)
    await row(page, NORMAL_LABEL_EDITED).getByRole('button', { name: '启用' }).click()
    await expect(row(page, NORMAL_LABEL_EDITED).getByText('已停用', { exact: true })).toHaveCount(0)
    await closeManager(page)
    await expect(face(page, NORMAL_LABEL_EDITED)).toHaveCount(1)
    note('步骤 2：停用——动作离开表面但仍计数；启用后回到表面')

    // Hide and restore a preset.
    await openManager(page)
    const preset = managerPanel(page).locator('[data-quick-action^="preset:"]').first()
    const presetLabel = (await preset.locator('.dsh-cqa-label').textContent()) ?? ''
    await preset.getByRole('button', { name: '隐藏' }).click()
    await expect(preset).toHaveAttribute('data-quick-action-hidden', '')
    await expect(count(page)).toContainText('共 5 / 50 项')
    await closeManager(page)
    await expect(face(page, presetLabel)).toHaveCount(0)
    await openManager(page)
    await preset.getByRole('button', { name: '恢复' }).click()
    await expect(preset).not.toHaveAttribute('data-quick-action-hidden', '')
    await closeManager(page)
    await expect(face(page, presetLabel)).toHaveCount(1)
    note(`步骤 2：隐藏——预置「${presetLabel}」隐藏后离开表面但仍计数；恢复后回来`)

    // Clone a preset: an editable copy carrying the preset's text.
    await openManager(page)
    await preset.locator('[data-quick-actions-clone]').click()
    const clone = managerPanel(page).locator('[data-quick-action^="custom:"]', { hasText: '克隆自预置' })
    await expect(clone).toHaveCount(1)
    await expect(clone.getByRole('button', { name: '编辑' })).toBeVisible()
    await expect(count(page)).toContainText('共 6 / 50 项')
    await shot(managerPanel(page), 'manager-desktop')
    await closeManager(page)
    await expect(actionFaces(page)).toHaveCount(6)
    note('步骤 2：克隆——预置克隆为带「克隆自预置」标记的可编辑自定义动作，共 6 / 50 项')

    // ---- Step 3: three layouts, equal width, three viewports ----------------------------
    for (const layout of ['ribbon', 'bar', 'launcher'] as const) {
      await page.setViewportSize({ width: 1440, height: 900 })
      await ensureLayout(page, layout)
      for (const width of [1440, 768, 360]) {
        await page.setViewportSize({ width, height: width < 1000 ? 780 : 900 })
        await expect(layoutCell(page)).toBeVisible()
        const cell = await edges(layoutCell(page))
        const reference = await composerBoxEdges(page)
        const left = Math.abs(cell.left - reference.left)
        const right = Math.abs(cell.right - reference.right)
        expect(cell.left).toBeGreaterThanOrEqual(0)
        expect(cell.right).toBeLessThanOrEqual(width)
        if (layout !== 'launcher') {
          expect(left, `${layout}@${width} left`).toBeLessThanOrEqual(1)
          expect(right, `${layout}@${width} right`).toBeLessThanOrEqual(1)
        }
        const density = await layoutCell(page).getAttribute('data-quick-actions-density')
        const more = page.locator('[data-quick-actions-entry="bar"]')
        const moreText = layout === 'bar' && await more.count() > 0 ? await more.textContent() : ''
        note(`步骤 3：${layout} @ ${width}px 左右边界误差 ${left.toFixed(2)} / ${right.toFixed(2)} px，density=${density}${moreText ? `，溢出入口「${moreText.trim()}」` : ''}`)
        await shot(layoutCell(page), `${layout}-${width}`)
        if (layout === 'launcher') {
          await page.locator('[data-quick-actions-entry="launcher"]').click()
          const panel = page.locator('[data-quick-actions-panel]')
          await expect(panel).toBeVisible()
          await expect(panel).toHaveRole('dialog')
          await expect(page.locator('[data-quick-actions-search]')).toBeFocused()
          await expect(page.locator('[data-quick-actions-search]')).toHaveAccessibleName('搜索快捷动作')
          await expect(panel.locator('[data-quick-action]')).toHaveCount(6)
          await shot(panel, `launcher-panel-${width}`)
          await page.keyboard.press('Escape')
          await expect(panel).toHaveCount(0)
          await expect(page.locator('[data-quick-actions-entry="launcher"]')).toBeFocused()
        }
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 })
    await ensureLayout(page, 'ribbon')

    // ---- Step 5 first: an occupied draft disables activation ---------------------------
    await composerInput(page).fill(OCCUPYING_DRAFT)
    for (const element of await actionFaces(page).all()) {
      await expect(element).toBeDisabled()
      expect(await element.getAttribute('title')).toContain('草稿中已有内容')
    }
    await face(page, COMMAND_LABEL).click({ force: true })
    await expect(confirmPanel(page)).toHaveCount(0)
    await expect(composerInput(page)).toHaveText(OCCUPYING_DRAFT)
    await shot(layoutCell(page), 'occupied-draft')
    await composerInput(page).fill('')
    for (const element of await actionFaces(page).all()) await expect(element).toBeEnabled()
    note('步骤 5：占用草稿——全部动作禁用并以 title 说明原因，强制点击不发送、草稿原样；清空后恢复可用')

    // ---- Step 4 + 5: the confirm panel on a command, cancel, keyboard, send -------------
    await expect(composerInput(page)).toHaveText('')
    const commandSent = await sentByUser(page, COMMAND_TEXT).count()
    await face(page, COMMAND_LABEL).click()
    await expect(confirmPanel(page)).toBeVisible()
    await expect(confirmPanel(page)).toHaveRole('dialog')
    await expect(confirmPanel(page)).toHaveAttribute('aria-modal', 'true')
    await expect(confirmPanel(page)).toHaveAccessibleName('确认发送')
    await expect(confirmPanel(page)).toContainText(COMMAND_TEXT)
    await expect(confirmPanel(page).locator('[data-quick-actions-command-notice]')).toContainText('候选菜单')
    await expect(confirmPanel(page).locator('[data-quick-actions-confirm-send]')).toBeFocused()
    await shot(confirmPanel(page), 'confirm-command')
    await confirmPanel(page).getByRole('button', { name: '取消' }).click()
    await expect(confirmPanel(page)).toHaveCount(0)
    await expect(sentByUser(page, COMMAND_TEXT)).toHaveCount(commandSent)
    await expect(composerInput(page)).toHaveText('')
    await expect(face(page, COMMAND_LABEL)).toBeFocused()
    note('步骤 4/5：确认面板——dialog + aria-modal + 名称「确认发送」，逐字预览命令，含无候选菜单说明，开场焦点在「发送」；取消后零发送、草稿为空、焦点回到动作')

    await face(page, COMMAND_LABEL).click()
    await expect(confirmPanel(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(confirmPanel(page)).toHaveCount(0)
    await expect(sentByUser(page, COMMAND_TEXT)).toHaveCount(commandSent)
    note('步骤 8：键盘——Escape 关闭确认面板且不发送')

    await face(page, COMMAND_LABEL).click()
    await expect(confirmPanel(page)).toBeVisible()
    await confirmPanel(page).locator('[data-quick-actions-confirm-send]').click()
    await expect(confirmPanel(page)).toHaveCount(0)
    await expect(sentByUser(page, COMMAND_TEXT)).toHaveCount(commandSent + 1, { timeout: 30_000 })
    const alert = page.locator('body > [role="alert"]')
    const alertText = await alert.first().textContent({ timeout: 5_000 }).catch(() => null)
    await expect(layoutCell(page).locator('[data-quick-actions-feedback]')).toHaveCount(0)
    await expect(composerInput(page)).toHaveText('')
    note(`步骤 4/5：确认发送（空草稿）——命令提交一次，由 DSH 裁决未知命令，插件无二次反馈；DSH 提示：${alertText === null ? '无 toast' : `「${alertText.trim()}」`}`)

    // Confirmation off: one click, no panel, adjudicated by DSH all the same.
    await setConfirm(page, COMMAND_LABEL, false)
    await face(page, COMMAND_LABEL).click()
    await expect(sentByUser(page, COMMAND_TEXT)).toHaveCount(commandSent + 2, { timeout: 30_000 })
    await expect(confirmPanel(page)).toHaveCount(0)
    await expect(composerInput(page)).toHaveText('')
    note('步骤 4：关闭确认后一键提交，面板不出现，DSH 照常裁决')

    // The normal action's confirm panel: no command notice. Nothing is sent from it.
    await setConfirm(page, NORMAL_LABEL_EDITED, true)
    await face(page, NORMAL_LABEL_EDITED).click()
    await expect(confirmPanel(page)).toBeVisible()
    await expect(confirmPanel(page)).toContainText(NORMAL_TEXT)
    await expect(confirmPanel(page).locator('[data-quick-actions-command-notice]')).toHaveCount(0)
    await shot(confirmPanel(page), 'confirm-normal')
    await confirmPanel(page).getByRole('button', { name: '取消' }).click()
    await expect(confirmPanel(page)).toHaveCount(0)
    await expect(sentByUser(page, NORMAL_TEXT)).toHaveCount(0)
    note('步骤 5：普通发送动作的确认面板无命令说明；取消后零发送（真实发送留给用户）')

    // ---- Step 8: error messages, keyboard flow, accessible names -------------------------
    await openManager(page)
    await managerPanel(page).locator('[data-quick-actions-new]').click()
    await expect(newForm).toBeVisible()
    await newForm.getByLabel('发送文本', { exact: true }).fill('只填了文本')
    await newForm.getByRole('button', { name: '保存' }).click()
    await expect(newForm.locator('[data-quick-actions-issue="label"]')).toHaveText('请填写标签')
    await expect(newForm.getByLabel('标签', { exact: true })).toHaveAttribute('aria-invalid', 'true')
    await newForm.getByLabel('标签', { exact: true }).fill('x')
    await newForm.getByLabel('发送文本', { exact: true }).fill('')
    await newForm.getByRole('button', { name: '保存' }).click()
    await expect(newForm.locator('[data-quick-actions-issue="text"]')).toHaveText('发送文本至少要有一个非空白字符')
    await shot(newForm, 'form-errors')
    await expect(managerPanel(page).locator('[data-quick-actions-write-failure]')).toHaveCount(0)
    note('步骤 8：错误信息——空标签与空文本各给出字段级提示并标 aria-invalid，未产生写入')

    // Escape is scoped: the form first, then the panel, and focus returns each time. Focus is
    // on the save button just clicked — inside the form, which is what scoping is about.
    await expect.poll(async () => newForm.evaluate(form => form.contains(document.activeElement)))
      .toBe(true)
    await page.keyboard.press('Escape')
    await expect(newForm).toHaveCount(0)
    await expect(managerPanel(page)).toBeVisible()
    await expect(managerPanel(page).locator('[data-quick-actions-new]')).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(managerPanel(page)).toHaveCount(0)
    await expect(manageEntry(page)).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(managerPanel(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(managerPanel(page)).toHaveCount(0)
    note('步骤 8：键盘——表单内 Escape 只退表单并把焦点还给「新建」，再按一次关面板并回到「管理」，Enter 可重新打开')

    // Tab order across the faces.
    await actionFaces(page).first().focus()
    await page.keyboard.press('Tab')
    await expect(actionFaces(page).nth(1)).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(actionFaces(page).first()).toBeFocused()
    note('步骤 8：键盘——Tab / Shift+Tab 在动作之间顺序移动')

    // Accessible names.
    // The name is the visible label, plus the "命令" badge where the action carries one — the
    // icon is decoration and stays out of it (spec 8.4).
    for (const element of await actionFaces(page).all()) {
      const label = ((await element.locator('.dsh-cqa-label').textContent()) ?? '').trim()
      const badge = await element.locator('.dsh-cqa-badge').count() > 0
      await expect(element).toHaveAccessibleName(badge ? `${label} 命令` : label)
    }
    await expect(manageEntry(page)).toHaveAccessibleName('管理')
    expect(await manageEntry(page).getAttribute('title')).toBe('管理快捷动作')
    await expect(actionFaces(page).locator('.dsh-cqa-icon').first()).toHaveAttribute('aria-hidden', 'true')
    note('步骤 8：无障碍名称——每个动作的名称等于其标签，图标 aria-hidden，「管理」有名称与 tooltip')

    // ---- Step 6 (first half): refresh the page ---------------------------------------
    await ensureLayout(page, 'bar')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(layoutCell(page)).toHaveAttribute('data-quick-actions-layout', 'bar', { timeout: 30_000 })
    await openManager(page)
    await expect(row(page, NORMAL_LABEL_EDITED)).toHaveCount(1)
    await expect(row(page, COMMAND_LABEL)).toHaveCount(1)
    await expect(clone).toHaveCount(1)
    await expect(count(page)).toContainText('共 6 / 50 项')
    await closeManager(page)
    const stored = storedNamespace()
    expect(stored.layout).toBe('bar')
    const labels = Object.values(stored.userActionsById ?? {}).map(action => action.label)
    expect(labels).toContain(NORMAL_LABEL_EDITED)
    expect(labels).toContain(COMMAND_LABEL)
    note(`步骤 6：刷新页面后布局 bar 与 6 项动作原样；settings.yaml 中 layout=${stored.layout}，自定义动作 ${labels.length} 条`)
  })
})

test.describe('after a DSH restart', () => {
  test.skip(phase !== 'restarted', 'run through tests/gui/acceptance-round.sh')

  test('step 6: the settings come back', async ({ page }) => {
    await openResidentComposer(page)
    await expect(layoutCell(page)).toHaveAttribute('data-quick-actions-layout', 'bar')
    await openManager(page)
    await expect(row(page, NORMAL_LABEL_EDITED)).toHaveCount(1)
    await expect(row(page, COMMAND_LABEL)).toHaveCount(1)
    await expect(count(page)).toContainText('共 6 / 50 项')
    await shot(managerPanel(page), 'manager-after-restart')
    await closeManager(page)
    note('步骤 6：重启 DSH 后布局 bar、两条自定义动作与克隆均恢复，共 6 / 50 项')
  })
})

test.describe('while uninstalled', () => {
  test.skip(phase !== 'gone', 'run through tests/gui/acceptance-round.sh')

  test('step 7: the UI is gone and the data stays', async ({ page }) => {
    await enterSession(page, 'history')
    await expect(layoutCell(page)).toHaveCount(0)
    await expect(manageEntry(page)).toHaveCount(0)
    const styleTags = await page.evaluate(
      () => [...document.querySelectorAll('style')].filter(tag => (tag.textContent ?? '').includes('dsh-cqa-')).length,
    )
    expect(styleTags).toBe(0)
    const stored = storedNamespace()
    expect(stored.layout).toBe('bar')
    expect(Object.values(stored.userActionsById ?? {}).map(action => action.label)).toContain(COMMAND_LABEL)
    note('步骤 7：卸载并重启后，有历史的会话里插件零渲染、零样式；settings.yaml 的命名空间原样保留')
  })
})

test.describe('after the reinstall', () => {
  test.skip(phase !== 'back', 'run through tests/gui/acceptance-round.sh')

  test('step 7: the configuration is back', async ({ page }) => {
    await openResidentComposer(page)
    await expect(layoutCell(page)).toHaveAttribute('data-quick-actions-layout', 'bar')
    await openManager(page)
    await expect(row(page, NORMAL_LABEL_EDITED)).toHaveCount(1)
    await expect(row(page, COMMAND_LABEL)).toHaveCount(1)
    await expect(count(page)).toContainText('共 6 / 50 项')
    await closeManager(page)
    note('步骤 7：重新安装并重启后布局与全部 6 项动作恢复')
  })
})
