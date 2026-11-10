import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Route, Routes } from 'react-router'
import { AppShell } from '../components/dashboard/AppShell'
import { NotFoundMessage } from '../components/dashboard/NotFoundMessage'
import { Toaster } from '../components/dashboard/Toaster'
import { createMemoryStorage, LocalRepository, type KeyValueStorage } from '../data/localRepository'
import type { TaskRepository } from '../data/repository'
import { RepositoryContext } from '../data/repositoryContext'
import { TasksPage } from './TasksPage'

/*
  The dashboard (/app/*). It's loaded lazily from App.tsx, so visitors of the landing page
  never download it, nor React Query.

  This is the single place that decides which repository the app uses. In M6 the
  LocalRepository below is swapped for the HTTP adapter; nothing else changes.
*/

function browserStorage(): KeyValueStorage {
  try {
    // Accessing localStorage throws when the browser blocks site data.
    return window.localStorage
  } catch {
    return createMemoryStorage()
  }
}

let defaultRepository: TaskRepository | undefined
function getDefaultRepository(): TaskRepository {
  defaultRepository ??= new LocalRepository({
    storage: browserStorage(),
    // A small delay in development keeps loading states honest; the real API will have latency.
    latencyMs: import.meta.env.DEV ? 150 : 0,
  })
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
