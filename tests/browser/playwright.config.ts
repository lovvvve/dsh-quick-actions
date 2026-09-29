import { defineConfig } from '@playwright/test'

// Offline geometry checks: no webServer, profile writes, or model calls.
export default defineConfig({
  testDir: '.',
  testMatch: '*.spec.ts',
  outputDir: '../../.playwright/footer-browser',
  use: { browserName: 'chromium', channel: 'chrome', headless: true },
})
