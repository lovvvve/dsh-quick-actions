import { expect, type Locator, type Page, type Response } from '@playwright/test'

/**
 * `dsh web` prints its entry URL with a `token` query parameter, and redeeming that
 * token is what gives a browser profile its credential — a bare `/` answers 401 with
 * "reopen the URL printed by dsh web". Every spec therefore opens the GUI through
 * `openGui`, and the token stays in the environment instead of in the repository.
 */
export const guiEntry = process.env.DSH_GUI_ENTRY ?? '/'

export function openGui(page: Page): Promise<Response | null> {
  return page.goto(guiEntry, { waitUntil: 'domcontentloaded' })
}

/** The composer owns the only textbox DSH renders on a fresh conversation. */
export function composerInput(page: Page): Locator {
  return page.locator('textarea, [role="textbox"]').first()
}

/** Present in every projection, including the empty one, unlike the manager overlay. */
export function manageEntry(page: Page): Locator {
  return page.locator('[data-quick-actions-manage]')
}

export function layoutCell(page: Page): Locator {
  return page.locator('[data-quick-actions-layout]')
}

export function actionFaces(page: Page): Locator {
  return page.locator('[data-quick-action]')
}

/**
 * The composer's visual box — what the equal-width rule is measured against. DSH's class
 * names are hashed per build, so it is found structurally instead: climb from the input
 * until an ancestor is wider than the input itself, which is the bordered card the input
 * is inset into. The plugin cell sits in the input dock beside that card, not inside it,
 * so the cell's own ancestors cannot be used as the reference.
 */
export function composerBoxEdges(page: Page): Promise<{ left: number; right: number; width: number }> {
  return page.evaluate(() => {
    const input = document.querySelector('textarea, [role="textbox"]')
    if (input === null) throw new Error('composer input not found')
    const inputWidth = input.getBoundingClientRect().width
    let node: HTMLElement | null = input.parentElement
    while (node !== null && node.getBoundingClientRect().width <= inputWidth + 0.5) {
      node = node.parentElement
    }
    const rect = (node ?? input).getBoundingClientRect()
    return { left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) }
  })
}

/**
 * Other plugins in this profile put notices in DSH's shell overlay layer — a market
 * update banner, for instance — and that layer swallows pointer events over the composer
 * at narrow viewports. Dismiss it through its own affordance when there is one, and
 * otherwise take it out of the hit-testing path: it belongs to an unrelated plugin, so
 * leaving it up would test that plugin's z-index rather than this one's surface.
 */
export async function dismissShellOverlays(page: Page): Promise<void> {
  const overlay = page.locator('[data-shell-overlay="true"]')
  if (await overlay.count() === 0) return

  for (const label of ['稍后提醒', '知道了', '关闭', 'Later', 'Dismiss']) {
    const button = overlay.getByRole('button', { name: label })
    if (await button.count() > 0) {
      await button.first().click({ timeout: 5_000 }).catch(() => undefined)
    }
  }

  await page.evaluate(() => {
    for (const layer of document.querySelectorAll<HTMLElement>('[data-shell-overlay="true"]')) {
      layer.style.pointerEvents = 'none'
    }
  })
}

let knownLeaf: number | undefined

/**
 * Quick actions render at the Resident Composer, and DSH's hero screen — what an empty
 * session shows — deliberately does not mount `conversation.composer.dock`. Reaching the
 * plugin therefore means entering a session that has history, which means clicking a
 * sidebar row: DSH routes sessions client-side without touching the URL, so there is no
 * session path to navigate to directly.
 *
 * The sidebar is collapsed on narrow viewports, so entry always happens at desktop width
 * and the requested viewport is applied afterwards — resizing the window is also what the
 * responsive rule of spec section 13.3 actually describes.
 */
