import { test, expect } from '@playwright/test'
import { build } from 'vite'
import { fileURLToPath } from 'node:url'

// Real React surface, official primitives/CSS and real ResizeObserver. Vite
// builds an in-memory fixture only; this test never starts or changes a server.
let script = ''
let css = ''
test.beforeAll(async () => {
  const output = await build({
    configFile: false,
    logLevel: 'error',
    define: { 'process.env.NODE_ENV': JSON.stringify('production') },
    build: {
      write: false,
      lib: { entry: fileURLToPath(new URL('../../packages/composer-quick-actions/tests/browser/footer-fixture.tsx', import.meta.url)), name: 'FooterFixture', formats: ['iife'] },
    },
  })
  const bundles = Array.isArray(output) ? output : [output]
  for (const bundle of bundles) {
    if (!('output' in bundle)) throw new Error('unexpected build watcher')
    for (const asset of bundle.output) {
      if (asset.type === 'chunk') script += asset.code
      else if (asset.fileName.endsWith('.css')) css += String(asset.source)
    }
  }
})

test('real footer folds stably, opens every hidden action, and unfolds after widening', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 700 })
  await page.setContent(`<style>
    body { margin: 0; font: 14px sans-serif; }
    .host { padding: 0 16px; --dsh-composer-card-max-width: 800px; }
    .card, #root { width: 100%; max-width: 800px; margin: 0 auto; }
    .card { height: 80px; } .stats { height: 24px; }
  </style><div class="host"><div class="card"></div><div class="stats"></div><div id="root"></div></div>`)
  await page.addStyleTag({ content: css })
  await page.addScriptTag({ content: script })
  const actions = page.locator('.dsh-cqa-fit [data-quick-action]')
  await expect(actions).toHaveCount(6)
  await expect(page.locator('[data-quick-actions-entry="bar"]')).toHaveCount(0)

  for (const width of [320, 375, 1440, 320, 1440]) {
    await page.setViewportSize({ width, height: 700 })
    if (width === 1440) {
      await expect(actions).toHaveCount(6)
      await expect(page.locator('[data-quick-actions-entry="bar"]')).toHaveCount(0)
    } else {
      await expect(page.locator('[data-quick-actions-entry="bar"]')).toBeVisible()
      const shown = await actions.count()
      expect(shown).toBeLessThan(6)
      await page.locator('[data-quick-actions-entry="bar"]').click()
      await expect(page.getByRole('dialog')).toBeVisible()
      // The panel's action controls carry the same source-key data marker.
      await expect.poll(async () => (await actions.count()) + (await page.getByRole('dialog').locator('[data-quick-action]').count())).toBe(6)
      const keys = await page.locator('[data-quick-action]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-quick-action')))
      expect(new Set(keys).size).toBe(6)
      await page.keyboard.press('Escape')
    }
    const frames = await page.evaluate(async () => {
      const counts: number[] = []
      for (let i = 0; i < 20; i++) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        counts.push(document.querySelectorAll('.dsh-cqa-fit [data-quick-action]').length)
      }
      const card = document.querySelector('.card')!.getBoundingClientRect()
      const bar = document.querySelector('[data-quick-actions-layout="bar"]')!.getBoundingClientRect()
      const row = document.querySelector('.dsh-cqa-row')!.getBoundingClientRect()
      return { counts, cardX: card.x, cardRight: card.right, barX: bar.x, rowRight: row.right,
        centerError: Math.abs((row.left + row.right) / 2 - (card.left + card.right) / 2) }
    })
    expect(new Set(frames.counts).size).toBe(1)
    expect(Math.abs(frames.barX - frames.cardX)).toBeLessThanOrEqual(1)
    expect(frames.rowRight).toBeLessThanOrEqual(frames.cardRight + 1)
    expect(frames.centerError).toBeLessThanOrEqual(1)
  }
  expect(errors).toEqual([])
})
