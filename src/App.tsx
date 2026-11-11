import { lazy, Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { Route, Routes } from 'react-router'
import { LandingPage } from './pages/LandingPage'

/*
  Top-level routes:
  - /       the landing page (in the main bundle: it's what most first-time visitors see)
  - /*      everything else — sign-in, sign-up, the dashboard and "not found" — code-split
            into its own chunk (pages/DashboardApp.tsx) and loaded on first visit

  In production (M11) the host must serve index.html for these paths (SPA rewrites,
  docs/architecture.md §9). `vite dev` and `vite preview` already do.
*/

const DashboardApp = lazy(() => import('./pages/DashboardApp'))

const appLoading = (
  <output className="grid min-h-svh place-items-center text-sm text-ink-muted">Loading the app…</output>
)

const appLoadError = (
  <div role="alert" className="grid min-h-svh place-items-center p-6 text-center">
    <div>
      <p className="font-semibold text-ink">The app couldn't be loaded.</p>
      <p className="mt-1 text-sm text-ink-muted">Check your connection, then reload the page.</p>
    </div>
  </div>
)

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/*"
        element={
          <ErrorBoundary fallback={appLoadError}>
            <Suspense fallback={appLoading}>
              <DashboardApp />
            </Suspense>
          </ErrorBoundary>
        }
      />
    </Routes>
  )
}
