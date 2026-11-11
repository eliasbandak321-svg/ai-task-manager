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

  it('lazy-loads the dashboard at /app', async () => {
    // No API runs in this test; the dashboard shell still loads (and shows its error state).
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('offline'))
    renderAt('/app')
    expect(await screen.findByRole('navigation', { name: 'Projects' }, { timeout: 5000 })).toBeInTheDocument()
    expect(
      await screen.findByText("Couldn't reach the server. Check your connection and try again.", undefined, { timeout: 5000 }),
    ).toBeInTheDocument()
    vi.restoreAllMocks()
  })

  it('shows a not-found page for unknown URLs, with ways back', () => {
    renderAt('/nope')
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Open the app' })).toHaveAttribute('href', '/app')
  })
})
