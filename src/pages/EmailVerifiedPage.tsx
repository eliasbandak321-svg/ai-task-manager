import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router'
import { AuthCard } from '../components/auth/AuthCard'
import { ButtonLink } from '../components/ButtonLink'
import { sessionQueryKey } from '../hooks/auth'

/**
 * Where the confirmation email's link lands. The server has confirmed the address and set
 * the session cookie (or redirected here with ?error=… for a bad or expired link).
 */
export function EmailVerifiedPage() {
  const [params] = useSearchParams()
  const failed = params.has('error')
  const queryClient = useQueryClient()

  // The session cookie was just set by the server: make the app re-read the session.
  useEffect(() => {
    if (!failed) void queryClient.invalidateQueries({ queryKey: sessionQueryKey })
  }, [failed, queryClient])

  if (failed) {
    return (
      <AuthCard
        title="This link can’t be used"
        description="Confirmation links expire after 24 hours."
        footer={
          <Link to="/login" className="font-semibold text-glow hover:text-glow-strong">
            Go to sign in
          </Link>
        }
      >
        <p role="alert" className="mt-6 text-sm text-danger">
          This confirmation link is invalid or has expired. Sign in to get a new one.
        </p>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Email confirmed" description="Your account is active." footer={null}>
      <output className="mt-6 block text-sm text-ink-muted">Thanks for confirming your email address. You’re signed in.</output>
      <ButtonLink to="/app" className="mt-6 w-full">
        Go to your tasks
      </ButtonLink>
    </AuthCard>
  )
}
