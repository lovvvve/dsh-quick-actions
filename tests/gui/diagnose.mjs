// Throwaway diagnostic: geometry of the plugin surface against the composer input, to
// pin what "equal width" must be measured against. Prints boxes and DSH class names
// only — never conversation titles or message text. Run with:
//   DSH_GUI_ENTRY=<token url> node tests/gui/diagnose.mjs
import { chromium } from '@playwright/test'

const entry = process.env.DSH_GUI_ENTRY
if (entry === undefined) throw new Error('set DSH_GUI_ENTRY to the url printed by dsh web')

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(entry, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(4000)

const rows = page.locator('[role="treeitem"]')
for (let index = 0; index < Math.min(await rows.count(), 8); index += 1) {
  await rows.nth(index).click()
  await page.waitForTimeout(3500)
  if (await page.locator('[data-quick-actions-layout]').count() > 0) break
}

const geometry = await page.evaluate(() => {
  const box = (element) => {
    const rect = element.getBoundingClientRect()
    return {
      tag: element.tagName.toLowerCase(),
      cls: (element.className ?? '').toString().slice(0, 40),
      left: Math.round(rect.left * 10) / 10,
      right: Math.round(rect.right * 10) / 10,
      width: Math.round(rect.width * 10) / 10,
    }
  }
  const cell = document.querySelector('[data-quick-actions-layout]')
  const input = document.querySelector('textarea, [role="textbox"]')
  const chain = []
  let node = input
  for (let depth = 0; depth < 5 && node !== null; depth += 1) {
    chain.push(box(node))
    node = node.parentElement
  }
  return {
    layoutAttr: cell?.getAttribute('data-quick-actions-layout') ?? null,
    densityAttr: cell?.getAttribute('data-quick-actions-density') ?? null,
    cell: cell === null ? null : box(cell),
    cellParent: cell?.parentElement === undefined ? null : box(cell.parentElement),
    inputChain: chain,
    actionCount: document.querySelectorAll('[data-quick-action]').length,
    actionClasses: [...document.querySelectorAll('[data-quick-action]')]
      .map(element => (element.className ?? '').toString().slice(0, 70)),
    actionNames: [...document.querySelectorAll('[data-quick-action]')]
      .map(element => (element.getAttribute('aria-label') ?? element.textContent ?? '').trim().slice(0, 30)),
  }
})

console.log(JSON.stringify(geometry, null, 1))
await browser.close()
