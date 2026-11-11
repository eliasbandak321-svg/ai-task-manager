import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { AuthCard } from '../components/auth/AuthCard'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { controlClass } from '../components/ui/styles'
import { requestPasswordResetInputSchema } from '../data/authClient'
import { useRequestPasswordReset } from '../hooks/auth'
import { errorMessage, fieldErrors } from '../lib/format'

/** Asks for a password-reset link. The answer never reveals whether the email has an account. */
export function ForgotPasswordPage() {
  const requestReset = useRequestPasswordReset()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string>()
  const [formError, setFormError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    const parsed = requestPasswordResetInputSchema.safeParse({ email })
    if (!parsed.success) {
      setError(fieldErrors(parsed.error).email)
      return
    }
    setError(undefined)
    try {
      await requestReset.mutateAsync(parsed.data)
      setSentTo(parsed.data.email)
    } catch (caught) {
      setFormError(errorMessage(caught))
    }
  }

  const backToSignIn = (
    <Link to="/login" className="font-semibold text-glow hover:text-glow-strong">
      Back to sign in
    </Link>
  )

  if (sentTo) {
    return (
      <AuthCard title="Check your email" description="Reset your password from the link we sent." footer={backToSignIn}>
        <div aria-live="polite" className="mt-6 space-y-3 text-sm text-ink-muted">
          <p>
            If an account exists for <strong className="text-ink">{sentTo}</strong>, we’ve sent it a link to choose a new
            password. The link expires in 15 minutes and works once.
          </p>
          {import.meta.env.DEV && (
            <p className="rounded-control border border-line bg-raised p-3 text-ink-subtle">
              Development: emails aren’t sent yet. The link is printed in the terminal running the API.
            </p>
          )}
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Reset your password"
      description="Enter your account’s email and we’ll send you a link to choose a new password."
      footer={backToSignIn}
    >
      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        <Field label="Email" error={error}>
          {(control) => (
            <input
              {...control}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={controlClass}
            />
          )}
        </Field>
        {formError && (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={requestReset.isPending} className="w-full">
          {requestReset.isPending ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
    </AuthCard>
  )
}
