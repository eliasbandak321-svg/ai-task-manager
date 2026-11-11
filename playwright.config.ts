import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineConfig, devices } from '@playwright/test'

/*
  End-to-end tests: real Chromium against the production build (vite preview) and the real
  API, on ports of their own (5175 and 8790) so they can run next to `npm run dev`.

  Every run gets a fresh temporary directory with its own PGlite database and email inbox.
  The API reads e2e/.env.e2e instead of .env, so these tests can never touch Neon.
*/

// Created once in the main process; worker processes inherit it through the environment.
process.env.E2E_RUN_DIR ??= mkdtempSync(join(tmpdir(), 'ai-task-manager-e2e-'))
const runDir = process.env.E2E_RUN_DIR
export const MAIL_DIR = join(runDir, 'mail')

const serverEnv = {
  ENV_FILE: 'e2e/.env.e2e',
  PGLITE_DIR: join(runDir, 'db'),
  MAIL_DIR,
  API_PORT: '8790',
  WEB_PORT: '5175',
}

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1, // one shared server and database per run
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5175',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile\.spec\.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: [
    {
      // Migrations first (explicitly, as always), then the API.
      command: 'npx tsx server/db/migrate.ts && npx tsx server/dev.ts',
      url: 'http://127.0.0.1:8790/api/health',
      env: serverEnv,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'npx vite build --logLevel warn && npx vite preview',
      url: 'http://localhost:5175',
      env: serverEnv,
      reuseExistingServer: false,
      timeout: 180_000,
    },
  ],
})
