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
    // Half the CPU cores: each worker runs its own jsdom, and with every core busy, machines
    // with little memory (e.g. a default WSL setup) start swapping and tests time out.
    maxWorkers: '50%',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx'],
      reporter: ['text', 'html'], // html report: coverage/index.html
    },
  },
})
