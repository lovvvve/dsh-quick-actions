import { expect, test, type Locator, type Page } from '@playwright/test'
import {
  actionFaces,
  ensureLayout,
  manageEntry,
  managerPanel,
  openResidentComposer,
  storedNamespace,
} from './support.js'

/**
 * The full preset upgrade / downgrade round trip, at the GUI (spec 5.3, and spec 13.2's
 * "预置新增、文案更新、移除、重新加入和行为签名换 ID" row).
 *
 * `Config.presets` is the only authorized channel for a third-party preset and Host config
 * changes take effect on a profile restart, so each half of the round trip is a separate
 * boot: `tests/gui/presets-round.sh` drives four of them, with the stored state carried
 * across by the user's own Settings file — which is the thing under test. The overlays go
 * through `dsh --patch` rather than the user's `cordis.patch.yml`.
 *
 * Phases, in the order the round runs them:
 *
 * | phase       | catalog                          | what it proves                        |
 * |-------------|----------------------------------|---------------------------------------|
 * | `stage`     | packaged 3 + probe (confirm on)  | a new preset joins, is clonable, hides |
 * | `tombstone` | packaged 3                       | removal keeps state, drops the count  |
 * | `restore`   | packaged 3 + probe, new label    | re-adding restores the preference     |
 * | `signature` | packaged 3 + probe v2 (off)      | a changed signature is a new ID       |
 */
// No retries: every phase writes to the user's Settings and the next one reads it back, so
// a second attempt on the same profile starts from the state the first one left — a clone
// already made, a preset already hidden. A failed phase is re-run from the seed, by the
// round, not by Playwright.
test.describe.configure({ retries: 0 })

const phase = process.env.DSH_QA_PRESETS
const PROBE = 'preset:qa-preset-probe'
const PROBE_V2 = 'preset:qa-preset-probe-v2'
const PROBE_LABEL = '预置往返验证'
const PROBE_LABEL_UPDATED = '预置往返验证已改名'
const PROBE_V2_LABEL = '预置往返验证第二代'

/** Custom rows only — a clone shares its source preset's label, so labels cannot select it. */
function cloneRows(page: Page): Locator {
  return managerPanel(page).locator('[data-quick-action^="custom:"]')
}

function presetRow(page: Page, key: string): Locator {
  return managerPanel(page).locator(`[data-quick-action="${key}"]`)
}

/** Face labels in projection order, whitespace-collapsed for comparison. */
function faceLabels(page: Page): Promise<string[]> {
  return actionFaces(page).evaluateAll(elements => elements.map(
    element => (element.textContent ?? '').replace(/\s+/g, ''),
  ))
}

/**
 * Whether the confirmation switch of a clone's edit form is on. A preset's own `confirm`
 * is not editable and has no control of its own, so a clone — which copies the policy at
 * the moment it is made (spec 5.2) — is how the GUI can be asked what it was.
 */
async function clonedConfirm(page: Page): Promise<boolean> {
  await cloneRows(page).first().getByRole('button', { name: '编辑' }).click()
  const form = page.locator('[data-quick-actions-form="edit"]')
  await expect(form).toBeVisible()
  const on = await form.locator('[data-quick-actions-confirm-switch]').isChecked()
  // Cancel, not Escape: the form does not take initial focus, so a keystroke right after
  // opening it is still aimed at the row's Edit button — outside the form — and reaches the
  // panel's own Escape handler, closing the whole overlay. Recorded as a finding in the
  // ticket 18 evidence; the control is unambiguous either way.
  await form.getByRole('button', { name: '取消' }).click()
  await expect(form).toHaveCount(0)
  return on
}

test.describe('a preset joining the catalog', () => {
  test.skip(phase !== 'stage', 'run through tests/gui/presets-round.sh')

  test('is clonable with its confirmation policy, and hideable', async ({ page }) => {
    await openResidentComposer(page)
    await ensureLayout(page, 'ribbon')

    // Appended after the packaged three (spec 5.3), on a namespace seeded with those three.
    await expect(actionFaces(page)).toHaveCount(4)
    expect((await faceLabels(page)).at(-1)).toContain(PROBE_LABEL)

    await manageEntry(page).click()
    await expect(presetRow(page, PROBE)).toHaveCount(1)
    await presetRow(page, PROBE).locator('[data-quick-actions-clone]').click()
    await expect(cloneRows(page)).toHaveCount(1)
    // The clone copies the preset's policy rather than re-applying the default, and this
    // preset declares the default `true`, so the two are told apart by the v2 phase.
    expect(await clonedConfirm(page)).toBe(true)

    // Hiding is one of the three things a user may do to a preset, and it is the
    // preference the removal / re-add round trip has to carry.
    await presetRow(page, PROBE).getByRole('button', { name: '隐藏' }).click()
    await expect(presetRow(page, PROBE)).toHaveAttribute('data-quick-action-hidden', '')
    await expect(managerPanel(page).locator('[data-quick-actions-count]')).toContainText('共 5')

    await page.locator('[data-quick-actions-manager-close]').click()
    // Hidden means hidden: the clone shows, its source does not.
    await expect(actionFaces(page)).toHaveCount(4)
  })
})

