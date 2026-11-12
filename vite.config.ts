import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
// vitest/config re-exports Vite's defineConfig and adds types for the `test` block.
import { defineConfig } from 'vitest/config'

const webPort = Number(process.env.WEB_PORT ?? 5173)
const apiTarget = `http://127.0.0.1:${process.env.API_PORT ?? 8787}`

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The API runs as its own process (npm run dev:api). Proxying /api keeps the browser on one
  // origin, as in production, so cookies and URLs behave the same (docs/architecture.md §9).
  // xfwd adds X-Forwarded-For, so the API's rate limiting sees the browser's address.
  // The app must run at the origin the API trusts (APP_ORIGIN, default http://localhost:5173):
  // strictPort makes Vite stop with an error instead of quietly moving to another port,
  // which the API's CSRF check would (rightly) refuse.
  // WEB_PORT and API_PORT exist for the end-to-end tests, which run on their own ports.
  server: { port: webPort, strictPort: true, proxy: { '/api': { target: apiTarget, xfwd: true } } },
  preview: { port: webPort, strictPort: true, proxy: { '/api': { target: apiTarget, xfwd: true } } },
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
          // Each test file starts its own in-memory PostgreSQL (PGlite), which takes a moment and
          // a few hundred MB. Running these files one at a time keeps memory use predictable.
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
})
