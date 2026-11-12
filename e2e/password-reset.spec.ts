import { countEmails, expect, newClient, PASSWORD, signIn, signOut, signUpAndConfirm, test, uniqueEmail, waitForEmail } from './support'

const NEW_PASSWORD = 'a brand new passphrase'

async function requestReset(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login')
  await page.getByRole('link', { name: 'Forgot your password?' }).click()
  // Wait for the new page first: the login page has an "Email" field too, and typing before the
  // client-side navigation finishes would fill the wrong one (seen once in CI).
  await expect(page.getByRole('heading', { level: 1, name: 'Reset your password' })).toBeVisible()
  await page.getByRole('textbox', { name: 'Email' }).fill(email)
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(page.getByText(/If an account exists for/)).toContainText(email)
}

test.describe('password reset', () => {
  test('resets the password from the email, signs out other devices, and the link works once', async ({ page, browser }) => {
    const { email } = await signUpAndConfirm(page, 'Forgetful')

    // Another device is signed in to the same account.
    const other = await newClient(browser)
    await signIn(other.page, email)
    await expect(other.page.getByRole('heading', { level: 1, name: 'All tasks' })).toBeVisible()

    await signOut(page)
    await requestReset(page, email)
    const mail = await waitForEmail(email, 'Reset your password')
    expect(mail.text).toContain('expires in 15 minutes')

    await page.goto(mail.link ?? '')
    await expect(page).toHaveURL(/\/reset-password\?token=/)
    const resetUrl = page.url()
    await page.getByLabel('New password', { exact: true }).fill(NEW_PASSWORD)
    await page.getByLabel('Confirm new password').fill(NEW_PASSWORD)
    await page.getByRole('button', { name: 'Change password' }).click()
    await expect(page.getByText('Your password has been changed. Sign in with your new password.')).toBeVisible()

    await signIn(page, email, PASSWORD)
    await expect(page.getByRole('alert')).toHaveText('Incorrect email or password.')
    await signIn(page, email, NEW_PASSWORD)
    await expect(page.getByRole('heading', { level: 1, name: 'All tasks' })).toBeVisible()

    // The other device was signed out by the reset.
    await other.page.reload()
    await expect(other.page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible()
    await other.context.close()

    // Using the same link again fails.
    await signOut(page)
    await page.goto(resetUrl)
    await page.getByLabel('New password', { exact: true }).fill('yet another passphrase')
    await page.getByLabel('Confirm new password').fill('yet another passphrase')
    await page.getByRole('button', { name: 'Change password' }).click()
    await expect(page.getByRole('alert')).toContainText('This reset link is invalid or has expired')
  })

  test('an unknown email gets the same answer, and no email is sent', async ({ page }) => {
    const email = uniqueEmail('nobody')
    await requestReset(page, email)
    await page.waitForTimeout(500)
    expect(countEmails(email)).toBe(0)
  })

  test('a forged reset link is refused', async ({ page }) => {
    await page.goto('/api/auth/reset-password/forged-token?callbackURL=http%3A%2F%2Flocalhost%3A5175%2Freset-password')
    await expect(page.getByRole('heading', { level: 1, name: 'This link can’t be used' })).toBeVisible()
  })
})
