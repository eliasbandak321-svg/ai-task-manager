import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { AuthRequiredError } from '../data/errors'
import { createMemoryStorage, LocalRepository } from '../data/localRepository'
import { createQueryClient } from '../data/queryClient'
import { createFakeAuthClient, TEST_PASSWORD, TEST_USER, VALID_RESET_TOKEN } from '../test/fakeAuthClient'
import { createFakeWorkspaceClient } from '../test/fakeWorkspaceClient'
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
        <Route
          path="/*"
          element={
            <DashboardApp
              repository={repository}
              authClient={authClient}
              queryClient={queryClient}
              workspace={createFakeWorkspaceClient(repository)}
            />
          }
        />
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
    const { user } = renderApp('/app/projects?q=report')

    expect(await heading('Sign in')).toBeInTheDocument()
    expect(location()).toBe('/login?next=%2Fapp%2Fprojects%3Fq%3Dreport')

    await fillLogin(user, TEST_USER.email, TEST_PASSWORD)
    expect(await heading('All tasks')).toBeInTheDocument()
    expect(location()).toBe('/app/projects?q=report')
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
    expect(await heading('Dashboard')).toBeInTheDocument()
    expect(location()).toBe('/app')
  })

  it('takes signed-in users straight past the login and sign-up pages', async () => {
    renderApp('/login', { signedIn: true })
    expect(await heading('Dashboard')).toBeInTheDocument()
    expect(location()).toBe('/app')
  })
})

describe('signing up (email confirmation required)', () => {
  async function fillSignUp(user: ReturnType<typeof userEvent.setup>, email: string, password = 'a long enough password') {
    await user.type(await screen.findByRole('textbox', { name: 'Name' }), 'Grace Hopper')
    await user.type(screen.getByRole('textbox', { name: 'Email' }), email)
    await user.type(screen.getByLabelText('Password'), password)
    await user.click(screen.getByRole('button', { name: 'Create account' }))
  }

  it('asks the new user to confirm their email; they can sign in once confirmed', async () => {
    const { user, authClient } = renderApp('/signup')
    await fillSignUp(user, 'Grace@Example.test')

    expect(await heading('Check your email')).toBeInTheDocument()
    expect(screen.getByText('grace@example.test')).toBeInTheDocument()
    expect(authClient.currentUser).toBeNull()

    // Signing in before confirming explains what to do.
    await user.click(screen.getByRole('link', { name: 'Back to sign in' }))
    await fillLogin(user, 'grace@example.test', 'a long enough password')
    expect(await screen.findByRole('alert')).toHaveTextContent('Please confirm your email address first.')

    authClient.confirmEmail('grace@example.test')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await heading('Dashboard')).toBeInTheDocument()
    expect(await screen.findByText('Nothing is due today or overdue.')).toBeInTheDocument()
  })

  it('shows the same confirmation for an email that already has an account (no enumeration)', async () => {
    const { user } = renderApp('/signup')
    await fillSignUp(user, TEST_USER.email)
    expect(await heading('Check your email')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('validates the form', async () => {
    const { user } = renderApp('/signup')
    await fillSignUp(user, 'not-an-email', 'short')
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveAccessibleDescription('Enter a valid email address')
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription(
      'At least 8 characters. Password must be at least 8 characters',
    )
  })
})

describe('password reset', () => {
  it('requests a reset link from the login page, with the same answer for any email', async () => {
    const { user, authClient } = renderApp('/login')
    await user.click(await screen.findByRole('link', { name: 'Forgot your password?' }))
    expect(await heading('Reset your password')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Send reset link' }))
    expect(screen.getByRole('textbox', { name: 'Email' })).toHaveAccessibleDescription('Enter a valid email address')

    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'someone@example.test')
    await user.click(screen.getByRole('button', { name: 'Send reset link' }))
    expect(await heading('Check your email')).toBeInTheDocument()
    expect(screen.getByText(/If an account exists for/)).toHaveTextContent('someone@example.test')
    expect(authClient.resetRequests).toEqual(['someone@example.test'])
  })

  it('sets a new password from the emailed link, then asks to sign in with it', async () => {
    const { user, authClient } = renderApp(`/reset-password?token=${VALID_RESET_TOKEN}`)

    await user.type(await screen.findByLabelText('New password'), 'a brand new passphrase')
    await user.type(screen.getByLabelText('Confirm new password'), 'a different passphrase')
    await user.click(screen.getByRole('button', { name: 'Change password' }))
    expect(screen.getByLabelText('Confirm new password')).toHaveAccessibleDescription('The passwords don’t match')

    await user.clear(screen.getByLabelText('Confirm new password'))
    await user.type(screen.getByLabelText('Confirm new password'), 'a brand new passphrase')
    await user.click(screen.getByRole('button', { name: 'Change password' }))

    expect(await heading('Sign in')).toBeInTheDocument()
    expect(location()).toBe('/login?reset=success')
    expect(screen.getByText('Your password has been changed. Sign in with your new password.')).toBeInTheDocument()
    expect(authClient.accountFor(TEST_USER.email)?.password).toBe('a brand new passphrase')
  })

  it.each(['/reset-password', '/reset-password?error=INVALID_TOKEN'])('explains an unusable link at %s', async (path) => {
    renderApp(path)
    expect(await heading('This link can’t be used')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('This reset link is invalid or has expired.')
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute('href', '/forgot-password')
  })

  it('reports a token the server rejects', async () => {
    const { user } = renderApp('/reset-password?token=expired-token')
    await user.type(await screen.findByLabelText('New password'), 'a brand new passphrase')
    await user.type(screen.getByLabelText('Confirm new password'), 'a brand new passphrase')
    await user.click(screen.getByRole('button', { name: 'Change password' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This reset link is invalid or has expired.')
  })
})

describe('email confirmation page', () => {
  it('welcomes a confirmed user into the app', async () => {
    renderApp('/email-verified', { signedIn: true })
    expect(await heading('Email confirmed')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to your tasks' })).toHaveAttribute('href', '/app')
  })

  it('explains an invalid or expired confirmation link', async () => {
    renderApp('/email-verified?error=invalid_token')
    expect(await heading('This link can’t be used')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('This confirmation link is invalid or has expired.')
  })
})

describe('signing out and expired sessions', () => {
  it('signs out, forgets all loaded data, and protects the app again', async () => {
    const repository = new LocalRepository({ storage: createMemoryStorage() })
    const [inbox] = await repository.listProjects()
    await repository.createTask({ projectId: inbox.id, title: 'Private task' })
    const { user, queryClient } = renderApp('/app/projects', { signedIn: true, repository })

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
