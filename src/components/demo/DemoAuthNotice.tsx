import { site } from '../../config/site'
import { ButtonLink } from '../ButtonLink'
import { AuthCard } from '../auth/AuthCard'

/**
 * What the sign-in, sign-up and password pages show in the portfolio demo (M11): the demo has no
 * accounts. The real pages, and real authentication, are in the normal build.
 */
export function DemoAuthNotice() {
  return (
    <AuthCard
      title="No account needed"
      description="This is the portfolio demo: it opens straight into the app with fictional sample data."
      footer={
        <a href={site.repoUrl} className="font-semibold text-glow hover:text-glow-strong">
          See the source on GitHub
        </a>
      }
    >
      <div className="mt-6 space-y-4 text-sm text-ink-muted">
        <p>
          Sign-up, email confirmation and password reset are part of the full version (React, Hono, PostgreSQL and Better Auth), which you
          can run locally from the source code. The demo doesn’t create accounts or send email.
        </p>
        <ButtonLink to="/app" className="w-full">
          Open the demo
        </ButtonLink>
      </div>
    </AuthCard>
  )
}
