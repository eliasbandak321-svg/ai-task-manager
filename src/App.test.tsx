import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router'
import { App } from './App'

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('App routes', () => {
  it('shows the landing page at /', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Turn scattered tasks into steady progress.')
  })

  it('lazy-loads the app at /app, which first checks the session', async () => {
    // No API runs in this test: the session check fails, and the app says so (with a retry).
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'))
    renderAt('/app')
    expect(await screen.findByText("We couldn't check your session", undefined, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByText("Couldn't reach the server. Check your connection and try again.")).toBeInTheDocument()
    vi.restoreAllMocks()
  })

  it('shows a not-found page for unknown URLs, with ways back', async () => {
    renderAt('/nope')
    expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' }, { timeout: 5000 })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Open the app' })).toHaveAttribute('href', '/app')
  })
})
