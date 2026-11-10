import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('increments the counter when clicked', async () => {
    // 1. Render the App
    render(<App />)

    // 2. Find the button
    const button = screen.getByRole('button', {
      name: /clicked 0 times/i,
    })

    // 3. Simulate a user click
    const user = userEvent.setup()
    await user.click(button)

    // 4. Check the result
    expect(button).toHaveTextContent(/^Clicked 1 time$/)
  })
})