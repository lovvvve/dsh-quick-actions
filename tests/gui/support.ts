import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
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
 * Quick actions render at the Resident Composer, and DSH's hero screen — what an empty
 * session shows — deliberately does not mount `conversation.composer.dock`. Reaching the
 * plugin therefore means entering a session that has history.
 *
 * The sidebar reorders by recency as sessions are opened, so a row index is not stable
 * across tests: the first discovery caches the session's own path and every later test
 * navigates straight to it. `DSH_GUI_SESSION_PATH` pins one explicitly.
 */
const sessionPathCache = '.playwright/session-path'

function readCachedSessionPath(): string | undefined {
  const pinned = process.env.DSH_GUI_SESSION_PATH
  if (pinned !== undefined) return pinned
  try {
    const cached = readFileSync(sessionPathCache, 'utf8').trim()
    return cached === '' ? undefined : cached
  } catch {
    return undefined
  }
}

let sessionPath: string | undefined = readCachedSessionPath()

function withEntryCredential(pathname: string): string {
  const url = new URL(guiEntry, 'http://127.0.0.1:3080')
  url.pathname = pathname
  return url.toString()
}

export async function openResidentComposer(page: Page): Promise<void> {
  if (sessionPath !== undefined && await enterKnownSession(page, sessionPath)) return

  await openGui(page)
  await expect(composerInput(page)).toBeVisible({ timeout: 20_000 })
  const rows = page.locator('[role="treeitem"]')
  await expect(rows.first()).toBeVisible({ timeout: 20_000 })

  for (let index = 0; index < Math.min(await rows.count(), 8); index += 1) {
    await rows.nth(index).click()
    await expect(composerInput(page)).toBeVisible({ timeout: 20_000 })
    try {
      // The surface mounts only after the controller has read the catalog and settings,
      // so an immediate count would race the first render.
      await layoutCell(page).first().waitFor({ state: 'visible', timeout: 8_000 })
      sessionPath = new URL(page.url()).pathname
      // Persist it: the narrow viewports collapse the sidebar, so a later run has no
      // rows to walk and must navigate to the session directly.
      mkdirSync(dirname(sessionPathCache), { recursive: true })
      writeFileSync(sessionPathCache, sessionPath)
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

async function enterKnownSession(page: Page, pathname: string): Promise<boolean> {
  // A fresh browser context carries no credential, so the token entry has to be redeemed
  // before the session path can be opened directly.
  await openGui(page)
  await page.goto(withEntryCredential(pathname), { waitUntil: 'domcontentloaded' })
  try {
    await layoutCell(page).first().waitFor({ state: 'visible', timeout: 20_000 })
    return true
  } catch {
    return false
  }
}

/** Rounded rect, in CSS px, of one element — the geometry spec section 13.3 measures. */
export async function edges(locator: Locator): Promise<{ left: number; right: number; width: number }> {
  const box = await locator.boundingBox()
  if (box === null) throw new Error('element has no box')
  return { left: Math.round(box.x), right: Math.round(box.x + box.width), width: Math.round(box.width) }
}
