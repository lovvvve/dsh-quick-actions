import { test, expect } from '@playwright/test'
import { QUICK_ACTIONS_CSS } from '../../packages/composer-quick-actions/src/styles/index.js'

// CSS-only fixture: not a live DSH acceptance test. Session/mount handover is
// covered by Client tests; footer-component.spec.ts exercises real resizing.
for (const viewport of [375, 768, 1440]) {
  test(`footer centers its action group at ${viewport}px`, async ({ page }) => {
    await page.setViewportSize({ width: viewport, height: 700 })
    await page.setContent(`
      <style>
        body { margin: 0; }
        .host { --dsh-composer-card-max-width: 800px; padding: 0 16px; }
        .card, .footer { width: 100%; max-width: 800px; margin: 0 auto; }
        .card { height: 90px; }
        .stats { height: 24px; text-align: center; }
        button { box-sizing: border-box; width: 64px; height: 32px; flex: none; }
      </style>
      <div class="host">
        <div class="card"></div><div class="stats">statistics</div>
        <div class="footer"><div class="dsh-cqa-footer"><div class="dsh-cqa-bar" data-quick-actions-layout="bar">
          <div class="dsh-cqa-row">
            <div class="dsh-cqa-fit"><button>one</button><button>two</button></div>
            <div class="dsh-cqa-trailing"><button>manage</button></div>
          </div>
        </div></div></div>
      </div>
    `)
    await page.addStyleTag({ content: QUICK_ACTIONS_CSS })
    const bounds = async () => page.evaluate(() => {
      const box = (selector: string) => {
        const node = document.querySelector(selector)
        if (node === null) throw new Error(`missing ${selector}`)
        const { x, y, width, height, right, bottom } = node.getBoundingClientRect()
        return { x, y, width, height, right, bottom }
      }
      return { card: box('.card'), stats: box('.stats'), bar: box('.dsh-cqa-bar'),
        first: box('.dsh-cqa-fit button'), last: box('.dsh-cqa-fit button:last-child'), manage: box('.dsh-cqa-trailing button') }
    })
    let b = await bounds()
    expect(Math.abs((b.first.x + b.manage.right) / 2 - (b.card.x + b.card.right) / 2)).toBeLessThanOrEqual(1)
    expect(b.bar.y).toBeGreaterThanOrEqual(b.stats.bottom)
    expect(Math.abs(b.bar.width - b.card.width)).toBeLessThanOrEqual(1)
    expect(b.manage.x - b.last.right).toBeCloseTo(8, 1)
    expect(b.manage.right).toBeLessThanOrEqual(b.card.right + 1)

    // A folded row must claim the available width so widening can unfold it.
    await page.locator('.dsh-cqa-bar').evaluate((node) => node.setAttribute('data-quick-actions-overflow', ''))
    for (const width of [360, 1200]) {
      await page.setViewportSize({ width, height: 700 })
      b = await bounds()
      expect(Math.abs(b.bar.width - b.card.width)).toBeLessThanOrEqual(1)
      const rowWidth = await page.locator('.dsh-cqa-row').evaluate((node) => node.getBoundingClientRect().width)
      expect(Math.abs(rowWidth - b.card.width)).toBeLessThanOrEqual(1)
      expect(b.manage.right).toBeLessThanOrEqual(b.card.right + 1)
    }
    await page.locator('.dsh-cqa-bar').evaluate((node) => node.removeAttribute('data-quick-actions-overflow'))
    b = await bounds()
    expect(b.manage.x - b.last.right).toBeCloseTo(8, 1)
    expect(Math.abs((b.first.x + b.manage.right) / 2 - (b.card.x + b.card.right) / 2)).toBeLessThanOrEqual(1)
  })
}
