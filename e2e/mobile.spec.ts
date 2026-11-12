import { expect, signUpAndConfirm, test } from './support'
import type { Page } from '@playwright/test'

/** Runs in the "mobile" project (Pixel 7 viewport, touch). */

const horizontalOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)

test.describe('phone layout', () => {
  for (const path of ['/login', '/signup', '/forgot-password', '/reset-password?token=x']) {
    test(`${path} fits the screen`, async ({ page }) => {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
    })
  }

  test('the dashboard, project navigation and task dialog work on a phone', async ({ page }) => {
    await signUpAndConfirm(page, 'Phone User')
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)

    // Project navigation folds into a button.
    const projects = page.getByRole('button', { name: /^Projects:/ })
    await projects.click()
    await expect(page.getByRole('link', { name: /^Inbox/ })).toBeVisible()
    await projects.click()

    const quickAdd = page.getByRole('textbox', { name: /^Add a task to/ })
    await quickAdd.fill('Call the dentist about the appointment next week')
    await quickAdd.press('Enter')
    await page.getByRole('button', { name: 'Call the dentist about the appointment next week' }).click()
    const dialog = page.getByRole('dialog', { name: 'Task details' })
    await expect(dialog).toBeVisible()
    const dialogOverflow = await page.evaluate(() => {
      const element = document.querySelector('dialog[open]')
      return element ? element.scrollWidth - element.clientWidth : -1
    })
    expect(dialogOverflow).toBeLessThanOrEqual(0)

    // Touch targets of the dialog's controls are at least 44 px tall.
    const small = await dialog.locator('button, select, input:not([type=checkbox]), textarea').evaluateAll((elements) =>
      elements.filter((element) => element.getBoundingClientRect().height > 0 && element.getBoundingClientRect().height < 44).length,
    )
    expect(small).toBe(0)
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
  })

  test('the M9 pages fit a phone and the main navigation scrolls instead of overflowing', async ({ page }) => {
    await signUpAndConfirm(page, 'Phone Planner')
    const nav = page.getByRole('navigation', { name: 'Main' })
    for (const [link, heading] of [
      ['Dashboard', 'Dashboard'],
      ['Calendar', 'Calendar'],
      ['AI Assistant', /AI Assistant/],
      ['Insights', 'Insights'],
      ['Settings', 'Settings'],
    ] as const) {
      await nav.getByRole('link', { name: link }).click()
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
    }

    // The calendar's event dialog fits and keeps 44 px touch targets.
    await nav.getByRole('link', { name: 'Calendar' }).click()
    await page.getByRole('button', { name: 'New event' }).click()
    const dialog = page.getByRole('dialog', { name: 'New event' })
    await expect(dialog).toBeVisible()
    const small = await dialog.locator('button, select, input:not([type=checkbox]):not([type=radio]), textarea').evaluateAll((elements) =>
      elements.filter((element) => element.getBoundingClientRect().height > 0 && element.getBoundingClientRect().height < 44).length,
    )
    expect(small).toBe(0)
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
  })

  test('the calendar works on a phone: day view, creating an event, agenda, no overflow', async ({ page }) => {
    await signUpAndConfirm(page, 'Phone Calendar')
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Calendar' }).click()
    const calendar = page.locator('.calendar-theme')
    await expect(calendar.locator('.fc-timeGridDay-view')).toBeVisible()
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)

    await page.getByRole('button', { name: 'New event' }).click()
    const dialog = page.getByRole('dialog', { name: 'New event' })
    await dialog.getByRole('textbox', { name: 'Title' }).fill('Phone event')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('region', { name: 'Agenda' }).getByText('Phone event')).toBeVisible()
    await expect(calendar.locator('.fc-event', { hasText: 'Phone event' })).toBeVisible()

    // The view switcher is reachable at the bottom of the calendar.
    await calendar.getByRole('button', { name: 'Month', exact: true }).click()
    await expect(calendar.locator('.fc-dayGridMonth-view')).toBeVisible()
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
    await page.screenshot({ path: 'test-results/calendar/07-phone-month.png', fullPage: true })
    await calendar.getByRole('button', { name: 'Day', exact: true }).click()
    await page.screenshot({ path: 'test-results/calendar/08-phone-day.png' })
  })
})
