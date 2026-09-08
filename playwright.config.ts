import { defineConfig, devices } from '@playwright/test'

/**
 * GUI verification for ticket 18 (spec section 13.3): the single channel is the
 * official DSH web GUI the user already runs, with this plugin installed into that
 * profile. These specs never run under `pnpm test` — vitest only collects
 * `tools/**` and `packages/**` — because they need that live server.
 *
 * Viewports follow spec section 13.3: desktop, about 768px, about 360px.
 */
export default defineConfig({
  testDir: 'tests/gui',
  outputDir: '.playwright/results',
  reporter: [['list'], ['html', { outputFolder: '.playwright/report', open: 'never' }]],
  forbidOnly: true,
  retries: 0,
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: process.env.DSH_GUI_URL ?? 'http://127.0.0.1:3080',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'tablet-768', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 900 } } },
    { name: 'narrow-360', use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 780 } } },
  ],
})
