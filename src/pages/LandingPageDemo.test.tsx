import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

/*
  The landing page in the portfolio demo build (VITE_DEMO=1, M11): "View demo" replaces the
  account links. The normal build's links are covered in LandingPage.test.tsx.
*/

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

async function renderDemoLanding() {
  vi.stubEnv('VITE_DEMO', '1')
  vi.resetModules()
  const { LandingPage } = await import('./LandingPage')
  render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  )
}

describe('LandingPage in the demo build', () => {
  it('offers "View demo" everywhere instead of sign-up and log-in', async () => {
    await renderDemoLanding()
    const header = screen.getByRole('banner')
    expect(within(header).getByRole('link', { name: 'View demo' })).toHaveAttribute('href', '/app')
    const demoLinks = screen.getAllByRole('link', { name: /^View demo/ })
    expect(demoLinks.length).toBeGreaterThanOrEqual(3)
    for (const link of demoLinks) expect(link).toHaveAttribute('href', '/app')
    expect(screen.queryByRole('link', { name: 'Log in' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Get started/ })).not.toBeInTheDocument()
    expect(screen.getByText(/No sign-up, and nothing leaves your browser/)).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Source on GitHub' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy')
  })
})
