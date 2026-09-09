import { expect, test } from '@playwright/test'
import { manageEntry, managerPanel, openResidentComposer } from './support.js'

/**
 * Ticket 26: the management overlay must own its own pixels on the live shell.
 *
 * A `z-index` only ranks an element against its siblings in the same stacking
 * context, so while the overlay rendered inside the input dock, any ancestor
 * there that opened one capped it — ticket 21's acceptance found the shell's
 * sidebar width handle (`position: absolute; z-index: 8`) painting over the
 * panel's left edge and swallowing clicks aimed at the confirmation switch.
 *
 * The check is deliberately mechanism-blind: rather than naming that handle, it
 * hit-tests the centre of every control the panel renders and fails on any whose
 * centre belongs to an element outside the panel. That catches the next overlay
 * as well as this one, in whatever profile the round runs against.
 *
 * Nothing here is written or sent. Run it inside an install window:
 *   sh tests/gui/verify-round.sh stacking.spec.ts --project=desktop
 */
test.describe('management overlay stacking', () => {
  // The overlay is centred on the viewport, so it lands on different neighbours
  // at different widths; the narrow projects are as much a part of this as desktop.
  test('every control in the panel owns the pixel at its centre', async ({ page }, testInfo) => {
    await openResidentComposer(page)
    await manageEntry(page).click()
    await expect(managerPanel(page)).toBeVisible()

    // Open the edit form too: its 13 px confirmation checkbox is the smallest
    // target the panel has, and the one ticket 21 actually lost.
    const editable = managerPanel(page).locator('[data-quick-action^="custom:"]').first()
    if (await editable.count() > 0) {
      await editable.getByRole('button', { name: '编辑' }).click()
      await expect(page.locator('[data-quick-actions-form="edit"]')).toBeVisible()
    }

    const covered = await page.evaluate(() => {
      const panel = document.querySelector<HTMLElement>('[data-quick-actions-manager]')
      if (panel === null) throw new Error('the management overlay is not on the page')
      const report: string[] = []
      for (const control of panel.querySelectorAll<HTMLElement>('button, input, textarea')) {
        // The panel is a scroll container (`max-height` plus `overflow-y: auto`), so a
        // control below its fold is laid out but clipped: the pixel at its centre
        // belongs to whatever is behind the panel, and asking about it would report
        // the panel's own backdrop as an intruder. Bring each one into view first —
        // that is also the only way the 13 px checkbox at the bottom gets tested at all.
        control.scrollIntoView({ block: 'center' })
        const rect = control.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) continue
        const x = rect.x + rect.width / 2
        const y = rect.y + rect.height / 2
        // Still clipped after scrolling, or off screen: nothing to own.
        const panelBox = panel.getBoundingClientRect()
        if (y < panelBox.top || y > panelBox.bottom || x < panelBox.left || x > panelBox.right) continue
        if (y < 0 || y > window.innerHeight || x < 0 || x > window.innerWidth) continue
        const top = document.elementFromPoint(x, y)
        if (top === null) continue
        // The control itself, something inside it (a label span), or an ancestor
        // inside the panel are all fine; anything else is painting over it.
        if (top === control || control.contains(top) || panel.contains(top)) continue
        const name = (control.textContent ?? '').trim().slice(0, 20)
          || control.getAttribute('type')
          || control.tagName
        report.push(`${name} ← <${top.tagName} class="${top.className.toString().slice(0, 40)}">`)
      }
      return report
    })

    expect(covered, `${testInfo.project.name}: controls covered by something outside the panel`)
      .toEqual([])

    // And the panel really is on the body, not in the dock: the portal is what
    // puts its z-index in the page's own stacking context (ticket 26).
    const parent = await managerPanel(page).evaluate(element => element.parentElement?.tagName ?? 'none')
    expect(parent).toBe('BODY')
  })
})
