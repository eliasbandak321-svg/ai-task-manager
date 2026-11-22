import { expect, test, type Page } from '@playwright/test'

/*
  README screenshots from the portfolio demo build (M11). Opt-in: `npm run screenshots`
  (SCREENSHOTS=1) writes docs/screenshots/*.png. The data is the demo's fictional sample data,
  dated relative to the day the screenshots are taken.
*/

const OUT = 'docs/screenshots'

async function settle(page: Page, heading: string | RegExp) {
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
  await expect(page.getByText(/^Loading/)).toHaveCount(0)
  await page.waitForTimeout(400)
}

async function useTheme(page: Page, theme: 'light' | 'dark') {
  await page.addInitScript((value) => localStorage.setItem('theme', value), theme)
}

test.describe('desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce', timezoneId: 'Europe/Berlin' })

  test('landing, today, calendar, assistant (light)', async ({ page }) => {
    await useTheme(page, 'light')
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${OUT}/landing.png` })

    await page.goto('/app')
    await settle(page, /^Today,/)
    await page.screenshot({ path: `${OUT}/today.png` })

    await page.goto('/app/calendar')
    await settle(page, 'Calendar')
    // The month view shows the sample weeks at a glance (the time grid opens at midnight).
    await page.getByRole('button', { name: 'Month', exact: true }).click()
    await expect(page.getByText(/^Loading/)).toHaveCount(0)
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${OUT}/calendar.png` })

    await page.goto('/app/assistant')
    await settle(page, /AI Assistant/)
    await page.getByRole('textbox', { name: /message/i }).fill('Set Apply to Northwind Labs to high priority')
    await page.getByRole('textbox', { name: /message/i }).press('Enter')
    await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible()
    await page.screenshot({ path: `${OUT}/assistant.png` })
  })

  test('projects and insights (dark)', async ({ page }) => {
    await useTheme(page, 'dark')
    await page.goto('/app/projects')
    await settle(page, 'All tasks')
    await page.screenshot({ path: `${OUT}/projects-dark.png` })

    await page.goto('/app/insights')
    await settle(page, 'Insights')
    await page.screenshot({ path: `${OUT}/insights-dark.png` })
  })
})

test.describe('phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce', timezoneId: 'Europe/Berlin' })

  test('today and calendar on a phone', async ({ page }) => {
    await useTheme(page, 'dark')
    await page.goto('/app')
    await settle(page, /^Today,/)
    await page.screenshot({ path: `${OUT}/phone-today-dark.png` })
    await useTheme(page, 'light')
    await page.goto('/app/calendar')
    await settle(page, 'Calendar')
    // The agenda: the calendar's list view on phones (and its keyboard alternative).
    await page.getByRole('heading', { level: 2, name: 'Agenda' }).evaluate((heading) => heading.scrollIntoView({ block: 'start' }))
    await page.evaluate(() => window.scrollBy(0, -90))
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${OUT}/phone-calendar.png` })
  })
})
