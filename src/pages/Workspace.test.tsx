import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { createMemoryStorage, LocalRepository } from '../data/localRepository'
import { createQueryClient } from '../data/queryClient'
import { createFakeAuthClient } from '../test/fakeAuthClient'
import { createFakeWorkspaceClient } from '../test/fakeWorkspaceClient'
import DashboardApp from './DashboardApp'

vi.setConfig({ testTimeout: 20_000 })

/*
  M9 pages in the browser: the real components, hooks and TanStack Query, with an in-memory
  repository and workspace client (real domain logic, canned demo AI).
*/

function LocationDisplay() {
  const location = useLocation()
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>
}

async function renderWorkspace(path: string, seed?: (repository: LocalRepository) => Promise<void>) {
  const repository = new LocalRepository({ storage: createMemoryStorage() })
  await seed?.(repository)
  const workspace = createFakeWorkspaceClient(repository)
  const user = userEvent.setup({ delay: null })
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/*"
          element={<DashboardApp repository={repository} authClient={createFakeAuthClient({ signedIn: true })} queryClient={createQueryClient({ retry: false })} workspace={workspace} />}
        />
      </Routes>
      <LocationDisplay />
    </MemoryRouter>,
  )
  return { user, repository, workspace }
}

const heading = (name: string | RegExp) => screen.findByRole('heading', { level: 1, name })
const location = () => screen.getByTestId('location').textContent

describe('navigation and dashboard', () => {
  it('shows every section in the main navigation and the dashboard overview', async () => {
    const { user } = await renderWorkspace('/app')
    expect(await heading('Dashboard')).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Main' })
    for (const name of ['Dashboard', 'Calendar', 'Projects', 'AI Assistant', 'Insights', 'Settings']) {
      expect(within(nav).getByRole('link', { name })).toBeInTheDocument()
    }
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page')
    expect(await screen.findByRole('link', { name: /Set availability/ })).toBeInTheDocument()

    await user.click(within(nav).getByRole('link', { name: 'Projects' }))
    expect(await heading('All tasks')).toBeInTheDocument()
    expect(location()).toBe('/app/projects')
  })
})

describe('settings', () => {
  it('saves availability and shows the demo AI status honestly', async () => {
    const { user, workspace } = await renderWorkspace('/app/settings')
    expect(await heading('Settings')).toBeInTheDocument()
    expect(await screen.findByText(/No AI service is connected/)).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: 'Saturday' }))
    const end = screen.getByLabelText('Day ends')
    await user.clear(end)
    await user.type(end, '18:30')
    await user.click(screen.getByRole('button', { name: 'Save settings' }))
    await waitFor(() => expect(workspace.calls.some((call) => call.method === 'savePreferences')).toBe(true))
    const saved = workspace.calls.find((call) => call.method === 'savePreferences')?.args[0] as { workDays: number[]; dayEndMinutes: number }
    expect(saved.workDays).toContain(6)
    expect(saved.dayEndMinutes).toBe(18 * 60 + 30)
  })

  it('refuses invalid working hours with a message', async () => {
    const { user, workspace } = await renderWorkspace('/app/settings')
    await heading('Settings')
    for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) await user.click(screen.getByRole('checkbox', { name: day }))
    await user.click(screen.getByRole('button', { name: 'Save settings' }))
    expect(await screen.findByText('Choose at least one working day')).toBeInTheDocument()
    expect(workspace.calls.some((call) => call.method === 'savePreferences')).toBe(false)
  })
})

describe('AI assistant', () => {
  it('labels demo answers and applies a suggested change only after approval', async () => {
    const { user, repository } = await renderWorkspace('/app/assistant', async (repo) => {
      const [inbox] = await repo.listProjects()
      await repo.createTask({ projectId: inbox.id, title: 'Write report' })
    })
    expect(await heading(/AI Assistant/)).toBeInTheDocument()
    expect(await screen.findByText(/Demo mode/)).toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'Set Write report to high priority{Enter}')
    expect(await screen.findByText(/Approve it below/)).toBeInTheDocument()
    expect(screen.getAllByText('Demo AI').length).toBeGreaterThan(0)
    expect((await repository.listTasks())[0].priority).toBe('medium')

    await user.click(screen.getByRole('button', { name: 'Approve' }))
    await waitFor(async () => expect((await repository.listTasks())[0].priority).toBe('high'))
    expect(await screen.findByText(/^Applied/)).toBeInTheDocument()
  })
})

describe('plan builder', () => {
  it('generates a plan, lets the user edit it, and creates the project once', async () => {
    const { user, repository } = await renderWorkspace('/app/assistant/plan?goal=Learn%20Spanish')
    expect(await heading('Plan a goal')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Your goal/ })).toHaveValue('Learn Spanish')

    await user.click(screen.getByRole('button', { name: 'Generate plan' }))
    expect(await screen.findByRole('heading', { name: 'Plan preview' })).toBeInTheDocument()
    expect(screen.getByText(/template plan from the demo provider/)).toBeInTheDocument()

    const name = screen.getByRole('textbox', { name: 'Project name' })
    await user.clear(name)
    await user.type(name, 'Spanish A1')
    await user.click(screen.getByRole('button', { name: 'Remove Do the first step' }))
    expect(screen.queryByDisplayValue('Do the first step')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Create project' }))

    await waitFor(() => expect(location()).toMatch(/^\/app\/projects\/[0-9a-f-]+$/))
    const projects = await repository.listProjects()
    const created = projects.find((project) => project.name === 'Spanish A1')
    expect(created).toBeDefined()
    expect((await repository.listTasks()).map((task) => task.title)).toEqual(['Outline the goal'])
  })
})

describe('task AI help', () => {
  it('suggests a checklist that is added as subtasks only after approval', async () => {
    const { user, repository } = await renderWorkspace('/app/projects', async (repo) => {
      const [inbox] = await repo.listProjects()
      await repo.createTask({ projectId: inbox.id, title: 'Essay', estimatedMinutes: 90 })
    })
    await user.click(await screen.findByRole('button', { name: 'Essay' }))
    const dialog = await screen.findByRole('dialog', { name: 'Task details' })
    expect(within(dialog).getByRole('spinbutton', { name: /Estimate/ })).toHaveValue(90)

    await user.click(within(dialog).getByRole('button', { name: 'Suggest a checklist' }))
    expect(await within(dialog).findByText('Demo help (checklist).')).toBeInTheDocument()
    expect(await repository.listSubtasks()).toEqual([])
    await user.click(within(dialog).getByRole('button', { name: 'Approve' }))
    await waitFor(async () => expect((await repository.listSubtasks()).map((s) => s.title)).toEqual(['Research', 'Draft']))
  })
})

describe('insights', () => {
  it('shows counts, suggestions and an accessible workload table', async () => {
    await renderWorkspace('/app/insights', async (repo) => {
      const [inbox] = await repo.listProjects()
      await repo.createTask({ projectId: inbox.id, title: 'Done thing', status: 'done' })
      await repo.createTask({ projectId: inbox.id, title: 'Open thing' })
    })
    expect(await heading('Insights')).toBeInTheDocument()
    expect(screen.getByText('Completed').nextElementSibling).toHaveTextContent('1')
    expect(screen.getByRole('table', { name: 'Planned work per day' })).toBeInTheDocument()
    expect(screen.getByText(/no time estimate/)).toBeInTheDocument()
  })
})

describe('calendar', () => {
  it('adds an event from the dialog and lists it in the agenda', async () => {
    const { user, workspace } = await renderWorkspace('/app/calendar')
    expect(await heading('Calendar')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'New event' }))
    const dialog = await screen.findByRole('dialog', { name: 'New event' })
    await user.type(within(dialog).getByRole('textbox', { name: 'Title' }), 'Study session')
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Category' }), 'study')
    await user.click(within(dialog).getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(workspace.events).toHaveLength(1))
    expect(workspace.events[0]).toMatchObject({ title: 'Study session', category: 'study' })
  })

  it('offers scheduling for unscheduled tasks and shows the proposal for approval', async () => {
    const { user, workspace } = await renderWorkspace('/app/calendar', async (repo) => {
      const [inbox] = await repo.listProjects()
      await repo.createTask({ projectId: inbox.id, title: 'Report', estimatedMinutes: 60 })
    })
    await user.click(await screen.findByRole('button', { name: 'Schedule Report' }))
    await waitFor(() => expect(workspace.calls.some((call) => call.method === 'proposeSchedule')).toBe(true))
    expect(await screen.findByRole('heading', { name: 'Proposed schedule' })).toBeInTheDocument()
    expect(screen.getByText('Scheduler')).toBeInTheDocument()
  })
})
