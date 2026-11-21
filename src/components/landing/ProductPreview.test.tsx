import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProductPreview } from './ProductPreview'

const heading = () => screen.getByRole('heading', { level: 3 })

describe('ProductPreview date (M10)', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'] }))
  afterEach(() => vi.useRealTimers())

  it("shows the visitor's current date, never a fixed one", () => {
    vi.setSystemTime(new Date(2026, 10, 21, 10, 0)) // Saturday, local time
    render(<ProductPreview />)
    expect(heading()).toHaveTextContent('Saturday, 21 November')
    expect(screen.queryByText(/Friday, 20 November/)).not.toBeInTheDocument()
  })

  it('moves to the new day at midnight while the page stays open', () => {
    vi.setSystemTime(new Date(2026, 10, 21, 23, 59, 30))
    render(<ProductPreview />)
    expect(heading()).toHaveTextContent('Saturday, 21 November')
    act(() => {
      vi.setSystemTime(new Date(2026, 10, 22, 0, 0, 30))
      vi.advanceTimersByTime(60_000)
    })
    expect(heading()).toHaveTextContent('Sunday, 22 November')
  })

  it('catches up when a suspended tab becomes visible again', () => {
    vi.setSystemTime(new Date(2026, 10, 20, 18, 0))
    render(<ProductPreview />)
    expect(heading()).toHaveTextContent('Friday, 20 November')
    act(() => {
      vi.setSystemTime(new Date(2026, 10, 23, 8, 0)) // the laptop slept over the weekend
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(heading()).toHaveTextContent('Monday, 23 November')
  })

  it('labels the sample session without a fake live countdown, and shows the current week', () => {
    vi.setSystemTime(new Date(2026, 10, 18, 9, 0)) // Wednesday
    render(<ProductPreview />)
    expect(screen.getByText(/sample session/)).toBeInTheDocument()
    expect(screen.queryByText(/in \d+ min/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Calendar' }))
    expect(heading()).toHaveTextContent('16 – 20 November')
    expect(screen.getByText('18')).toHaveClass('text-glow') // today is highlighted
  })
})
