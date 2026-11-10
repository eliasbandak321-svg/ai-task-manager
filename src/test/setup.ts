// Runs before every test file.
import '@testing-library/jest-dom/vitest' // adds DOM matchers like toBeInTheDocument()
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Unmount rendered components after each test so tests don't leak into each other.
// (Testing Library only does this automatically when Vitest globals are enabled.)
afterEach(() => {
  cleanup()
})
