import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { AuthCard } from '../components/auth/AuthCard'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { controlClass } from '../components/ui/styles'
import { AUTH_MESSAGES, resetPasswordFormSchema } from '../data/authClient'
import { useResetPassword } from '../hooks/auth'
import { errorMessage, fieldErrors } from '../lib/format'

/**
 * Where the reset email's link lands (/reset-password?token=…). The server has already
 * checked the token; an invalid or expired one arrives as ?error=INVALID_TOKEN.
 */
export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const navigate = useNavigate()
  const resetPassword = useResetPassword()
  const [values, setValues] = useState({ password: '', confirmPassword: '' })
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)

  const requestNewLink = (
    <Link to="/forgot-password" className="font-semibold text-glow hover:text-glow-strong">
      Request a new link
    </Link>
  )

  if (!token || params.get('error')) {
    return (
      <AuthCard title="This link can’t be used" description="Reset links expire after 15 minutes and work once." footer={requestNewLink}>
        <p role="alert" className="mt-6 text-sm text-danger">
          {AUTH_MESSAGES.invalidResetLink}
        </p>
      </AuthCard>
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    const parsed = resetPasswordFormSchema.safeParse(values)
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error))
      return
    }
    setErrors({})
    try {
      await resetPassword.mutateAsync({ token: token as string, newPassword: parsed.data.password })
      navigate('/login?reset=success', { replace: true })
    } catch (caught) {
      setFormError(errorMessage(caught))
    }
  }

  return (
    <AuthCard
      title="Choose a new password"
      description="You’ll be signed out everywhere, then you can sign in with the new password."
      footer={requestNewLink}
    >
      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        <Field label="New password" hint="At least 8 characters." error={errors.password}>
          {(control) => (
            <input
              {...control}
              type="password"
              autoComplete="new-password"
              value={values.password}
              onChange={(event) => setValues((current) => ({ ...current, password: event.target.value }))}
              className={controlClass}
            />
          )}
        </Field>
        <Field label="Confirm new password" error={errors.confirmPassword}>
          {(control) => (
            <input
              {...control}
              type="password"
              autoComplete="new-password"
              value={values.confirmPassword}
              onChange={(event) => setValues((current) => ({ ...current, confirmPassword: event.target.value }))}
              className={controlClass}
            />
          )}
        </Field>
        {formError && (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={resetPassword.isPending} className="w-full">
          {resetPassword.isPending ? 'Saving…' : 'Change password'}
        </Button>
      </form>
    </AuthCard>
  )
}
