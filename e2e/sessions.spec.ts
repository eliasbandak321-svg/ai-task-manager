import { expect, signOut, signUpAndConfirm, test } from './support'

test.describe('sessions', () => {
  test('stay signed in across reloads and new tabs', async ({ page, context }) => {
    await signUpAndConfirm(page)
    await page.reload()
    await expect(page.getByRole('heading', { level: 1, name: 'All tasks' })).toBeVisible()
    const tab = await context.newPage()
    await tab.goto('/app')
    await expect(tab.getByRole('heading', { level: 1, name: 'All tasks' })).toBeVisible()
  })

  test('a session ended elsewhere sends the other tab back to login, then returns there', async ({ page, context }) => {
    await signUpAndConfirm(page)
    await page.getByRole('button', { name: 'New project' }).click()
    await page.getByRole('textbox', { name: 'Project name' }).fill('Where I was')
    await page.getByRole('button', { name: 'Create project' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Where I was' })).toBeVisible()
    const projectUrl = new URL(page.url()).pathname

    // Sign out in a second tab: the session is deleted on the server.
    const tab = await context.newPage()
    await tab.goto('/app')
    await signOut(tab)

    // The first tab's next request is refused (401), and the app asks to sign in again.
    await page.getByRole('textbox', { name: /^Add a task to/ }).fill('Still there?')
    await page.getByRole('textbox', { name: /^Add a task to/ }).press('Enter')
    await expect(page.getByRole('heading', { level: 1, name: 'Sign in' })).toBeVisible()
    expect(new URL(page.url()).searchParams.get('next')).toBe(projectUrl)
  })
})
