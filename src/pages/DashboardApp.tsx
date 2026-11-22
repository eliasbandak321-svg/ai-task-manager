import type { ReactElement } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import { QueryClientProvider } from '@tanstack/react-query'
import { Route, Routes } from 'react-router'
import { RequireAuth } from '../components/auth/RequireAuth'
import { AppShell } from '../components/dashboard/AppShell'
import { DemoAuthNotice } from '../components/demo/DemoAuthNotice'
import { createDemoClients } from '../demo/demoClients'
import { DemoContext } from '../demo/demoContext'
import { IS_DEMO } from '../demo/demoMode'
import { NotFoundMessage } from '../components/dashboard/NotFoundMessage'
import { Toaster } from '../components/dashboard/Toaster'
import { HttpAuthClient, type AuthClient } from '../data/authClient'
import { AuthClientContext } from '../data/authClientContext'
import { HttpRepository } from '../data/httpRepository'
import { createQueryClient } from '../data/queryClient'
import type { TaskRepository } from '../data/repository'
import { RepositoryContext } from '../data/repositoryContext'
import { HttpWorkspaceClient, type WorkspaceClient } from '../data/workspaceClient'
import { WorkspaceContext } from '../data/workspaceContext'
import { AssistantPage } from './AssistantPage'
import { CalendarPage } from './CalendarPage'
import { InsightsPage } from './InsightsPage'
import { OverviewPage } from './OverviewPage'
import { PlanBuilderPage } from './PlanBuilderPage'
import { ProjectsLayout } from './ProjectsLayout'
import { SettingsPage } from './SettingsPage'
import { EmailVerifiedPage } from './EmailVerifiedPage'
import { ForgotPasswordPage } from './ForgotPasswordPage'
import { LoginPage } from './LoginPage'
import { ResetPasswordPage } from './ResetPasswordPage'
import { NotFoundPage } from './NotFoundPage'
import { PrivacyPage } from './PrivacyPage'
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
    /forgot-password, /reset-password  password reset (M8)
    /email-verified                    where the confirmation email's link lands (M8)
    /app                               dashboard overview (M9)   ┐
    /app/projects[/:projectId]         tasks by project          │
    /app/calendar                      calendar and scheduling   │ only for signed-in
    /app/assistant[/plan]              AI assistant, plan builder│ users (RequireAuth)
    /app/insights, /app/settings                                 ┘
    /privacy                           privacy notice (M11)

  Portfolio demo (M11, `VITE_DEMO=1`): the same routes and screens, on browser-only clients
  (src/demo/) with fictional sample data. No API is called. The account pages explain that
  the demo has no accounts, and /app needs no sign-in (the visitor is the demo user).
*/

let defaults: { repository: TaskRepository; authClient: AuthClient; queryClient: QueryClient; workspace: WorkspaceClient } | undefined
function getDefaults() {
  // Written out (not IS_DEMO) so Vite folds it at build time and the normal build drops the demo data.
  if (import.meta.env.VITE_DEMO === '1') {
    defaults ??= { ...createDemoClients(), queryClient: createQueryClient() }
  } else {
    defaults ??= { repository: new HttpRepository(), authClient: new HttpAuthClient(), queryClient: createQueryClient(), workspace: new HttpWorkspaceClient() }
  }
  return defaults
}

interface DashboardAppProps {
  /** Tests pass their own repository, auth client and query client. */
  repository?: TaskRepository
  authClient?: AuthClient
  queryClient?: QueryClient
  workspace?: WorkspaceClient
  /** Run as the portfolio demo (default: the VITE_DEMO build flag). Tests set it. */
  demo?: boolean
}

export default function DashboardApp({ repository, authClient, queryClient, workspace, demo = IS_DEMO }: DashboardAppProps) {
  // In the demo the account pages have nothing to do: there are no accounts.
  const accountPage = (page: ReactElement) => (demo ? <DemoAuthNotice /> : page)
  return (
    <DemoContext value={demo}>
      <QueryClientProvider client={queryClient ?? getDefaults().queryClient}>
        <AuthClientContext value={authClient ?? getDefaults().authClient}>
          <RepositoryContext value={repository ?? getDefaults().repository}>
            <WorkspaceContext value={workspace ?? getDefaults().workspace}>
              <Toaster>
                <Routes>
                  <Route path="login" element={accountPage(<LoginPage />)} />
                  <Route path="signup" element={accountPage(<SignupPage />)} />
                  <Route path="forgot-password" element={accountPage(<ForgotPasswordPage />)} />
                  <Route path="reset-password" element={accountPage(<ResetPasswordPage />)} />
                  <Route path="email-verified" element={accountPage(<EmailVerifiedPage />)} />
                  <Route path="privacy" element={<PrivacyPage />} />
                  <Route
                    path="app"
                    element={
                      <RequireAuth>
                        <AppShell />
                      </RequireAuth>
                    }
                  >
                    <Route index element={<OverviewPage />} />
                    <Route path="projects" element={<ProjectsLayout />}>
                      <Route index element={<TasksPage />} />
                      <Route path=":projectId" element={<TasksPage />} />
                    </Route>
                    <Route path="calendar" element={<CalendarPage />} />
                    <Route path="assistant" element={<AssistantPage />} />
                    <Route path="assistant/plan" element={<PlanBuilderPage />} />
                    <Route path="insights" element={<InsightsPage />} />
                    <Route path="settings" element={<SettingsPage />} />
                    <Route
                      path="*"
                      element={<NotFoundMessage title="Page not found">This page doesn't exist.</NotFoundMessage>}
                    />
                  </Route>
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Toaster>
            </WorkspaceContext>
          </RepositoryContext>
        </AuthClientContext>
      </QueryClientProvider>
    </DemoContext>
  )
}
