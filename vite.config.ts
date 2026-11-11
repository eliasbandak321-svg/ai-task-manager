import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
// vitest/config re-exports Vite's defineConfig and adds types for the `test` block.
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The API runs as its own process (npm run dev:api). Proxying /api keeps the browser on one
  // origin, as in production, so cookies and URLs behave the same (docs/architecture.md §9).
  server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
  preview: { proxy: { '/api': 'http://127.0.0.1:8787' } },
  test: {
    // Half the CPU cores: each worker runs its own jsdom or database, and with every core busy,
    // machines with little memory (e.g. a default WSL setup) start swapping and tests time out.
    maxWorkers: '50%',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}', 'server/**/*.ts'],
      exclude: ['**/*.test.{ts,tsx}', 'src/test/**', 'server/test/**', 'src/main.tsx', 'server/dev.ts'],
      reporter: ['text', 'html'], // html report: coverage/index.html
    },
    // Two test projects: the browser code in a simulated DOM, the API and database in plain Node.
    projects: [
      {
        extends: true,
        test: {
          name: 'web',
          // jsdom simulates a browser DOM so components can render in Node.
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
          setupFiles: ['./src/test/setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'server',
          environment: 'node',
          include: ['server/**/*.test.ts'],
          // Each test file starts its own in-memory PostgreSQL (PGlite), which takes a moment.
          testTimeout: 20_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
})
