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
})
