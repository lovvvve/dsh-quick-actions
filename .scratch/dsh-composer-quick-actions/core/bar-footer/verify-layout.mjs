// No server: verify the owning CSS in Chromium against the renderer's
// display:contents DOM contract. This is a layout fixture, not GUI acceptance.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const archive = resolve(process.argv[2])
const require = createRequire(resolve(archive, 'apps/web/package.json'))
const { chromium } = require('playwright')
const css = await readFile(resolve(archive, 'packages/client/ui-conversation/src/client/skeleton/InputBar.module.css'), 'utf8')
const browser = await chromium.launch({ headless: true, channel: 'chrome' })
try {
  const page = await browser.newPage()
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await page.setContent(`<style>
      body { margin: 0; --dsh-composer-side-clearance: 16px; --dsh-composer-card-max-width: 720px; }
      ${css}
      .card { height: 100px; }
    </style><div class="root"><div class="card"></div><div class="dock"><button>Statistics</button><button>Context</button></div><div class="footer"><div data-slot="conversation.composer.footer" style="display:contents"></div></div></div>`)
    const measure = () => page.evaluate(() => {
      const rect = selector => {
        const r = document.querySelector(selector).getBoundingClientRect()
        return { x: r.x, y: r.y, width: r.width, height: r.height }
      }
      return { root: rect('.root'), card: rect('.card'), dock: rect('.dock'), footer: rect('.footer') }
    })
    const empty = await measure()
    assert.equal(empty.footer.height, 0, `empty anchor height at ${width}`)
    assert.equal(empty.footer.x, empty.card.x, `left edge at ${width}`)
    assert.equal(empty.footer.width, empty.card.width, `card width at ${width}`)
    await page.locator('.footer').evaluate(element => { element.style.display = 'none' })
    const absent = await measure()
    assert.deepEqual(empty.root, absent.root, `empty footer adds no gap at ${width}`)
    await page.locator('.footer').evaluate(element => { element.style.display = '' })
    await page.locator('[data-slot]').evaluate(element => {
      element.innerHTML = '<button>First action</button><button>Second action</button>'
    })
    const full = await measure()
    assert.deepEqual(full.card, empty.card, `card unchanged at ${width}`)
    assert.deepEqual(full.dock, empty.dock, `dock unchanged at ${width}`)
    assert.equal(full.footer.x, full.card.x)
    assert.equal(full.footer.width, full.card.width)
    assert(full.footer.y >= full.dock.y + full.dock.height)
    assert(full.footer.height > 0)
    await page.locator('[data-slot]').evaluate(element => { element.replaceChildren() })
    assert.deepEqual(await measure(), empty, `removing entries restores geometry at ${width}`)
    console.log(JSON.stringify({ width, empty, full }))
  }
} finally {
  await browser.close()
}
