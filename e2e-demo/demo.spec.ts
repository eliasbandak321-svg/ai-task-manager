import { expect, test as base, type Page } from '@playwright/test'

/*
  The portfolio demo in a real browser, desktop and phone (M11). Every test fails if the page
  makes any network request outside the site itself (no API, no third parties), logs a CSP
  violation or throws an error.
*/

const test = base.extend<{ guarded: Page }>({
  guarded: async ({ page, baseURL }, provide) => {
    const outside: string[] = []
    const problems: string[] = []
    page.on('request', (request) => {
      const url = request.url()
      if (url.startsWith('data:') || url.startsWith('blob:')) return
      if (!url.startsWith(baseURL ?? '') || new URL(url).pathname.startsWith('/api')) outside.push(url)
    })
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(message.text())
    })
    page.on('pageerror', (error) => problems.push(error.message))
    await provide(page)
    expect(outside, 'requests outside the static site').toEqual([])
    expect(problems, 'console errors or CSP violations').toEqual([])
  },
})

// Against clientWidth, not innerWidth: mobile browsers widen innerWidth (the layout viewport) to
// fit content that is too wide, which would hide the overflow and push fixed bars off screen.
const horizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
const h1 = (page: Page, name: string | RegExp) => page.getByRole('heading', { level: 1, name })
const nav = (page: Page) => page.getByRole('navigation', { name: 'Main' })

test('the landing page opens the demo without an account', async ({ guarded: page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: 'Log in' })).toHaveCount(0)
  await page.getByRole('main').getByRole('link', { name: /View demo/ }).first().click()
  await expect(h1(page, /^Today,/)).toBeVisible()
  await expect(page.getByRole('region', { name: 'Demo notice' })).toContainText('fictional sample data')
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
})

test('every main screen works with the sample data and fits the screen', async ({ guarded: page }) => {
  await page.goto('/app')
  for (const [link, heading] of [
    ['Projects', 'All tasks'],
    ['Calendar', 'Calendar'],
    ['AI Assistant', /AI Assistant/],
    ['Insights', 'Insights'],
    ['Settings', 'Settings'],
    ['Today', /^Today,/],
  ] as const) {
    await nav(page).getByRole('link', { name: link }).click()
    await expect(h1(page, heading)).toBeVisible()
    // Measure the settled page: loading placeholders can be briefly wider while content mounts.
    await expect(page.getByText(/^Loading/)).toHaveCount(0)
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
  }
  await page.goto('/app/projects')
  await expect(page.getByRole('button', { name: 'Write literature review', exact: true })).toBeVisible()
  await page.goto('/app/calendar')
  await expect(page.getByText('Statistics lecture').first()).toBeVisible()
})

test('changes stay in the tab across reloads, and Reset demo restores the sample data', async ({ guarded: page }) => {
  await page.goto('/app/projects')
  const quickAdd = page.getByRole('textbox', { name: /^Add a task to/ })
  await quickAdd.fill('My own demo task')
  await quickAdd.press('Enter')
  await expect(page.getByRole('button', { name: 'My own demo task', exact: true })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('button', { name: 'My own demo task', exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Reset demo' }).click()
  await expect(h1(page, /^Today,/)).toBeVisible()
  await page.goto('/app/projects')
  await expect(page.getByRole('button', { name: 'Write literature review', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'My own demo task', exact: true })).toHaveCount(0)
})

test('another tab starts with its own fresh demo', async ({ guarded: page, context }) => {
  await page.goto('/app/projects')
  const quickAdd = page.getByRole('textbox', { name: /^Add a task to/ })
  await quickAdd.fill('Only in the first tab')
  await quickAdd.press('Enter')
  await expect(page.getByRole('button', { name: 'Only in the first tab', exact: true })).toBeVisible()

  const second = await context.newPage()
  await second.goto('/app/projects')
  await expect(second.getByRole('button', { name: 'Write literature review', exact: true })).toBeVisible()
  await expect(second.getByRole('button', { name: 'Only in the first tab', exact: true })).toHaveCount(0)
  await second.close()
})

test('the simulated assistant proposes a change that applies after approval', async ({ guarded: page }) => {
  await page.goto('/app/assistant')
  await expect(page.getByText('Simulated AI.')).toBeVisible()
  await page.getByRole('textbox', { name: /message/i }).fill('Set Apply to Northwind Labs to high priority')
  await page.getByRole('textbox', { name: /message/i }).press('Enter')
  await page.getByRole('button', { name: 'Approve' }).click()
  await expect(page.getByText(/applied/i).first()).toBeVisible()

  await page.goto('/app/projects')
  const row = page.getByRole('listitem').filter({ has: page.getByRole('button', { name: 'Apply to Northwind Labs', exact: true }) })
  await expect(row).toContainText('High priority')
})

test('the account pages explain that the demo has no accounts', async ({ guarded: page }) => {
  for (const path of ['/login', '/signup', '/forgot-password']) {
    await page.goto(path)
    await expect(h1(page, 'No account needed')).toBeVisible()
    await expect(page.getByLabel('Password')).toHaveCount(0)
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
  }
  await page.getByRole('link', { name: 'Open the demo' }).click()
  await expect(h1(page, /^Today,/)).toBeVisible()
})

test('the privacy notice is public', async ({ guarded: page }) => {
  await page.goto('/privacy')
  await expect(h1(page, 'Privacy')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'The demo runs in your browser' })).toBeVisible()
})
