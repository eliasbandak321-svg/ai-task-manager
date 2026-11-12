import { countEmails, expect, fillSignUp, PASSWORD, signIn, signOut, signUpAndConfirm, test, uniqueEmail, waitForEmail } from './support'

test.describe('registration, login and logout', () => {
  test('registers, confirms the email, signs out and signs back in', async ({ page, context }) => {
    const { email } = await signUpAndConfirm(page, 'Grace Hopper')
    await expect(page.getByRole('banner')).toContainText(email)
    await expect(page.getByText('No tasks yet')).toBeVisible()

    const cookie = (await context.cookies()).find((c) => c.name === 'better-auth.session_token')
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' })
    expect(await page.evaluate(() => document.cookie)).not.toContain('session_token')

    await signOut(page)
    await page.goto('/app')
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible()

    await signIn(page, email, 'wrong password')
    await expect(page.getByRole('alert')).toHaveText('Incorrect email or password.')
    await signIn(page, email)
    await expect(page.getByRole('heading', { level: 1, name: 'All tasks' })).toBeVisible()
  })

  test('an unconfirmed account can’t sign in and gets a fresh link', async ({ page }) => {
    const email = uniqueEmail('unconfirmed')
    await fillSignUp(page, { name: 'Pending', email })
    await waitForEmail(email, 'Confirm your email address')

    await signIn(page, email)
    await expect(page.getByRole('alert')).toContainText('Please confirm your email address first')
    const fresh = await waitForEmail(email, 'Confirm your email address', 1)

    await page.goto(fresh.link ?? '')
    await expect(page.getByRole('heading', { level: 1, name: 'Email confirmed' })).toBeVisible()
  })

  test('signing up with a registered email reveals nothing and notifies the owner', async ({ page }) => {
    const { email } = await signUpAndConfirm(page, 'Owner')
    await signOut(page)

    // Someone else tries the same email: they see exactly what a new user sees.
    await fillSignUp(page, { name: 'Mallory', email, password: 'mallory password' })
    await expect(page.getByText(`We’ve sent a confirmation link to ${email}`)).toBeVisible()
    const notice = await waitForEmail(email, 'Someone tried to sign up with your email')
    expect(notice.text).toContain('you already have one')
    expect(countEmails(email, 'Confirm your email address')).toBe(1)

    // The owner's account is untouched.
    await signIn(page, email, 'mallory password')
    await expect(page.getByRole('alert')).toHaveText('Incorrect email or password.')
    await signIn(page, email, PASSWORD)
    await expect(page.getByRole('heading', { level: 1, name: 'All tasks' })).toBeVisible()
  })

  test('protected pages send visitors to login and back', async ({ page }) => {
    const { email } = await signUpAndConfirm(page)
    await signOut(page)
    await page.goto('/app?q=report')
    await expect(page).toHaveURL(/\/login\?next=%2Fapp%3Fq%3Dreport$/)
    await page.getByRole('textbox', { name: 'Email' }).fill(email)
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page).toHaveURL(/\/app\?q=report$/)
  })
})
