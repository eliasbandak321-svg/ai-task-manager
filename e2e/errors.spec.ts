import { expect, signUpAndConfirm, test } from './support'

test.describe('error states', () => {
  test('a failed load shows an error with a working retry', async ({ page }) => {
    await signUpAndConfirm(page)
    let failures = 2 // the first load and its automatic retry
    await page.route('**/api/tasks', async (route) => {
      if (failures > 0 && route.request().method() === 'GET') {
        failures -= 1
        await route.fulfill({ status: 503, body: 'Service Unavailable' })
      } else {
        await route.continue()
      }
    })
    await page.reload()
    const alert = page.getByRole('alert')
    await expect(alert).toContainText("Your tasks couldn't be loaded")
    await expect(alert).toContainText('Something went wrong on the server')
    await alert.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'All tasks' })).toBeVisible()
  })

  test('sign-in explains when the server can’t be reached', async ({ page }) => {
    await page.route('**/api/auth/sign-in/email', (route) => route.abort('connectionrefused'))
    await page.goto('/login')
    await page.getByRole('textbox', { name: 'Email' }).fill('someone@e2e.test')
    await page.getByLabel('Password').fill('whatever password')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('alert')).toHaveText("Couldn't reach the server. Check your connection and try again.")
  })

  test('unknown pages show a not-found page with a way back', async ({ page }) => {
    await page.goto('/does-not-exist')
    await expect(page.getByRole('heading', { level: 1, name: 'Page not found' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Go to the home page' })).toBeVisible()
  })
})
