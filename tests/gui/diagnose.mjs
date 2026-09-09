// Throwaway diagnostic: how a submitted quick action shows up in DSH's conversation flow,
// so "sent exactly once" can be asserted on something real. Prints counts and attribute
// values only — never message text beyond this round's own fixtures. Submits nothing.
//   DSH_GUI_ENTRY=<token url> node tests/gui/diagnose.mjs
import { chromium } from '@playwright/test'

const entry = process.env.DSH_GUI_ENTRY || ''
if (entry === '') throw new Error('set DSH_GUI_ENTRY to the url printed by dsh web')
const probe = '/qa-probe-unknown-command'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(entry, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(5000)

const rows = page.locator('[role="treeitem"]')
const leaves = await rows.evaluateAll(els => els
  .map((el, i) => ({ i, leaf: el.querySelector('[role="treeitem"]') === null }))
  .filter(r => r.leaf).map(r => r.i))
for (const index of leaves.slice(0, 6)) {
  await rows.nth(index).click()
  await page.waitForTimeout(4000)
  if (await page.locator('[data-quick-actions-layout]').count() > 0) break
}

console.log('exact getByText matches:', await page.getByText(probe, { exact: true }).count())
console.log('loose getByText matches:', await page.getByText(probe, { exact: false }).count())

const shape = await page.evaluate((needle) => {
  const holders = [...document.querySelectorAll('*')].filter(element => {
    if (!(element.textContent ?? '').includes(needle)) return false
    return ![...element.children].some(child => (child.textContent ?? '').includes(needle))
  })
  const kinds = {}
  for (const element of document.querySelectorAll('[data-chat-flow-kind]')) {
    const kind = element.getAttribute('data-chat-flow-kind') ?? '?'
    kinds[kind] = (kinds[kind] ?? 0) + 1
  }
  return {
    innermostHolders: holders.length,
    holderShape: holders.slice(0, 3).map(element => ({
      tag: element.tagName.toLowerCase(),
      chatFlowKind: element.closest('[data-chat-flow-kind]')?.getAttribute('data-chat-flow-kind') ?? null,
      chatTurn: element.closest('[data-chat-turn]')?.getAttribute('data-chat-turn') ?? null,
    })),
    flowKinds: kinds,
    turns: document.querySelectorAll('[data-chat-turn]').length,
  }
}, probe)
console.log('flow shape:', JSON.stringify(shape, null, 1))

await browser.close()
