import { defineConfig, devices } from '@playwright/test'

/*
  End-to-end tests for the portfolio demo (M11): the static demo build (VITE_DEMO=1) served by
  `vite preview` with the production security headers from vercel.json, and NO API server.
  Desktop and phone run the same tests. The full-stack suite is playwright.config.ts.
*/

const env = { VITE_DEMO: '1', WEB_PORT: '5176' }

export default defineConfig({
  testDir: 'e2e-demo',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-demo' }]] : 'list',
  outputDir: 'test-results/demo',
  use: { baseURL: 'http://localhost:5176', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: process.env.SCREENSHOTS === '1'
    ? // `npm run screenshots`: only the README screenshots (e2e-demo/screenshots.capture.ts).
      [{ name: 'screenshots', testMatch: /screenshots\.capture\.ts/, use: { ...devices['Desktop Chrome'] } }]
    : [
        { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
        { name: 'mobile', use: { ...devices['Pixel 7'] } },
      ],
  webServer: {
    command: 'npx vite build --logLevel warn && npx vite preview',
    url: 'http://localhost:5176',
    env,
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
