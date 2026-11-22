import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { LandingPage } from './LandingPage'

function App() {
  return (
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>
  )
}

describe('LandingPage (M10)', () => {
  it('has one main heading with the hero headline', () => {
    render(<App />)
    const headings = screen.getAllByRole('heading', { level: 1 })
    expect(headings).toHaveLength(1)
    expect(headings[0]).toHaveTextContent(/^Less chaos\.\s*More focus\.$/)
  })

  it('sends Log in to the real sign-in page and Get started to sign-up', () => {
    render(<App />)
    const header = screen.getByRole('banner')
    expect(within(header).getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login')
    expect(within(header).getByRole('link', { name: 'Get started' })).toHaveAttribute('href', '/signup')
    for (const link of screen.getAllByRole('link', { name: /^Get started/ })) expect(link).toHaveAttribute('href', '/signup')
    expect(screen.getByRole('link', { name: 'See how it works' })).toHaveAttribute('href', '#how')
    expect(document.getElementById('how')).toBeInTheDocument()
  })

  it('lists the six real features and opens one at a time', async () => {
    const user = userEvent.setup()
    render(<App />)
    const features = screen.getByRole('region', { name: /one calm place/i })
    const buttons = within(features).getAllByRole('button', { expanded: false }).concat(within(features).getAllByRole('button', { expanded: true }))
    expect(buttons).toHaveLength(6)
    expect(within(features).getByRole('button', { expanded: true })).toHaveAccessibleName(/Projects, tasks and subtasks/)
    await user.click(within(features).getByRole('button', { name: /Smart scheduling/ }))
    expect(within(features).getByRole('button', { expanded: true })).toHaveAccessibleName(/Smart scheduling/)
  })

  it('shows a working approve/reject example that never claims real changes', async () => {
    const user = userEvent.setup()
    render(<App />)
    const example = screen.getByRole('region', { name: /example conversation/i })
    // The answer appears after a short "writing" pause.
    const approve = await within(example).findByRole('button', { name: 'Approve' }, { timeout: 3000 })
    await user.click(approve)
    expect(within(example).getByText(/Approved · 3 sessions added/)).toBeInTheDocument()
  })

  it('provides a skip link, the main landmarks and a theme toggle', () => {
    render(<App />)
    expect(screen.getByRole('link', { name: /skip to content/i })).toHaveAttribute('href', '#content')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'content')
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Switch to (dark|light) theme/ })).toBeInTheDocument()
  })
})
