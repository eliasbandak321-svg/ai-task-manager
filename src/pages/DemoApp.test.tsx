import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { createQueryClient } from '../data/queryClient'
import { createDemoClients } from '../demo/demoClients'
import type { DemoStorage } from '../demo/demoStorage'
import { DEMO_PROJECTS } from '../demo/demoData'
import DashboardApp from './DashboardApp'

/*
  The portfolio demo (M11) in the real UI: the same screens as the full app, on the browser-only
  demo clients with fictional sample data, no sign-in, and clear demo labels.
*/

function memoryStorage(): DemoStorage {
  const items = new Map<string, string>()
  return { getItem: (key) => items.get(key) ?? null, setItem: (key, value) => void items.set(key, value), removeItem: (key) => void items.delete(key) }
}

function renderDemo(path: string) {
  const { repository, workspace, authClient } = createDemoClients({ storage: memoryStorage(), timeZone: 'UTC' })
  const user = userEvent.setup({ delay: null })
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/*"
          element={<DashboardApp demo repository={repository} workspace={workspace} authClient={authClient} queryClient={createQueryClient({ retry: false })} />}
        />
      </Routes>
    </MemoryRouter>,
  )
  return { user }
}

const heading = (name: string | RegExp) => screen.findByRole('heading', { level: 1, name }, { timeout: 3000 })
const mainNav = () => screen.getAllByRole('navigation', { name: 'Main' })[0]

describe('portfolio demo', () => {
  it('opens the app without signing in, with the demo notice and a reset button', async () => {
    renderDemo('/app')
    expect(await heading(/^Today,/)).toBeInTheDocument()
    const notice = screen.getByRole('region', { name: 'Demo notice' })
    expect(notice).toHaveTextContent(/fictional sample data/)
    expect(notice).toHaveTextContent(/simulated/)
    expect(within(notice).getByRole('button', { name: 'Reset demo' })).toBeInTheDocument()
  })

  it('shows the sample projects and moves through every main screen', async () => {
    const { user } = renderDemo('/app/projects')
    expect(await heading('All tasks')).toBeInTheDocument()
    expect(await screen.findByText('Write literature review')).toBeInTheDocument()
    for (const name of DEMO_PROJECTS) expect(screen.getAllByText(name).length).toBeGreaterThan(0)

    await user.click(within(mainNav()).getByRole('link', { name: /Calendar/ }))
    expect(await heading('Calendar')).toBeInTheDocument()
    await user.click(within(mainNav()).getByRole('link', { name: /Insights/ }))
    expect(await heading('Insights')).toBeInTheDocument()
    await user.click(within(mainNav()).getByRole('link', { name: /Settings/ }))
    expect(await heading('Settings')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /delete account/i })).not.toBeInTheDocument()
  })

  it('labels the assistant as simulated, and its proposals can be approved', async () => {
    const { user } = renderDemo('/app/assistant')
    expect(await heading(/AI Assistant/)).toBeInTheDocument()
    expect(screen.getByText(/Simulated AI\./)).toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: /message/i }), 'Set Apply to Northwind Labs to high priority')
    await user.keyboard('{Enter}')
    const approve = await screen.findByRole('button', { name: /Approve/ }, { timeout: 3000 })
    await user.click(approve)
    await waitFor(() => expect(screen.getAllByText(/applied|approved/i).length).toBeGreaterThan(0))
  })

  it('replaces the account pages with a notice: the demo has no accounts', async () => {
    renderDemo('/login')
    expect(await heading('No account needed')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open the demo' })).toHaveAttribute('href', '/app')
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
  })

  it('offers "Exit demo" instead of signing out', async () => {
    const { user } = renderDemo('/app')
    expect(await heading(/^Today,/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Account: Demo visitor' }))
    const menu = screen.getByRole('menu', { name: 'Account' })
    expect(within(menu).getByRole('menuitem', { name: /Exit demo/ })).toHaveAttribute('href', '/')
    expect(within(menu).queryByRole('menuitem', { name: /Sign out/ })).not.toBeInTheDocument()
  })

  it('has a public privacy notice', async () => {
    renderDemo('/privacy')
    expect(await heading('Privacy')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'The demo runs in your browser' })).toBeInTheDocument()
  })
})
