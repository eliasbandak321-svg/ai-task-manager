import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import type { Context } from 'hono'
import type { Database } from './db/client'
import { accounts, rateLimits, sessions, users, verifications } from './db/schema'
import { createInboxFor } from './db/users'
import { emails, type Email, type Mailer } from './mail'

/*
  Authentication with Better Auth (open source, runs inside our API, data in our database).

  Who is making a request? The API only ever asks a `ResolveUserId` function. In the app that
  is `sessionUser`, which reads the session cookie; the user id never comes from the request
  body or the URL (docs/architecture.md §6). Tests can pass their own resolver.
*/

export type ResolveUserId = (c: Context) => Promise<string | null>

export interface AuthConfig {
  db: Database
  /** Signs session cookies (BETTER_AUTH_SECRET). */
  secret: string
  /** The app's own origin, e.g. http://localhost:5173. Auth lives under <origin>/api/auth. */
  appOrigin: string
  /** Origins allowed to call the auth endpoints (see trustedOrigins in env.ts). Defaults to appOrigin. */
  trustedOrigins?: string[]
  /** Mark cookies `Secure` (HTTPS only). On in production. */
  secureCookies: boolean
  /** Brute-force protection on the auth endpoints. On by default; tests may turn it off. */
  rateLimit?: boolean
  /** Delivers verification and password-reset emails. */
  mailer: Mailer
  /** Header with the client IP, and our own proxies to strip from it (see env.ts). */
  clientIpHeader?: string
  trustedProxies?: string[]
}

/**
 * Sends an email without making the request wait for it. Equal response times matter: if
 * "send a reset email" only happened for existing accounts and the response waited for it,
 * the delay would reveal which emails have an account. Failures are logged, never shown.
 */
function sendInBackground(mailer: Mailer, email: Email): void {
  void mailer.send(email).catch((error: unknown) => {
    console.error(`Email delivery failed (${email.subject}):`, error instanceof Error ? error.message : error)
  })
}

const DAY_IN_SECONDS = 60 * 60 * 24

export function createAuth({
  db,
  secret,
  appOrigin,
  trustedOrigins = [appOrigin],
  secureCookies,
  rateLimit = true,
  mailer,
  clientIpHeader = 'x-forwarded-for',
  trustedProxies = [],
}: AuthConfig) {
  return betterAuth({
    appName: 'AI Task Manager',
    baseURL: appOrigin,
    basePath: '/api/auth',
    secret,
    // Requests that change state must come from these origins (Better Auth's CSRF check).
    trustedOrigins,
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: { user: users, session: sessions, account: accounts, verification: verifications, rateLimit: rateLimits },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      // Accounts must confirm their email before they can sign in (M8). Besides proving the
      // address, this protects against account enumeration: sign-up answers the same way
      // whether or not the email is registered, and the real owner gets a notice instead.
      requireEmailVerification: true,
      autoSignIn: false,
      onExistingUserSignUp: async ({ user }) => {
        sendInBackground(mailer, emails.existingAccountSignUp(user.email, `${appOrigin}/forgot-password`))
      },
      // Password reset: a random single-use token, valid for 15 minutes; using it signs the
      // account out everywhere (all sessions are revoked).
      resetPasswordTokenExpiresIn: 15 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        sendInBackground(mailer, emails.resetPassword(user.email, url))
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      // Signing in to an unconfirmed account sends a fresh link (and fails until confirmed).
      sendOnSignIn: true,
      // Clicking the link confirms the address and signs the user in.
      autoSignInAfterVerification: true,
      expiresIn: DAY_IN_SECONDS,
      sendVerificationEmail: async ({ user, url }) => {
        sendInBackground(mailer, emails.verifyEmail(user.email, url))
      },
    },
    session: {
      // A session lasts 7 days and is extended (at most once a day) while it's being used,
      // so an active user stays signed in; signing out deletes it immediately.
      expiresIn: 7 * DAY_IN_SECONDS,
      updateAge: DAY_IN_SECONDS,
    },
    rateLimit: {
      enabled: rateLimit,
      // In the database, not in memory: limits survive restarts and serverless instances.
      storage: 'database',
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 60, max: 5 },
        // Each of these sends an email: keep them rare per address.
        '/request-password-reset': { window: 60, max: 3 },
        '/send-verification-email': { window: 60, max: 3 },
        '/reset-password': { window: 60, max: 5 },
      },
    },
    advanced: {
      // Explicitly on. Better Auth turns its origin, redirect and CSRF checks OFF by itself
      // when it detects a test environment, so tests would quietly check weaker behaviour
      // than production (this hid a password-reset redirect flaw until M8).
      disableOriginCheck: false,
      disableCSRFCheck: false,
      database: { generateId: 'uuid' },
      useSecureCookies: secureCookies,
      // HttpOnly: JavaScript (and so XSS) can't read the cookie. SameSite=Lax: browsers don't
      // send it with cross-site POST, PATCH or DELETE requests (a CSRF defence).
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', path: '/' },
      // The client IP (rate limiting, session records) comes from the proxy in front of the
      // API: Vite in development, the host in production. Entries added by our own proxies are
      // stripped from the right; the client can't fake the first untrusted hop. Without
      // trusted proxies, only a single-value header is believed (Better Auth's rule).
      ipAddress: { ipAddressHeaders: [clientIpHeader], trustedProxies },
    },
    // Every new user gets their Inbox (docs/architecture.md §4).
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await createInboxFor(db, user.id)
          },
        },
      },
    },
    telemetry: { enabled: false },
  })
}

export type Auth = ReturnType<typeof createAuth>

/** Resolves the user from the session cookie; null when signed out or the session expired. */
export function sessionUser(auth: Auth): ResolveUserId {
  return async (c) => {
    const session = await auth.api.getSession({ headers: c.req.raw.headers })
    return session?.user.id ?? null
  }
}
