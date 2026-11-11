import type { QueryClient } from '@tanstack/react-query'
import { QueryClientProvider } from '@tanstack/react-query'
import { Route, Routes } from 'react-router'
import { RequireAuth } from '../components/auth/RequireAuth'
import { AppShell } from '../components/dashboard/AppShell'
import { NotFoundMessage } from '../components/dashboard/NotFoundMessage'
import { Toaster } from '../components/dashboard/Toaster'
import { HttpAuthClient, type AuthClient } from '../data/authClient'
import { AuthClientContext } from '../data/authClientContext'
import { HttpRepository } from '../data/httpRepository'
import { createQueryClient } from '../data/queryClient'
import type { TaskRepository } from '../data/repository'
import { RepositoryContext } from '../data/repositoryContext'
import { LoginPage } from './LoginPage'
import { NotFoundPage } from './NotFoundPage'
import { SignupPage } from './SignupPage'
import { TasksPage } from './TasksPage'

/*
  Everything except the landing page: sign-in, sign-up and the dashboard. It's loaded lazily
  from App.tsx, so visitors of the landing page never download it, nor React Query.

  This is the single place that decides how the app reaches the server: the HTTP adapters on
  the same origin (/api and /api/auth), where the session cookie is sent automatically.
  Tests pass in-memory versions instead.

  Routes:
    /login, /signup                    public (signed-in users are sent on to the app)
    /app, /app/projects/:projectId     only for signed-in users (RequireAuth)
*/

let defaults: { repository: TaskRepository; authClient: AuthClient; queryClient: QueryClient } | undefined
function getDefaults() {
  defaults ??= { repository: new HttpRepository(), authClient: new HttpAuthClient(), queryClient: createQueryClient() }
  return defaults
}

interface DashboardAppProps {
  /** Tests pass their own repository, auth client and query client. */
  repository?: TaskRepository
  authClient?: AuthClient
  queryClient?: QueryClient
}

export default function DashboardApp({ repository, authClient, queryClient }: DashboardAppProps) {
  return (
    <QueryClientProvider client={queryClient ?? getDefaults().queryClient}>
      <AuthClientContext value={authClient ?? getDefaults().authClient}>
        <RepositoryContext value={repository ?? getDefaults().repository}>
          <Toaster>
            <Routes>
              <Route path="login" element={<LoginPage />} />
              <Route path="signup" element={<SignupPage />} />
              <Route
                path="app"
                element={
                  <RequireAuth>
                    <AppShell />
                  </RequireAuth>
                }
              >
                <Route index element={<TasksPage />} />
                <Route path="projects/:projectId" element={<TasksPage />} />
                <Route
                  path="*"
                  element={<NotFoundMessage title="Page not found">This page doesn't exist.</NotFoundMessage>}
                />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Toaster>
        </RepositoryContext>
      </AuthClientContext>
    </QueryClientProvider>
  )
}
