import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { AuthCard } from '../components/auth/AuthCard'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { controlClass } from '../components/ui/styles'
import { signInInputSchema } from '../data/authClient'
import { useSession, useSignIn } from '../hooks/auth'
import { errorMessage, fieldErrors } from '../lib/format'
import { safeNextPath } from '../lib/redirect'

export function LoginPage() {
  const [params] = useSearchParams()
  const next = safeNextPath(params.get('next'))
  const navigate = useNavigate()
  const session = useSession()
  const signIn = useSignIn()
  const [values, setValues] = useState({ email: '', password: '' })
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)

  if (session.data) return <Navigate to={next} replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    const parsed = signInInputSchema.safeParse(values)
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error))
      return
    }
    setErrors({})
    try {
      await signIn.mutateAsync(parsed.data)
      navigate(next, { replace: true })
    } catch (error) {
      setFormError(errorMessage(error))
    }
  }

  const signupLink = next === '/app' ? '/signup' : `/signup?next=${encodeURIComponent(next)}`

  return (
    <AuthCard
      title="Sign in"
      description="Welcome back. Sign in to see your projects and tasks."
      footer={
        <>
          New here?{' '}
          <Link to={signupLink} className="font-semibold text-glow hover:text-glow-strong">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        <Field label="Email" error={errors.email}>
          {(control) => (
            <input
              {...control}
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))}
              className={controlClass}
            />
          )}
        </Field>
        <Field label="Password" error={errors.password}>
          {(control) => (
            <input
              {...control}
              type="password"
              autoComplete="current-password"
              value={values.password}
              onChange={(event) => setValues((current) => ({ ...current, password: event.target.value }))}
              className={controlClass}
            />
          )}
        </Field>
        {formError && (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={signIn.isPending} className="w-full">
          {signIn.isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthCard>
  )
}
