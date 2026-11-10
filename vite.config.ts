import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
// vitest/config re-exports Vite's defineConfig and adds types for the `test` block.
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // jsdom simulates a browser DOM so components can render in Node.
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
