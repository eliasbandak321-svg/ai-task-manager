// Runs before every test file.
import '@testing-library/jest-dom/vitest' // adds DOM matchers like toBeInTheDocument()
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Unmount rendered components after each test so tests don't leak into each other.
// (Testing Library only does this automatically when Vitest globals are enabled.)
afterEach(() => {
  cleanup()
})

// jsdom has no canvas/WebGL; its getContext() logs "Not implemented". Returning null states
// "no WebGL" explicitly, so components take their fallback path quietly.
HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext

/*
  jsdom doesn't implement <dialog>'s showModal() and close(). This minimal stand-in covers what
  our Dialog component relies on: the open state, the "close" event, and Escape firing a
  cancelable "cancel" event on the topmost open dialog (unless the keydown was prevented).
  Real browsers provide the rest (focus trapping, inert background), verified manually.
*/
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented) return
    const dialogs = document.querySelectorAll<HTMLDialogElement>('dialog[open]')
    const top = dialogs[dialogs.length - 1]
    if (top && top.dispatchEvent(new Event('cancel', { cancelable: true }))) top.close()
  })
}