test.describe('a preset leaving the catalog', () => {
  test.skip(phase !== 'tombstone', 'run through tests/gui/presets-round.sh')

  test('keeps its stored state as a tombstone that is neither shown nor counted', async ({ page }) => {
    await openResidentComposer(page)
    await ensureLayout(page, 'ribbon')

    // The packaged three plus the clone. The clone is the user's own action now and does
    // not follow its source (spec 5.2), so removing the preset must not touch it.
    await expect(actionFaces(page)).toHaveCount(4)

    await manageEntry(page).click()
    await expect(presetRow(page, PROBE)).toHaveCount(0)
    await expect(cloneRows(page)).toHaveCount(1)
    await expect(cloneRows(page)).not.toHaveAttribute('data-quick-action-hidden', '')
    // A preset the current catalog does not know is not part of the total (spec 5.4).
    await expect(managerPanel(page).locator('[data-quick-actions-count]')).toContainText('共 4')

    // The other half of the claim, and the half no projection can show: the preference and
    // its order reference are still in the stored state, having survived a normalizing
    // rewrite by a Host whose catalog no longer holds that ID (spec 5.3).
    const stored = storedNamespace()
    expect(stored.presetStateById?.['qa-preset-probe']).toEqual({ hidden: true })
    expect(stored.actionOrder).toContainEqual({ source: 'preset', id: 'qa-preset-probe' })
  })
})

test.describe('a preset re-entering the catalog', () => {
  test.skip(phase !== 'restore', 'run through tests/gui/presets-round.sh')

  test('comes back updated and still carries the preference it left with', async ({ page }) => {
    await openResidentComposer(page)
    await ensureLayout(page, 'ribbon')

    // Still hidden, so the projection is unchanged by its return: the round trip is
    // lossless in both directions (spec 5.3).
    await expect(actionFaces(page)).toHaveCount(4)

    await manageEntry(page).click()
    await expect(presetRow(page, PROBE)).toHaveAttribute('data-quick-action-hidden', '')
    // Same ID, new label: an upgrade may update the label, icon and text (spec 5.1).
    await expect(presetRow(page, PROBE).locator('.dsh-cqa-label')).toHaveText(PROBE_LABEL_UPDATED)
    await expect(managerPanel(page).locator('[data-quick-actions-count]')).toContainText('共 5')

    // Restoring it is what makes the next phase's projection unambiguous.
    await presetRow(page, PROBE).getByRole('button', { name: '恢复' }).click()
    await expect(presetRow(page, PROBE)).not.toHaveAttribute('data-quick-action-hidden', '')
    await page.locator('[data-quick-actions-manager-close]').click()
    await expect(actionFaces(page)).toHaveCount(5)
  })
})

test.describe('a preset changing its behaviour signature', () => {
  test.skip(phase !== 'signature', 'run through tests/gui/presets-round.sh')

  test('arrives as a new ID whose policy is its own', async ({ page }) => {
    await openResidentComposer(page)
    await ensureLayout(page, 'ribbon')

    // The old ID is gone, so it is a tombstone again — the stored state of the two never
    // meets, which is the reason spec 5.1 requires a new ID for a changed signature.
    await expect(actionFaces(page)).toHaveCount(5)
    const labels = await faceLabels(page)
    expect(labels.at(-1)).toContain(PROBE_V2_LABEL)
    expect(labels.join()).not.toContain(PROBE_LABEL_UPDATED)

    await manageEntry(page).click()
    await expect(presetRow(page, PROBE)).toHaveCount(0)
    await expect(presetRow(page, PROBE_V2)).toHaveCount(1)

    // `confirm: false` is declared on the new ID, and the clone reads it back off the
    // catalog rather than from the preference the old ID left behind.
    await presetRow(page, PROBE_V2).locator('[data-quick-actions-clone]').click()
    await expect(cloneRows(page)).toHaveCount(2)
    await cloneRows(page).nth(1).getByRole('button', { name: '编辑' }).click()
    const form = page.locator('[data-quick-actions-form="edit"]')
    await expect(form.locator('[data-quick-actions-confirm-switch]')).not.toBeChecked()
    await form.getByRole('button', { name: '取消' }).click()
  })
})
