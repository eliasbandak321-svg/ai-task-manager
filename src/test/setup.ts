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
