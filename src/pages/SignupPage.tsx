import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { AuthCard } from '../components/auth/AuthCard'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { controlClass } from '../components/ui/styles'
import { signUpInputSchema } from '../data/authClient'
import { useSession, useSignUp } from '../hooks/auth'
import { errorMessage, fieldErrors } from '../lib/format'
import { safeNextPath } from '../lib/redirect'

export function SignupPage() {
  const [params] = useSearchParams()
  const next = safeNextPath(params.get('next'))
  const navigate = useNavigate()
  const session = useSession()
  const signUp = useSignUp()
  const [values, setValues] = useState({ name: '', email: '', password: '' })
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)

  if (session.data) return <Navigate to={next} replace />

  const set = (field: keyof typeof values) => (value: string) => setValues((current) => ({ ...current, [field]: value }))

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    const parsed = signUpInputSchema.safeParse(values)
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error))
      return
    }
    setErrors({})
    try {
      await signUp.mutateAsync(parsed.data)
      navigate(next, { replace: true })
    } catch (error) {
      setFormError(errorMessage(error))
    }
  }

  const loginLink = next === '/app' ? '/login' : `/login?next=${encodeURIComponent(next)}`

  return (
    <AuthCard
      title="Create your account"
      description="Your projects and tasks are private to your account."
      footer={
        <>
          Already have an account?{' '}
          <Link to={loginLink} className="font-semibold text-glow hover:text-glow-strong">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
        <Field label="Name" error={errors.name}>
          {(control) => (
            <input
              {...control}
              autoComplete="name"
              value={values.name}
              onChange={(event) => set('name')(event.target.value)}
              className={controlClass}
            />
          )}
        </Field>
        <Field label="Email" error={errors.email}>
          {(control) => (
            <input
              {...control}
              type="email"
              autoComplete="email"
              value={values.email}
              onChange={(event) => set('email')(event.target.value)}
              className={controlClass}
            />
          )}
        </Field>
        <Field label="Password" hint="At least 8 characters." error={errors.password}>
          {(control) => (
            <input
              {...control}
              type="password"
              autoComplete="new-password"
              value={values.password}
              onChange={(event) => set('password')(event.target.value)}
              className={controlClass}
            />
          )}
        </Field>
        {formError && (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={signUp.isPending} className="w-full">
          {signUp.isPending ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthCard>
  )
}
