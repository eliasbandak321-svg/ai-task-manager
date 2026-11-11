import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import type { Context } from 'hono'
import type { Database } from './db/client'
import { accounts, rateLimits, sessions, users, verifications } from './db/schema'
import { createInboxFor } from './db/users'

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
  /** Brute-force protection on sign-in and sign-up. On by default; tests may turn it off. */
  rateLimit?: boolean
}

const DAY_IN_SECONDS = 60 * 60 * 24

export function createAuth({ db, secret, appOrigin, trustedOrigins = [appOrigin], secureCookies, rateLimit = true }: AuthConfig) {
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
      // Signed in straight after sign-up. Email verification comes with an email provider (M11).
      autoSignIn: true,
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
      },
    },
    advanced: {
      database: { generateId: 'uuid' },
      useSecureCookies: secureCookies,
      // HttpOnly: JavaScript (and so XSS) can't read the cookie. SameSite=Lax: browsers don't
      // send it with cross-site POST, PATCH or DELETE requests (a CSRF defence).
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', path: '/' },
      // The client IP for rate limiting comes from the proxy in front of the API (Vite in
      // development, the hosting platform in production). The API only listens on 127.0.0.1.
      ipAddress: { ipAddressHeaders: ['x-forwarded-for'] },
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
