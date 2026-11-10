import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
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
    renderAt('/app')
    expect(await screen.findByRole('heading', { level: 1, name: 'All tasks' }, { timeout: 5000 })).toBeInTheDocument()
  })

  it('shows a not-found page for unknown URLs, with ways back', () => {
    renderAt('/nope')
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to the home page' })).toHaveAttribute('href', '/')
    expect(screen.getByRole('link', { name: 'Open the app' })).toHaveAttribute('href', '/app')
  })
})
