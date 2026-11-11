import { act, render, screen } from '@testing-library/react'
import { StrictMode, useState } from 'react'
import { describe, expect, it } from 'vitest'
import { Dialog } from './Dialog'

function Harness() {
  const [open, setOpen] = useState(true)
  return open ? (
    <Dialog title="Example" onClose={() => setOpen(false)}>
      <p>Body</p>
    </Dialog>
  ) : (
    <p>Closed</p>
  )
}

describe('Dialog', () => {
  it('stays open in StrictMode, which closes and reopens it while developing', async () => {
    render(
      <StrictMode>
        <Harness />
      </StrictMode>,
    )
    // Let the browser's asynchronous "close" event from StrictMode's remount arrive.
    await act(() => new Promise((resolve) => setTimeout(resolve, 10)))
    expect(screen.getByRole('dialog', { name: 'Example' })).toBeInTheDocument()
  })

  it('follows the browser when it closes the dialog by itself', async () => {
    render(<Harness />)
    await act(async () => {
      screen.getByRole('dialog').removeAttribute('open')
      screen.getByRole('dialog', { hidden: true }).dispatchEvent(new Event('close'))
    })
    expect(screen.getByText('Closed')).toBeInTheDocument()
  })
})
