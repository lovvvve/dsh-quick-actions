import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { expect, type Locator, type Page, type Response } from '@playwright/test'
import { parse } from 'yaml'

/**
 * `dsh web` prints its entry URL with a `token` query parameter, and redeeming that
 * token is what gives a browser profile its credential — a bare `/` answers 401 with
 * "reopen the URL printed by dsh web". Every spec therefore opens the GUI through
 * `openGui`, and the token stays in the environment instead of in the repository.
 *
 * `||`, not `??`: the drivers compute this with a `grep`, which yields an empty string
 * rather than nothing when the log has no entry url — and `page.goto('')` fails with an
 * opaque URL error instead of the channel probe's explanation.
 */
export const guiEntry = process.env.DSH_GUI_ENTRY || '/'

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

export function managerPanel(page: Page): Locator {
  return page.locator('[data-quick-actions-manager]')
}

/**
 * The composer's visual box, in fractional CSS px — what the equal-width rule is measured
 * against. DSH's class names are hashed per build, so the reference is found structurally
 * instead: climb from the input until an ancestor is wider than the input itself, which is
 * the bordered card the input is inset into. The plugin cell sits in the input dock beside
 * that card rather than inside it, so the cell's own ancestors cannot serve as the
 * reference.
 *
 * The climb stops at `body`: without a bound, a build that drops the card's padding would
 * silently promote the page-wide shell into the reference and the gate would compare the
 * plugin against the viewport.
 */
