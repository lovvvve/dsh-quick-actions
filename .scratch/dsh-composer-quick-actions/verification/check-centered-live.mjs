import { chromium, expect } from '@playwright/test'
import { writeFileSync } from 'node:fs'

// Read-only UI smoke against the existing GUI: no settings writes or sends.
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  await page.goto('http://127.0.0.1:3080/', { waitUntil: 'domcontentloaded' })
  const workspace = page.locator('[role="treeitem"][data-row-key^="workspace:"]').filter({ hasText: 'dsh-plugins' }).first()
  await workspace.waitFor({ state: 'visible', timeout: 20000 })
  if (await workspace.getAttribute('aria-expanded') !== 'true') {
    const box = await workspace.boundingBox()
    await workspace.click({ position: { x: 20, y: (box?.height ?? 28) / 2 } })
    await expect(workspace).toHaveAttribute('aria-expanded', 'true')
  }
  const sessions = page.locator('[role="treeitem"][data-row-key^="session:"]')
  await sessions.first().waitFor({ state: 'visible', timeout: 15000 })
  let mounted = false
  for (let i = 0; i < Math.min(await sessions.count(), 3); i++) {
    await sessions.nth(i).click({ position: { x: 80, y: 12 } })
    mounted = await page.locator('.dsh-cqa-footer .dsh-cqa-row').waitFor({ state: 'visible', timeout: 10000 }).then(() => true, () => false)
    if (mounted) break
  }
  if (!mounted) throw new Error('No existing session mounted the footer')
  const measurements = []
  for (const width of [1440, 768, 375, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    await expect(page.locator('.dsh-cqa-footer')).toHaveCount(1)
    const measurement = await page.evaluate(async () => {
      const counts = []
      for (let frame = 0; frame < 20; frame++) {
        await new Promise(resolve => requestAnimationFrame(resolve))
        counts.push(document.querySelectorAll('.dsh-cqa-footer .dsh-cqa-fit [data-quick-action]').length)
      }
      const input = document.querySelector('textarea,[role="textbox"]')
      if (!input) throw new Error('No composer input')
      const inputWidth = input.getBoundingClientRect().width
      let card = input.parentElement
      while (card && card !== document.body && card.getBoundingClientRect().width <= inputWidth + 0.5) card = card.parentElement
      if (!card || card === document.body) throw new Error('No composer card')
      const c = card.getBoundingClientRect()
      const row = document.querySelector('.dsh-cqa-footer .dsh-cqa-row').getBoundingClientRect()
      const dock = document.querySelector('[data-slot="conversation.composer.dock"]')?.parentElement?.getBoundingClientRect()
      if (!dock) throw new Error('No statistics dock')
      return { viewport: innerWidth, centerError: Math.abs((row.left + row.right - c.left - c.right) / 2),
        left: row.left, right: row.right, cardLeft: c.left, cardRight: c.right,
        belowStats: row.top >= dock.bottom - 1, counts }
    })
    expect(measurement.centerError).toBeLessThanOrEqual(1)
    expect(measurement.left).toBeGreaterThanOrEqual(measurement.cardLeft - 1)
    expect(measurement.right).toBeLessThanOrEqual(measurement.cardRight + 1)
    expect(measurement.belowStats).toBe(true)
    expect(new Set(measurement.counts.slice(-10)).size).toBe(1)
    measurements.push(measurement)
  }
  writeFileSync(new URL('./center-live.json', import.meta.url), JSON.stringify({ status: 'passed', measurements }, null, 2) + '\n')
  console.log(JSON.stringify({ status: 'passed', measurements }))
} finally {
  await browser.close()
}
