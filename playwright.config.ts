import { defineConfig, devices } from '@playwright/test'

/**
 * GUI verification for ticket 18 (spec section 13.3): the single channel is the
 * official DSH web GUI the user already runs, with this plugin installed into that
 * profile. These specs never run under `pnpm test` — vitest only collects
 * `tools/**` and `packages/**` — because they need that live server.
 *
 * Viewports follow spec section 13.3: desktop, about 768px, about 360px.
 *
 * Automatic screenshots and traces are OFF on purpose. Quick actions render at a
 * Resident Composer, so every page under test is one of the user's own conversations,
 * and a full-page capture would write real conversation content into the evidence —
 * which spec section 13.1 forbids. Specs that need a picture clip it to the composer.
 */
export default defineConfig({
  testDir: 'tests/gui',
  outputDir: '.playwright/results',
  reporter: [['list']],
  forbidOnly: true,
  // The channel is the user's own live DSH with other plugins in it, so entering a session
  // is not hermetic: one retry absorbs a slow first render without hiding a real failure,
  // which would fail twice.
  retries: 1,
  workers: 1,
  // Entering a session costs a page load plus the plugin's first mount, and a freshly
  // booted profile is slower still.
  timeout: 90_000,
  use: {
    baseURL: process.env.DSH_GUI_URL ?? 'http://127.0.0.1:3080',
    screenshot: 'off',
    trace: 'off',
    video: 'off',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'tablet-768', use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 900 } } },
    { name: 'narrow-360', use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 780 } } },
  ],
})
