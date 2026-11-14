import { expect, newClient, openProjects, signIn, signOut, signUpAndConfirm, test } from './support'

/*
  M9 end to end: browser → API → PGlite (temporary database) with the free demo AI provider.
  Times are fixed to Europe/Berlin so the scheduler's results don't depend on the machine.
*/

test.use({ timezoneId: 'Europe/Berlin' })

test.describe('AI workspace and calendar', () => {
  test('plan a goal, schedule it, use the assistant, and find everything after signing in again', async ({ page }) => {
    const { email } = await signUpAndConfirm(page, 'Planner')
    const nav = page.getByRole('navigation', { name: 'Main' })

    // Availability: every day, almost all day, so scheduling works whenever the test runs.
    await nav.getByRole('link', { name: 'Settings' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Settings' })).toBeVisible()
    await expect(page.getByText(/No AI service is connected/)).toBeVisible()
    for (const day of ['Saturday', 'Sunday']) await page.getByRole('checkbox', { name: day }).check()
    await page.getByLabel('Day starts').fill('00:00')
    await page.getByLabel('Day ends').fill('23:59')
    await page.getByRole('spinbutton', { name: /Max work per day/ }).fill('16')
    await page.getByRole('button', { name: 'Save settings' }).click()
    await expect(page.getByText('Settings saved.')).toBeVisible()

    // Goal → editable plan → project (nothing saved before approval).
    await nav.getByRole('link', { name: 'AI Assistant' }).click()
    await page.getByRole('link', { name: 'Plan a new goal' }).click()
    await page.getByRole('textbox', { name: /Your goal/ }).fill('Launch my portfolio website')
    await page.getByRole('button', { name: 'Generate plan' }).click()
    await expect(page.getByRole('heading', { name: 'Plan preview' })).toBeVisible()
    await expect(page.getByText('Demo AI').first()).toBeVisible()
    await page.getByRole('textbox', { name: 'Project name' }).fill('Portfolio')
    const firstTask = page.getByRole('textbox', { name: 'Task' }).first()
    await firstTask.fill('Define the portfolio goals')
    await page.getByRole('button', { name: /^Remove Review and wrap up/ }).click()
    await page.getByRole('button', { name: 'Create project' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Portfolio' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Define the portfolio goals' })).toBeVisible()
    await expect(page.getByRole('list', { name: 'Tasks' }).getByRole('listitem')).toHaveCount(4)

    // Task AI help: a checklist becomes subtasks only after approval.
    await page.getByRole('button', { name: 'Define the portfolio goals' }).click()
    const dialog = page.getByRole('dialog', { name: 'Task details' })
    await dialog.getByRole('button', { name: 'Suggest a checklist' }).click()
    await expect(dialog.getByRole('heading', { name: 'Add as subtasks?' })).toBeVisible()
    await dialog.getByRole('button', { name: 'Approve' }).click()
    await expect(dialog.getByRole('checkbox', { name: 'Collect what you need' })).toBeVisible()
    await dialog.getByRole('button', { name: 'Close dialog' }).click()

    // Calendar: the scheduler proposes sessions; approving puts them on the calendar.
    await nav.getByRole('link', { name: 'Calendar' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible()
    await page.getByRole('button', { name: 'Plan my week', exact: true }).click()
    const proposal = page.getByRole('region', { name: 'Proposed schedule' })
    await expect(proposal).toBeVisible()
    await expect(proposal.getByText('Scheduler')).toBeVisible()
    await expect(proposal.getByText(/Free working time/)).toBeVisible()
    await proposal.getByRole('button', { name: 'Approve' }).click()
    await expect(proposal.getByText(/^Applied/)).toBeVisible()
    const agenda = page.getByRole('region', { name: 'Agenda' })
    await expect(agenda.getByText('Task: Define the portfolio goals').first()).toBeVisible()

    // A manual, repeating event, then one occurrence edited on its own.
    await page.getByRole('button', { name: 'New event' }).click()
    const eventDialog = page.getByRole('dialog', { name: 'New event' })
    await eventDialog.getByRole('textbox', { name: 'Title' }).fill('Gym')
    await eventDialog.getByRole('combobox', { name: 'Category' }).selectOption('personal')
    await eventDialog.getByRole('combobox', { name: 'Repeats' }).selectOption('daily')
    await eventDialog.getByRole('button', { name: 'Save' }).click()
    await expect(eventDialog).toBeHidden()
    await expect(agenda.getByRole('button', { name: /^Edit Gym at/ }).first()).toBeVisible()
    const gymCount = await agenda.getByRole('button', { name: /^Edit Gym at/ }).count()
    expect(gymCount).toBeGreaterThan(1)
    await agenda.getByRole('button', { name: /^Edit Gym at/ }).first().click()
    const editDialog = page.getByRole('dialog', { name: 'Edit event' })
    await editDialog.getByRole('radio', { name: 'Only this event' }).check()
    await editDialog.getByRole('textbox', { name: 'Title' }).fill('Long gym session')
    await editDialog.getByRole('button', { name: 'Save' }).click()
    await expect(agenda.getByText('Long gym session')).toBeVisible()
    await expect(agenda.getByRole('button', { name: /^Edit Gym at/ })).toHaveCount(gymCount - 1)

    // Assistant: answers from real data; a change waits for approval.
    await nav.getByRole('link', { name: 'AI Assistant' }).click()
    const message = page.getByRole('textbox', { name: 'Message' })
    await message.fill('Set Define the portfolio goals to low priority')
    await message.press('Enter')
    const changes = page.getByRole('region', { name: 'Suggested changes' })
    await expect(changes.getByText('Update "Define the portfolio goals": priority → low')).toBeVisible()
    await changes.getByRole('button', { name: 'Approve' }).click()
    await expect(changes.getByText(/^Applied/)).toBeVisible()
    await message.fill('What should I focus on?')
    await message.press('Enter')
    await expect(page.getByText(/I'd start with/)).toBeVisible()

    // Insights are derived from the real data.
    await nav.getByRole('link', { name: 'Insights' }).click()
    await expect(page.getByRole('table', { name: 'Planned work per day' })).toBeVisible()

    // Everything is still there after signing out and in again.
    await signOut(page)
    await signIn(page, email)
    await expect(page.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Upcoming sessions' })).toBeVisible()
    await nav.getByRole('link', { name: 'Calendar' }).click()
    await expect(page.getByRole('region', { name: 'Agenda' }).getByText('Long gym session')).toBeVisible()
    await openProjects(page)
    await page.getByRole('link', { name: /^Portfolio/ }).click()
    await expect(page.getByRole('button', { name: 'Define the portfolio goals' })).toBeVisible()
  })

  test("one user's calendar, proposals and conversations are invisible to another", async ({ page, browser }) => {
    await signUpAndConfirm(page, 'Alice')
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Calendar' }).click()
    await page.getByRole('button', { name: 'New event' }).click()
    const dialog = page.getByRole('dialog', { name: 'New event' })
    await dialog.getByRole('textbox', { name: 'Title' }).fill('Alice private meeting')
    await dialog.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('region', { name: 'Agenda' }).getByText('Alice private meeting')).toBeVisible()

    const bob = await newClient(browser, { timezoneId: 'Europe/Berlin' })
    const bobPage = bob.page
    await signUpAndConfirm(bobPage, 'Bob')
    await bobPage.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Calendar' }).click()
    await expect(bobPage.getByRole('region', { name: 'Agenda' }).getByText('No events in this range.')).toBeVisible()
    const response = await bobPage.request.get(`/api/calendar/events?from=2020-01-01T00:00:00.000Z&to=2020-02-01T00:00:00.000Z`)
    expect(response.status()).toBe(200)
    expect(JSON.stringify(await response.json())).not.toContain('Alice')
    await bob.context.close()
  })
})
