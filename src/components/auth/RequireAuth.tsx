import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useSession } from '../../hooks/auth'
import { errorMessage } from '../../lib/format'
import { loginPathFor } from '../../lib/redirect'
import { ErrorMessage } from '../ui/ErrorMessage'
import { LoadingMessage } from '../ui/LoadingMessage'

/**
 * Shows its children only to a signed-in user; everyone else goes to the login page, which
 * brings them back here afterwards. This is for the experience only: the API checks the
 * session on every request, whatever the browser shows.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const session = useSession()
  const location = useLocation()

  if (session.isPending) {
    return (
      <div className="mx-auto max-w-md p-6 pt-24">
        <LoadingMessage label="Checking your session…" />
      </div>
    )
  }
  if (session.isError) {
    return (
      <div className="mx-auto max-w-md p-6 pt-24">
        <ErrorMessage
          title="We couldn't check your session"
          message={errorMessage(session.error)}
          onRetry={() => void session.refetch()}
        />
      </div>
    )
  }
  if (!session.data) {
    return <Navigate to={loginPathFor(`${location.pathname}${location.search}`)} replace />
  }
  return children
}