export function composerBoxEdges(page: Page): Promise<{ left: number; right: number; width: number }> {
  return page.evaluate(() => {
    const input = document.querySelector('textarea, [role="textbox"]')
    if (input === null) throw new Error('composer input not found')
    const inputWidth = input.getBoundingClientRect().width
    let node: HTMLElement | null = input.parentElement
    while (
      node !== null
      && node !== document.body
      && node.getBoundingClientRect().width <= inputWidth + 0.5
    ) {
      node = node.parentElement
    }
    if (node === null || node === document.body) {
      throw new Error('no bordered composer box between the input and the body')
    }
    const rect = node.getBoundingClientRect()
    return { left: rect.left, right: rect.right, width: rect.width }
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

/** The row key (`session:<id>`) of the session that mounted the landmark last; history does not go away. */
let knownSession: string | undefined

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
export function openResidentComposer(page: Page): Promise<void> {
  return enterSession(page, 'plugin')
}

/**
 * DSH's own conversation flow rows: what a session with history has and the hero screen
 * does not.
 */
export function conversationFlow(page: Page): Locator {
  return page.locator('[data-chat-flow-kind]')
}

/**
 * Enter a sidebar session and wait for `landmark`.
 *
 * `plugin` waits for this plugin's own layout cell — the Resident Composer beacon every
 * other spec needs. `history` waits only for DSH's conversation flow, and exists for the
 * round that asserts the plugin is *absent*: the hero screen carries a composer too, so
 * "no cell on whatever screen I landed on" would prove nothing about an uninstall.
 */
export async function enterSession(page: Page, landmark: 'plugin' | 'history'): Promise<void> {
  const requested = page.viewportSize()
  if (requested !== null && requested.width < 1000) {
    await page.setViewportSize({ width: 1440, height: Math.max(requested.height, 800) })
  }

  await openGui(page)
  await expect(composerInput(page)).toBeVisible({ timeout: 20_000 })
  await dismissShellOverlays(page)
  // DSH's workspace tree renders session rows and workspace rows as *siblings*, told apart
  // only by their row keys (`session:<id>` / `workspace:<id>`, the latter with
  // `aria-expanded`). A folded workspace has no child treeitem either, so "a row without
  // children" is no test for a session — clicking one only folds or unfolds it. Every new
  // page starts with each workspace folded except the current session's: the expansion
  // lives in localStorage, and each Playwright test gets empty storage (ticket 38).
  const sessions = page.locator('[role="treeitem"][data-row-key^="session:"]')
  const folded = page.locator('[role="treeitem"][data-row-key^="workspace:"][aria-expanded="false"]')
  await expect(page.locator('[role="treeitem"][data-row-key]').first()).toBeVisible({ timeout: 20_000 })
  const tried = new Set<string>()
  let waitedForSessions = false

  while (tried.size < 8) {
    const visible = await sessions.evaluateAll(elements => elements.map(element => element.getAttribute('data-row-key') ?? ''))
    // The session that worked once is tried first: sessions with history do not lose it.
    const next = [knownSession, ...visible].find(key => key !== undefined && visible.includes(key) && !tried.has(key))
    if (next === undefined) {
      // Every visible session is spent: unfold the next workspace, or give up.
      const group = await folded.first().getAttribute('data-row-key', { timeout: 1_000 }).catch(() => null)
      if (group === null) {
        // Workspace rows render before the session rows an unfolded workspace loads, so a
        // tree that shows neither an untried session nor a folded workspace gets one
        // chance to finish loading before it counts as having none.
        if (waitedForSessions) break
        waitedForSessions = true
        await page.waitForFunction(
          seen => [...document.querySelectorAll('[role="treeitem"][data-row-key^="session:"]')]
            .some(row => !seen.includes(row.getAttribute('data-row-key') ?? '')),
          [...tried],
          { timeout: 10_000 },
        ).catch(() => undefined)
        continue
      }
      const row = page.locator(`[role="treeitem"][data-row-key="${group}"]`)
      // On the folder icon near the left edge: the row's centre and right side are where
      // its hover-revealed buttons ("workspace actions", "new session here") appear, and a
      // click that lands on one of those opens a menu — or starts a session — instead. A
      // click made while the freshly loaded tree is still settling can be swallowed, so it
      // is repeated, but only while the row still reads folded: a second click on an
      // unfolded row would fold it again.
      for (let click = 0; click < 3 && await row.getAttribute('aria-expanded') !== 'true'; click += 1) {
        const box = await row.boundingBox()
        await row.click({ position: { x: 20, y: (box?.height ?? 28) / 2 } })
        await expect(row).toHaveAttribute('aria-expanded', 'true', { timeout: 2_000 }).catch(() => undefined)
      }
      await expect(row).toHaveAttribute('aria-expanded', 'true')
      continue
    }
    tried.add(next)

    await page.locator(`[role="treeitem"][data-row-key="${next}"]`).click()
    await expect(composerInput(page)).toBeVisible({ timeout: 20_000 })
    // A profile that has just booted mounts the first surface slowly: the web app is
    // loading its module table while this waits, so the budget is generous.
    const beacon = landmark === 'plugin' ? layoutCell(page).first() : conversationFlow(page).first()
    const mounted = await beacon
      .waitFor({ state: 'visible', timeout: 25_000 })
      .then(() => true, () => false)
    if (!mounted) continue // this session shows the hero; try the next one

    knownSession = next
    if (requested !== null) await page.setViewportSize(requested)
    // Asserted outside the discovery fallback on purpose: a cell that disappears when the
    // window shrinks is a responsive defect, and swallowing it here would report it as
    // "no session with history" instead.
    if (landmark === 'plugin') await expect(layoutCell(page)).toBeVisible()
    await dismissShellOverlays(page)
    return
  }

  throw new Error(
    landmark === 'plugin'
      ? 'no sidebar session mounted the quick actions layout cell; the plugin renders only at a '
        + 'Resident Composer, so this DSH needs at least one conversation with history'
      : 'no sidebar session showed a conversation flow; this DSH needs at least one '
        + 'conversation with history',
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
  await expect(managerPanel(page)).toHaveCount(0)
}

/**
 * The packaged catalog is five presets. Specs that count actions depend on that, so they
 * state it rather than discovering it as an off-by-one somewhere else.
 *
 * Only meaningful under `ribbon`: `bar` folds what does not fit into "more" and `launcher`
 * renders no faces at all, so callers set the layout first.
 */
export async function expectPackagedProjection(page: Page): Promise<void> {
  await expect(actionFaces(page), 'projection is not the packaged catalog').toHaveCount(5)
}

/**
 * Ref keys (`custom:<id>`) of every Custom Quick Action the manager lists — hidden and
 * disabled included, which is why this reads the overlay rather than the composer
 * projection. Presets are excluded: only editable rows carry a delete control.
 */
export async function customActionKeys(page: Page): Promise<string[]> {
  await manageEntry(page).click()
  const keys = await managerPanel(page).locator('[data-quick-action]').evaluateAll(elements => elements
    .filter(element => element.querySelector('[data-quick-actions-delete]') !== null)
    .map(element => element.getAttribute('data-quick-action') ?? ''))
  await page.locator('[data-quick-actions-manager-close]').click()
  await expect(managerPanel(page)).toHaveCount(0)
  return keys
}

/**
 * Delete only the Custom Quick Actions that appeared since `baseline` — the keys captured
 * before the test ran. A management spec that clicks its way through the overlay can land
 * on a clone control, and a clone persists in the user's Settings; deleting every editable
 * row instead would take the user's own quick actions with it, which is not this suite's
 * to do.
 */
export async function removeCustomActionsAddedSince(page: Page, baseline: readonly string[]): Promise<void> {
  const current = await customActionKeys(page)
  const strays = current.filter(key => !baseline.includes(key))
  if (strays.length === 0) return

  await manageEntry(page).click()
  for (const key of strays) {
    const row = managerPanel(page).locator(`[data-quick-action="${key}"]`)
    await row.locator('[data-quick-actions-delete="ask"]').click()
    await row.locator('[data-quick-actions-delete="confirm"]').click()
    await expect(row).toHaveCount(0)
  }
  await page.locator('[data-quick-actions-manager-close]').click()
  await expect(managerPanel(page)).toHaveCount(0)
}

export interface StoredNamespace {
  readonly layout?: string
  readonly userActionsById?: Readonly<Record<string, { readonly label?: string }>>
  readonly actionOrder?: readonly { readonly source: string; readonly id: string }[]
  readonly presetStateById?: Readonly<Record<string, unknown>>
}

/**
 * This plugin's own stored state: the `config` of its row in the user's live web profile
 * patch (spec 22 — since DSH 0.1.7 the stored section is the plugin's Config, written into
 * the active profile's `cordis.patch.yml`).
 *
 * Two claims can only be checked here, because neither is on screen by definition: a
 * tombstone is what the projection does *not* show, and data surviving an uninstall is
 * what there is no plugin left to render. Only this one row is read, and no spec prints it.
 */
export function storedNamespace(): StoredNamespace {
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  const file = join(home, 'profiles', process.env.DSH_QA_PROFILE ?? 'web', 'cordis.patch.yml')
  const rows = (parse(readFileSync(file, 'utf8')) ?? []) as readonly { id?: unknown; config?: StoredNamespace }[]
  const section = rows.findLast(row => row.id === 'composer-quick-actions' && row.config !== undefined)?.config
  if (section === undefined) throw new Error('the plugin has no row with config in the profile patch')
  return section
}

/** Fractional rect, in CSS px, of one element — the geometry spec section 13.3 measures. */
export async function edges(locator: Locator): Promise<{ left: number; right: number; width: number }> {
  const box = await locator.boundingBox()
  if (box === null) throw new Error('element has no box')
  return { left: box.x, right: box.x + box.width, width: box.width }
}
