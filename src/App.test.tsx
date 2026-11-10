import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App (landing page)', () => {
  it('has one main heading with the hero headline', () => {
    render(<App />)

    const headings = screen.getAllByRole('heading', { level: 1 })
    expect(headings).toHaveLength(1)
    expect(headings[0]).toHaveTextContent(/^Turn scattered tasks into steady progress\.$/)
  })

  it('links the hero call-to-action to the features section', () => {
    render(<App />)

    const cta = screen.getByRole('link', { name: /explore features/i })
    expect(cta).toHaveAttribute('href', '#features')
    expect(document.getElementById('features')).toBeInTheDocument()
  })

  it('shows six feature cards, marking only the unbuilt one as coming soon', () => {
    render(<App />)

    const features = screen.getByRole('region', { name: /everything you need/i })
    const cards = within(features).getAllByRole('listitem')
    expect(cards).toHaveLength(6)

    const comingSoon = within(features).getAllByRole('heading', { level: 3, name: /coming soon/i })
    expect(comingSoon).toHaveLength(1)
    expect(comingSoon[0]).toHaveAccessibleName('Break it down with AI (coming soon)')
  })

  it('provides a skip link and the main landmarks', () => {
    render(<App />)

    expect(screen.getByRole('link', { name: /skip to content/i })).toHaveAttribute('href', '#content')
    expect(screen.getByRole('main')).toHaveAttribute('id', 'content')
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })
})
