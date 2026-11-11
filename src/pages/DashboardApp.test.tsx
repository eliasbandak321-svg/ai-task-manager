import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { RepositoryError } from '../data/errors'
import { createMemoryStorage, LocalRepository } from '../data/localRepository'
import { createQueryClient } from '../data/queryClient'
import { createFakeAuthClient } from '../test/fakeAuthClient'
import type { TaskRepository } from '../data/repository'
import DashboardApp from './DashboardApp'

// Full-app integration tests do a lot of rendering; give them room on slow CI machines.
vi.setConfig({ testTimeout: 20_000 })

/*
  Integration tests for the dashboard: the real components, hooks, TanStack Query and
  LocalRepository (with in-memory storage), driven the way a user would, through roles
  and labels. Only time is fixed, so deadlines are predictable.
*/

function LocationDisplay() {
  const location = useLocation()
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>
}

function createRepository() {
  return new LocalRepository({ storage: createMemoryStorage() })
}

function renderDashboard(
  path = '/app',
  repository: TaskRepository = createRepository(),
  authClient = createFakeAuthClient({ signedIn: true }),
) {
  const queryClient = createQueryClient({ retry: false })
  // No artificial delay between keystrokes: keeps these tests fast and stable under load.
  const user = userEvent.setup({ delay: null })
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/*"
          element={<DashboardApp repository={repository} authClient={authClient} queryClient={queryClient} />}
        />
      </Routes>
      <LocationDisplay />
    </MemoryRouter>,
  )
  return { user, repository, authClient }
}

/** A repository with an Inbox task and a "Work" project holding two tasks and a subtask. */
async function seededRepository() {
  const repository = createRepository()
  const [inbox] = await repository.listProjects()
  const work = await repository.createProject({ name: 'Work' })
  await repository.createTask({ projectId: inbox.id, title: 'Buy milk', priority: 'low' })
  const report = await repository.createTask({
    projectId: work.id,
    title: 'Write report',
    priority: 'high',
    dueDate: '2026-03-09',
  })
  await repository.createTask({ projectId: work.id, title: 'Plan sprint', dueDate: '2026-03-12' })
  await repository.createSubtask(report.id, { title: 'Draft outline' })
  return { repository, inbox, work, report }
}

const pageHeading = (name: string) => screen.findByRole('heading', { level: 1, name })
const taskTitles = () =>
  within(screen.getByRole('list', { name: 'Tasks' }))
    .getAllByRole('listitem')
    .map((item) => within(item).getAllByRole('button')[0].textContent)
const projectLink = (name: RegExp) => within(screen.getByRole('navigation', { name: 'Projects' })).queryByRole('link', { name })
const location = () => screen.getByTestId('location').textContent

beforeEach(() => {
  // Only fake the clock (not timers), so "today" is 2026-03-10 in every time zone.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-03-10T12:00:00'))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('dashboard: states', () => {
  it('shows a loading state, then an empty Inbox for a new user', async () => {
    renderDashboard()
    // First the session is checked, then the data loads.
    expect(screen.getByText(/checking your session/i)).toBeInTheDocument()
    expect(await screen.findByText(/loading your tasks/i)).toBeInTheDocument()

    expect(await pageHeading('All tasks')).toBeInTheDocument()
    expect(screen.getByText('No tasks yet')).toBeInTheDocument()
    expect(projectLink(/^Inbox/)).toBeInTheDocument()
  })

  it('shows an error with a working retry when loading fails', async () => {
    const repository = createRepository()
    const listTasks = vi.spyOn(repository, 'listTasks').mockRejectedValueOnce(new Error('network down'))
    const { user } = renderDashboard('/app', repository)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent("Your tasks couldn't be loaded")
    // Technical details are never shown to the user.
    expect(alert).not.toHaveTextContent('network down')

    await user.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(await pageHeading('All tasks')).toBeInTheDocument()
    expect(listTasks).toHaveBeenCalledTimes(2)
  })

  it('shows "not found" for an unknown project', async () => {
    renderDashboard('/app/projects/00000000-0000-4000-8000-ffffffffffff')
    expect(await pageHeading('Project not found')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to all tasks' })).toHaveAttribute('href', '/app')
  })
})

describe('dashboard: tasks', () => {
  it('adds tasks with the one-line form and validates the title', async () => {
    const { user } = renderDashboard()
    const input = await screen.findByRole('textbox', { name: 'Add a task to Inbox' })

    await user.type(input, '   {Enter}')
    expect(input).toHaveAccessibleDescription('Title is required')

    await user.type(input, 'Write the report{Enter}')
    expect(await screen.findByRole('button', { name: 'Write the report' })).toBeInTheDocument()
    expect(input).toHaveValue('')
    expect(input).not.toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('0 of 1 task done')).toBeInTheDocument()
  })

  it('creates a task with all its details', async () => {
    const { repository } = await seededRepository()
    const { user } = renderDashboard('/app', repository)

    await user.click(await screen.findByRole('button', { name: 'New task' }))
    const dialog = screen.getByRole('dialog', { name: 'New task' })
    expect(within(dialog).getByRole('textbox', { name: 'Title' })).toHaveFocus()

    await user.type(within(dialog).getByRole('textbox', { name: 'Title' }), 'Book flights')
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Project' }), 'Work')
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Priority' }), 'High')
    await user.type(within(dialog).getByLabelText(/^Deadline/), '2026-03-11')
    await user.click(within(dialog).getByRole('button', { name: 'Create task' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    const row = screen.getByRole('button', { name: 'Book flights' }).closest('li') as HTMLElement
    expect(row).toHaveTextContent('High priority')
    expect(row).toHaveTextContent('Due tomorrow')
    expect(row).toHaveTextContent('Work')
  })

  it('edits a task in its details dialog', async () => {
    const { repository } = await seededRepository()
    const { user } = renderDashboard('/app', repository)

    await user.click(await screen.findByRole('button', { name: 'Buy milk' }))
    const dialog = screen.getByRole('dialog', { name: 'Task details' })
    const title = within(dialog).getByRole('textbox', { name: 'Title' })
    await user.clear(title)
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    expect(title).toHaveAccessibleDescription('Title is required')

    await user.type(title, 'Buy oat milk')
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Status' }), 'In progress')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByRole('combobox', { name: 'Status of “Buy oat milk”' })).toHaveValue('in_progress')
  })

  it('changes the status from the list and updates the statistics', async () => {
    const { repository } = await seededRepository()
    const { user } = renderDashboard('/app', repository)

    const progress = await screen.findByRole('progressbar', { name: 'Overall progress' })
    expect(progress).toHaveAttribute('value', '0')
    const stats = screen.getByRole('region', { name: 'Overall progress' })
    expect(within(stats).getByText('Overdue').nextElementSibling).toHaveTextContent('1')

    await user.selectOptions(screen.getByRole('combobox', { name: 'Status of “Write report”' }), 'Done')

    await waitFor(() => expect(progress).toHaveAttribute('value', '33'))
    expect(screen.getByText('1 of 3 tasks done')).toBeInTheDocument()
    // A finished task is never overdue.
    expect(within(stats).getByText('Overdue').nextElementSibling).toHaveTextContent('0')
    expect((await repository.listTasks()).find((task) => task.title === 'Write report')?.completedAt).not.toBeNull()
  })

  it('rolls back an optimistic status change that fails to save, and says why', async () => {
    const { repository } = await seededRepository()
    vi.spyOn(repository, 'updateTask').mockRejectedValueOnce(new RepositoryError("Your changes couldn't be saved."))
    const { user } = renderDashboard('/app', repository)

    const status = await screen.findByRole('combobox', { name: 'Status of “Buy milk”' })
    await user.selectOptions(status, 'Done')

    expect(await screen.findByText("Your changes couldn't be saved.")).toBeInTheDocument()
    await waitFor(() => expect(status).toHaveValue('todo'))
  })

  it('confirms a status change even when a filter hides the task afterwards', async () => {
    const { repository } = await seededRepository()
    const { user } = renderDashboard('/app?status=todo', repository)

    await user.selectOptions(await screen.findByRole('combobox', { name: 'Status of “Buy milk”' }), 'Done')

    expect(await screen.findByText('Completed “Buy milk”')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Buy milk' })).not.toBeInTheDocument())
  })

  it('deletes a task and its subtasks only after confirmation', async () => {
    const { repository } = await seededRepository()
    const { user } = renderDashboard('/app', repository)

    await user.click(await screen.findByRole('button', { name: 'Write report' }))
    await user.click(screen.getByRole('button', { name: 'Delete task' }))
    const confirm = screen.getByRole('dialog', { name: 'Delete “Write report”?' })
    expect(confirm).toHaveAccessibleDescription(/deletes the task and its 1 subtask/)
    await user.click(within(confirm).getByRole('button', { name: 'Delete task' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.queryByRole('button', { name: 'Write report' })).not.toBeInTheDocument()
    expect(await screen.findByText('Deleted “Write report”')).toBeInTheDocument()
    expect(await repository.listSubtasks()).toEqual([])
  })
})

describe('dashboard: subtasks', () => {
  it('adds, checks off, reorders, renames and deletes subtasks', async () => {
    const { repository } = await seededRepository()
    const { user } = renderDashboard('/app', repository)

    await user.click(await screen.findByRole('button', { name: 'Write report' }))
    const dialog = screen.getByRole('dialog', { name: 'Task details' })
    const newSubtask = within(dialog).getByRole('textbox', { name: 'New subtask' })
    await user.type(newSubtask, 'Add charts{Enter}')
    await within(dialog).findByRole('checkbox', { name: 'Add charts' })

    await user.click(within(dialog).getByRole('checkbox', { name: 'Draft outline' }))
    await waitFor(() => expect(within(dialog).getByText('1 of 2 done')).toBeInTheDocument())

    await user.click(within(dialog).getByRole('button', { name: 'Move “Add charts” up' }))
    await waitFor(() =>
      expect(within(dialog).getAllByRole('checkbox').map((box) => box.closest('label')?.textContent)).toEqual([
        'Add charts',
        'Draft outline',
      ]),
    )

    await user.click(within(dialog).getByRole('button', { name: 'Rename “Add charts”' }))
    const renameInput = within(dialog).getByRole('textbox', { name: 'Subtask title' })
    expect(renameInput).toHaveFocus()
    await user.clear(renameInput)
    await user.type(renameInput, 'Add two charts{Enter}')
    await within(dialog).findByRole('checkbox', { name: 'Add two charts' })

    await user.click(within(dialog).getByRole('button', { name: 'Delete “Draft outline”' }))
    await waitFor(() => expect(within(dialog).queryByRole('checkbox', { name: 'Draft outline' })).not.toBeInTheDocument())
    // Feedback appears inside the dialog, and focus stays in the checklist.
    expect(within(dialog).getByText('Deleted “Draft outline”')).toBeInTheDocument()
    expect(within(dialog).getByRole('textbox', { name: 'New subtask' })).toHaveFocus()

    // The list row shows the checklist progress.
    await user.click(within(dialog).getByRole('button', { name: 'Close dialog' }))
    const row = screen.getByRole('button', { name: 'Write report' }).closest('li') as HTMLElement
    expect(row).toHaveTextContent('0/1 subtasks done')
  })

  it('cancels a rename with Escape without closing the task dialog', async () => {
    const { repository } = await seededRepository()
    const { user } = renderDashboard('/app', repository)

    await user.click(await screen.findByRole('button', { name: 'Write report' }))
    const dialog = screen.getByRole('dialog', { name: 'Task details' })
    await user.click(within(dialog).getByRole('button', { name: 'Rename “Draft outline”' }))
    await user.keyboard('{Escape}')

    expect(screen.getByRole('dialog', { name: 'Task details' })).toBeInTheDocument()
    expect(within(dialog).getByRole('checkbox', { name: 'Draft outline' })).toBeInTheDocument()
  })
})

describe('dashboard: projects', () => {
  it('creates a project, switches to it and adds a task there', async () => {
    const { user } = renderDashboard()

    await user.click(await screen.findByRole('button', { name: 'New project' }))
    const dialog = screen.getByRole('dialog', { name: 'New project' })
    await user.type(within(dialog).getByRole('textbox', { name: 'Project name' }), 'Garden{Enter}')

    expect(await pageHeading('Garden')).toBeInTheDocument()
    expect(location()).toMatch(/^\/app\/projects\//)
    // After navigating, focus moves to the main region (AppShell). Wait for that before typing,
    // or the focus change can land mid-word on a slow machine (seen once in CI).
    await waitFor(() => expect(document.getElementById('main')).toHaveFocus())
    await user.type(screen.getByRole('textbox', { name: 'Add a task to Garden' }), 'Plant tomatoes{Enter}')
    await screen.findByRole('button', { name: 'Plant tomatoes' })
    await waitFor(() => expect(projectLink(/^Garden, 0% done$/)).toBeInTheDocument())

    await user.click(projectLink(/^All tasks/) as HTMLElement)
    expect(await pageHeading('All tasks')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Plant tomatoes' }).closest('li')).toHaveTextContent('Garden')
  })

  it('explains duplicate and reserved names on the field', async () => {
    const { repository } = await seededRepository()
    const { user } = renderDashboard('/app', repository)

    await user.click(await screen.findByRole('button', { name: 'New project' }))
    const name = within(screen.getByRole('dialog')).getByRole('textbox', { name: 'Project name' })
    await user.type(name, 'work{Enter}')
    await waitFor(() => expect(name).toHaveAccessibleDescription('You already have a project called "work"'))

    await user.clear(name)
    await user.type(name, 'Inbox{Enter}')
    await waitFor(() => expect(name).toHaveAccessibleDescription(/reserved/))
  })

  it('renames a project, but offers no rename or delete for the Inbox', async () => {
    const { repository, inbox, work } = await seededRepository()
    const { user } = renderDashboard(`/app/projects/${inbox.id}`, repository)

    expect(await pageHeading('Inbox')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Rename project' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete project' })).not.toBeInTheDocument()

    await user.click(projectLink(/^Work/) as HTMLElement)
    await user.click(await screen.findByRole('button', { name: 'Rename project' }))
    const name = within(screen.getByRole('dialog', { name: 'Rename project' })).getByRole('textbox', {
      name: 'Project name',
    })
    await user.clear(name)
    await user.type(name, 'Office{Enter}')

    expect(await pageHeading('Office')).toBeInTheDocument()
    expect(location()).toBe(`/app/projects/${work.id}`)
  })

  it('deletes a project only after a clear confirmation (focus on Cancel, Escape cancels)', async () => {
    const { repository, work } = await seededRepository()
    const { user } = renderDashboard(`/app/projects/${work.id}`, repository)

    await user.click(await screen.findByRole('button', { name: 'Delete project' }))
    let confirm = screen.getByRole('dialog', { name: 'Delete “Work”?' })
    expect(confirm).toHaveAccessibleDescription(
      /permanently deletes the project “Work”\. All of its tasks and subtasks will be permanently deleted: 2 tasks and 1 subtask\. This can't be undone\./,
    )
    expect(within(confirm).getByRole('button', { name: 'Cancel' })).toHaveFocus()

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await repository.listTasks()).toHaveLength(3)

    await user.click(screen.getByRole('button', { name: 'Delete project' }))
    confirm = screen.getByRole('dialog', { name: 'Delete “Work”?' })
    await user.click(within(confirm).getByRole('button', { name: 'Delete project and 2 tasks' }))

    expect(await pageHeading('All tasks')).toBeInTheDocument()
    expect(location()).toBe('/app')
    expect(screen.getByText('Deleted “Work”')).toBeInTheDocument()
    await waitFor(() => expect(projectLink(/^Work/)).not.toBeInTheDocument())
    expect((await repository.listTasks()).map((task) => task.title)).toEqual(['Buy milk'])
    expect(await repository.listSubtasks()).toEqual([])
  })
})

describe('dashboard: search, filters and sorting', () => {
  it('filters by search, status and deadline, keeping the state in the URL', async () => {
    const { repository } = await seededRepository()
    const { user } = renderDashboard('/app', repository)

    // Default sort: by deadline, undated tasks last.
    await screen.findByRole('list', { name: 'Tasks' })
    expect(taskTitles()).toEqual(['Write report', 'Plan sprint', 'Buy milk'])

    await user.type(screen.getByRole('searchbox', { name: 'Search tasks' }), 'report')
    expect(taskTitles()).toEqual(['Write report'])
    expect(screen.getByText('Showing 1 of 3 tasks')).toBeInTheDocument()
    expect(location()).toBe('/app?q=report')

    await user.click(screen.getByRole('checkbox', { name: 'Done' }))
    expect(screen.getByText('No tasks match your filters')).toBeInTheDocument()
    await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0])
    expect(taskTitles()).toHaveLength(3)
    expect(location()).toBe('/app')

    await user.selectOptions(screen.getByRole('combobox', { name: 'Deadline' }), 'Overdue')
    expect(taskTitles()).toEqual(['Write report'])
  })

  it('sorts by the chosen field and direction', async () => {
    const { repository } = await seededRepository()
    const { user } = renderDashboard('/app', repository)
    await screen.findByRole('list', { name: 'Tasks' })

    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'Title')
    expect(taskTitles()).toEqual(['Buy milk', 'Plan sprint', 'Write report'])
    await user.selectOptions(screen.getByRole('combobox', { name: 'Order' }), 'Descending')
    expect(taskTitles()).toEqual(['Write report', 'Plan sprint', 'Buy milk'])
    expect(location()).toBe('/app?sort=title&dir=desc')
  })

  it('restores filters from the URL, ignoring invalid values', async () => {
    const { repository } = await seededRepository()
    renderDashboard('/app?priority=high&priority=urgent&sort=nonsense', repository)

    await screen.findByRole('list', { name: 'Tasks' })
    expect(taskTitles()).toEqual(['Write report'])
    expect(screen.getByRole('checkbox', { name: 'High' })).toBeChecked()
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toHaveValue('due_date')
  })
})
