import { expect, test } from '@playwright/test'
import { actionFaces, composerBoxEdges, composerInput, edges, ensureLayout, layoutCell, manageEntry, openResidentComposer } from './support.js'

/**
 * The plugin's surface at a Resident Composer, on the live GUI: what spec section 13.3
 * calls the equal-width rule, the packaged catalog, the official leaf controls and the
 * narrow-viewport behaviour. Nothing here submits anything.
 */
test.describe('quick actions surface', () => {
  test.beforeEach(async ({ page }) => {
    await openResidentComposer(page)
    // Layout persists globally, so state it rather than inheriting the previous spec's.
    await ensureLayout(page, 'ribbon')
  })

  test('renders the packaged preset catalog', async ({ page }) => {
    // Presets reach the Client through the read-only catalog namespace's composition
    // `base` layer, so their presence here is the end-to-end proof of that path.
    await expect(actionFaces(page)).toHaveCount(3)

    const names = await actionFaces(page).evaluateAll(
      elements => elements.map(element => (element.textContent ?? '').replace(/\s+/g, '')),
    )
    expect(names.join('|')).toContain('总结对话')
    expect(names.join('|')).toContain('解释改动')
    expect(names.join('|')).toContain('压缩上下文')
  })

  test('renders the ribbon layout with a manage entry', async ({ page }) => {
    await expect(layoutCell(page)).toHaveAttribute('data-quick-actions-layout', 'ribbon')
    await expect(manageEntry(page)).toHaveCount(1)
  })

  test('matches the composer input box edges within 1 CSS px', async ({ page }) => {
    // The reference is the composer's bordered box, found by climbing from the *input* to
    // the first wider ancestor (see `composerBoxEdges`): DSH's class names are hashed per
    // build, so addressing them directly would rot.
    //
    // Both sides stay fractional. Rounding each one first turns this stated 1 CSS px gate
    // into anywhere from 0 to 2 px, which would let a real 1.4 px violation read as
    // compliant.
    const cell = await edges(layoutCell(page))
    const reference = await composerBoxEdges(page)

    expect(Math.abs(cell.left - reference.left), `left ${cell.left} vs ${reference.left}`).toBeLessThanOrEqual(1)
    expect(Math.abs(cell.right - reference.right), `right ${cell.right} vs ${reference.right}`).toBeLessThanOrEqual(1)
  })

  test('leaf controls are the official DSH primitives', async ({ page }) => {
    // Primitives ship CSS Modules, so their classes are hashed (`_button_<hash>_<line>`)
    // while this plugin's own classes carry the `dsh-cqa-` prefix. Both on one element is
    // what proves the module-table `require` resolved to the real `Button`.
    const classes = await actionFaces(page).first().getAttribute('class')

    expect(classes).toMatch(/_button_[a-z0-9]+_\d+/)
    expect(classes).toContain('dsh-cqa-action')
  })

  test('stays inside the composer box and the viewport', async ({ page }, testInfo) => {
    const cell = await edges(layoutCell(page))
    const input = await edges(composerInput(page))
    const viewport = page.viewportSize()!

    expect(cell.left, `${testInfo.project.name}: overflows left`).toBeGreaterThanOrEqual(0)
    expect(cell.right, `${testInfo.project.name}: overflows right`).toBeLessThanOrEqual(viewport.width)
    // The surface tracks the input, so it must not be wider than the input's own box by
    // more than the composer border it sits inside.
    expect(Math.abs(cell.width - input.width)).toBeLessThanOrEqual(8)
  })
})
