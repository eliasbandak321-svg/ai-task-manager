import { expect, newClient, signUpAndConfirm, test } from './support'

test.describe('projects and tasks', () => {
  test('creates and manages a project with tasks and subtasks', async ({ page }) => {
    await signUpAndConfirm(page, 'Planner')

    // Project
    await page.getByRole('button', { name: 'New project' }).click()
    await page.getByRole('textbox', { name: 'Project name' }).fill('Website relaunch')
    await page.getByRole('button', { name: 'Create project' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Website relaunch' })).toBeVisible()

    // Quick add
    const quickAdd = page.getByRole('textbox', { name: 'Add a task to Website relaunch' })
    for (const title of ['Write homepage copy', 'Design logo', 'Set up analytics']) {
      await quickAdd.fill(title)
      await quickAdd.press('Enter')
      await expect(page.getByRole('button', { name: title, exact: true })).toBeVisible()
    }

    // Details and subtasks
    await page.getByRole('button', { name: 'Write homepage copy' }).click()
    const dialog = page.getByRole('dialog', { name: 'Task details' })
    await dialog.getByRole('combobox', { name: 'Priority' }).selectOption('high')
    for (const step of ['Headline', 'Pricing section']) {
      await dialog.getByRole('textbox', { name: 'New subtask' }).fill(step)
      await dialog.getByRole('textbox', { name: 'New subtask' }).press('Enter')
      await expect(dialog.getByRole('checkbox', { name: step })).toBeVisible()
    }
    // click, then wait: the checkbox follows the optimistic update a moment later.
    await dialog.getByRole('checkbox', { name: 'Headline' }).click()
    await expect(dialog.getByRole('checkbox', { name: 'Headline' })).toBeChecked()
    await expect(dialog.getByText('1 of 2 done')).toBeVisible()
    await dialog.getByRole('button', { name: 'Save changes' }).click()
    await expect(dialog).toBeHidden()
    const row = page.getByRole('listitem').filter({ has: page.getByRole('button', { name: 'Write homepage copy' }) })
    await expect(row).toContainText('High priority')
    await expect(row).toContainText('1/2')

    // Status and statistics
    await page.getByRole('combobox', { name: 'Status of “Design logo”' }).selectOption('done')
    await expect(page.getByText('1 of 3 tasks done')).toBeVisible()

    // Search
    await page.getByRole('searchbox', { name: 'Search tasks' }).fill('analytics')
    await expect(page.getByRole('list', { name: 'Tasks' }).getByRole('listitem')).toHaveCount(1)
    await page.getByRole('searchbox', { name: 'Search tasks' }).fill('')

    // Delete a task
    await page.getByRole('button', { name: 'Set up analytics' }).click()
    await page.getByRole('dialog', { name: 'Task details' }).getByRole('button', { name: 'Delete task' }).click()
    await page.getByRole('dialog', { name: 'Delete “Set up analytics”?' }).getByRole('button', { name: 'Delete task' }).click()
    await expect(page.getByRole('button', { name: 'Set up analytics' })).toBeHidden()

    // Persisted on the server
    await page.reload()
    await expect(page.getByRole('button', { name: 'Write homepage copy' })).toBeVisible()

    // Delete the project after a clear confirmation
    await page.getByRole('button', { name: 'Delete project' }).click()
    const confirm = page.getByRole('dialog', { name: 'Delete “Website relaunch”?' })
    await expect(confirm).toContainText('2 tasks and 2 subtasks')
    await expect(confirm.getByRole('button', { name: 'Cancel' })).toBeFocused()
    await confirm.getByRole('button', { name: 'Delete project and 2 tasks' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'All tasks' })).toBeVisible()
    await expect(page.getByText('No tasks yet')).toBeVisible()
  })

  test('two users can’t see or change each other’s data', async ({ page, browser }) => {
    await signUpAndConfirm(page, 'Alice')
    const quickAdd = page.getByRole('textbox', { name: /^Add a task to/ })
    await quickAdd.fill('Alice private task')
    await quickAdd.press('Enter')
    await expect(page.getByRole('button', { name: 'Alice private task' })).toBeVisible()
    const aliceTaskId = await page.evaluate(async () => ((await (await fetch('/api/tasks')).json()) as { id: string }[])[0].id)

    const bob = await newClient(browser)
    await signUpAndConfirm(bob.page, 'Bob')
    await expect(bob.page.getByText('No tasks yet')).toBeVisible()
    const statuses = await bob.page.evaluate(async (id) => {
      const patch = await fetch(`/api/tasks/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'Hacked' }) })
      const remove = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
      return [patch.status, remove.status]
    }, aliceTaskId)
    expect(statuses).toEqual([404, 404])
    await bob.context.close()

    await page.reload()
    await expect(page.getByRole('button', { name: 'Alice private task' })).toBeVisible()
  })
})
