import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AuthRequiredError } from '../data/errors'
import { createMemoryStorage, LocalRepository } from '../data/localRepository'
import { createQueryClient } from '../data/queryClient'
import { createFakeAuthClient, TEST_PASSWORD, TEST_USER } from '../test/fakeAuthClient'
import DashboardApp from './DashboardApp'

/*
  The sign-in experience in the UI, with a fake AuthClient (same interface and errors as the
  real one). The server side — sessions, cookies, CSRF, isolation — is tested against the real
  Better Auth in server/auth.test.ts.
*/

function LocationDisplay() {
  const location = useLocation()
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>
}

function renderApp(path: string, { signedIn = false, repository = new LocalRepository({ storage: createMemoryStorage() }) } = {}) {
  const authClient = createFakeAuthClient({ signedIn })
  const queryClient = createQueryClient({ retry: false })
  const user = userEvent.setup({ delay: null })
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/*" element={<DashboardApp repository={repository} authClient={authClient} queryClient={queryClient} />} />
      </Routes>
      <LocationDisplay />
    </MemoryRouter>,
  )
  return { user, authClient, queryClient, repository }
}

const location = () => screen.getByTestId('location').textContent
const heading = (name: string) => screen.findByRole('heading', { level: 1, name })

async function fillLogin(user: ReturnType<typeof userEvent.setup>, email: string, password: string) {
  await user.type(await screen.findByRole('textbox', { name: 'Email' }), email)
  await user.type(screen.getByLabelText('Password'), password)
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
}

describe('signing in', () => {
  it('sends signed-out visitors to the login page, then back to where they were going', async () => {
    const { user } = renderApp('/app?q=report')

    expect(await heading('Sign in')).toBeInTheDocument()
    expect(location()).toBe('/login?next=%2Fapp%3Fq%3Dreport')

    await fillLogin(user, TEST_USER.email, TEST_PASSWORD)
    expect(await heading('All tasks')).toBeInTheDocument()
    expect(location()).toBe('/app?q=report')
    expect(screen.getByText(TEST_USER.name)).toBeInTheDocument()
    expect(screen.getByText(TEST_USER.email)).toBeInTheDocument()
  })

  it('explains wrong credentials and invalid input without signing in', async () => {
    const { user, authClient } = renderApp('/login')

    await user.click(await screen.findByRole('button', { name: 'Sign in' }))
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveAccessibleDescription('Enter a valid email address')
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Password is required')

    await fillLogin(user, TEST_USER.email, 'wrong password')
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.')
    expect(authClient.currentUser).toBeNull()
    expect(location()).toBe('/login')
  })

  it('ignores a "next" link that points to another website (no open redirect)', async () => {
    const { user } = renderApp('/login?next=https%3A%2F%2Fevil.example%2Fphish')
    await fillLogin(user, TEST_USER.email, TEST_PASSWORD)
    expect(await heading('All tasks')).toBeInTheDocument()
    expect(location()).toBe('/app')
  })

  it('takes signed-in users straight past the login and sign-up pages', async () => {
    renderApp('/login', { signedIn: true })
    expect(await heading('All tasks')).toBeInTheDocument()
    expect(location()).toBe('/app')
  })
})

describe('signing up', () => {
  it('creates an account and opens the new user’s empty Inbox', async () => {
    const { user, authClient } = renderApp('/signup')

    await user.type(await screen.findByRole('textbox', { name: 'Name' }), 'Grace Hopper')
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'Grace@Example.test')
    await user.type(screen.getByLabelText('Password'), 'a long enough password')
    await user.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await heading('All tasks')).toBeInTheDocument()
    expect(authClient.currentUser).toMatchObject({ name: 'Grace Hopper', email: 'grace@example.test' })
    expect(screen.getByText('No tasks yet')).toBeInTheDocument()
  })

  it('validates the form and explains a taken email', async () => {
    const { user } = renderApp('/signup')

    await user.type(await screen.findByRole('textbox', { name: 'Name' }), 'Ada')
    await user.type(screen.getByRole('textbox', { name: 'Email' }), TEST_USER.email)
    await user.type(screen.getByLabelText('Password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(
      'At least 8 characters. Password must be at least 8 characters',
    )

    await user.type(screen.getByLabelText('Password'), ' but longer now')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('An account with this email already exists. Sign in instead.')
  })
})

describe('signing out and expired sessions', () => {
  it('signs out, forgets all loaded data, and protects the app again', async () => {
    const repository = new LocalRepository({ storage: createMemoryStorage() })
    const [inbox] = await repository.listProjects()
    await repository.createTask({ projectId: inbox.id, title: 'Private task' })
    const { user, queryClient } = renderApp('/app', { signedIn: true, repository })

    expect(await screen.findByRole('button', { name: 'Private task' })).toBeInTheDocument()
    await user.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Sign out' }))

    expect(await heading('Sign in')).toBeInTheDocument()
    expect(location()).toBe('/login')
    // Nothing of the previous user's data stays in the browser's cache.
    expect(queryClient.getQueryData(['tasks'])).toBeUndefined()
    expect(queryClient.getQueryData(['projects'])).toBeUndefined()
  })

  it('returns to the login page when the server says the session has expired', async () => {
    const repository = new LocalRepository({ storage: createMemoryStorage() })
    vi.spyOn(repository, 'listTasks').mockRejectedValue(new AuthRequiredError())
    renderApp('/app/projects/123', { signedIn: true, repository })

    expect(await heading('Sign in')).toBeInTheDocument()
    await waitFor(() => expect(location()).toBe('/login?next=%2Fapp%2Fprojects%2F123'))
  })
})