export async function openResidentComposer(page: Page): Promise<void> {
  const requested = page.viewportSize()
  if (requested !== null && requested.width < 1000) {
    await page.setViewportSize({ width: 1440, height: Math.max(requested.height, 800) })
  }

  await openGui(page)
  await expect(composerInput(page)).toBeVisible({ timeout: 20_000 })
  await dismissShellOverlays(page)
  const rows = page.locator('[role="treeitem"]')
  await expect(rows.first()).toBeVisible({ timeout: 20_000 })

  // The tree nests sessions inside workspace rows, and clicking a workspace row collapses
  // it — which hides the very sessions we are looking for. Only leaf rows are sessions.
  const leaves = await rows.evaluateAll(elements => elements
    .map((element, index) => ({ index, leaf: element.querySelector('[role="treeitem"]') === null }))
    .filter(row => row.leaf)
    .map(row => row.index))

  // Trying each leaf costs a full mount wait, and four misses exhaust a test's budget. The
  // row that worked once is tried first for the rest of the run: sessions with history do
  // not become sessions without it.
  const ordered = knownLeaf === undefined
    ? leaves.slice(0, 8)
    : [knownLeaf, ...leaves.filter(index => index !== knownLeaf)].slice(0, 8)

  for (const index of ordered) {
    await rows.nth(index).click()
    await expect(composerInput(page)).toBeVisible({ timeout: 20_000 })
    try {
      // The surface mounts only after the controller has read the catalog and settings,
      // so an immediate count would race the first render.
      // A profile that has just booted mounts the first surface slowly: the web app is
      // loading its module table while this waits, so the budget is generous.
      await layoutCell(page).first().waitFor({ state: 'visible', timeout: 25_000 })
      knownLeaf = index
      if (requested !== null) await page.setViewportSize(requested)
      await expect(layoutCell(page)).toBeVisible()
      await dismissShellOverlays(page)
      return
    } catch {
      // This session shows the hero: no Resident Composer here, try the next row.
    }
  }

  throw new Error(
    'no sidebar session mounted the quick actions layout cell; the plugin renders only at a '
    + 'Resident Composer, so this DSH needs at least one conversation with history',
  )
}

/**
 * Layout is a global persisted setting, so one spec's choice leaks into the next: every
 * spec that depends on a layout states it instead of assuming the default.
 */
export async function ensureLayout(page: Page, layout: 'ribbon' | 'bar' | 'launcher'): Promise<void> {
  if (await layoutCell(page).getAttribute('data-quick-actions-layout') === layout) return
  await manageEntry(page).click()
  await page.locator(`[data-quick-actions-layout-choice="${layout}"]`).click()
  await expect(layoutCell(page)).toHaveAttribute('data-quick-actions-layout', layout)
  await page.locator('[data-quick-actions-manager-close]').click()
  await expect(page.locator('[data-quick-actions-manager]')).toHaveCount(0)
}

/**
 * The packaged catalog is three presets and no custom actions. Every spec that counts
 * actions depends on that, and a stray custom action would quietly shift the counts — so
 * state it, rather than discovering it as an off-by-one somewhere else.
 */
export async function expectPackagedProjection(page: Page): Promise<void> {
  await expect(actionFaces(page), 'projection is not the packaged catalog: leftover custom actions?')
    .toHaveCount(3)
}

/**
 * Delete every custom action the run may have created. A management spec that clicks its
 * way through the overlay can land on a clone control, and a clone persists in the user's
 * Settings — so teardown removes them instead of trusting that no click ever strays.
 * Presets carry a clone control and customs carry a delete control, which is what tells
 * the two apart.
 */
export async function removeStrayCustomActions(page: Page): Promise<void> {
  if (await manageEntry(page).count() === 0) return
  await manageEntry(page).click()

  const ask = page.locator('[data-quick-actions-delete="ask"]')
  for (let guard = 0; guard < 60 && await ask.count() > 0; guard += 1) {
    await ask.first().click()
    await page.locator('[data-quick-actions-delete="confirm"]').first().click()
  }

  await page.locator('[data-quick-actions-manager-close]').click()
  await expect(page.locator('[data-quick-actions-manager]')).toHaveCount(0)
}

/** Rounded rect, in CSS px, of one element — the geometry spec section 13.3 measures. */
export async function edges(locator: Locator): Promise<{ left: number; right: number; width: number }> {
  const box = await locator.boundingBox()
  if (box === null) throw new Error('element has no box')
  return { left: Math.round(box.x), right: Math.round(box.x + box.width), width: Math.round(box.width) }
}
