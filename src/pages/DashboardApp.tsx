import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Route, Routes } from 'react-router'
import { AppShell } from '../components/dashboard/AppShell'
import { NotFoundMessage } from '../components/dashboard/NotFoundMessage'
import { Toaster } from '../components/dashboard/Toaster'
import { HttpRepository } from '../data/httpRepository'
import type { TaskRepository } from '../data/repository'
import { RepositoryContext } from '../data/repositoryContext'
import { TasksPage } from './TasksPage'

/*
  The dashboard (/app/*). It's loaded lazily from App.tsx, so visitors of the landing page
  never download it, nor React Query.

  This is the single place that decides which repository the app uses: since M6, the HTTP
  adapter talking to the API on the same origin (/api). Nothing else in the UI knows.
  (LocalRepository still exists: the UI tests use it as a fast in-memory backend, and it
  passes the same contract tests.)
*/

let defaultRepository: TaskRepository | undefined
function getDefaultRepository(): TaskRepository {
  defaultRepository ??= new HttpRepository()
  return defaultRepository
}

const defaultQueryClient = new QueryClient({
  defaultOptions: {
    // Refetching when the window regains focus also picks up changes made in another tab.
    queries: { retry: 1 },
  },
})

interface DashboardAppProps {
  /** Tests pass their own repository and query client. */
  repository?: TaskRepository
  queryClient?: QueryClient
}

export default function DashboardApp({ repository, queryClient = defaultQueryClient }: DashboardAppProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <RepositoryContext value={repository ?? getDefaultRepository()}>
        <Toaster>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<TasksPage />} />
              <Route path="projects/:projectId" element={<TasksPage />} />
              <Route
                path="*"
                element={<NotFoundMessage title="Page not found">This page doesn't exist.</NotFoundMessage>}
              />
            </Route>
          </Routes>
        </Toaster>
      </RepositoryContext>
    </QueryClientProvider>
  )
}
