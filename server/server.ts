import { aiSettingsFromEnv } from './ai/createProvider'
import { createApp } from './app'
import { createAuth, sessionUser } from './auth'
import type { Database } from './db/client'
import { trustedOrigins, trustedProxies, type Env } from './env'
import { createMailer, type Mailer } from './mail'

/**
 * Builds the complete server — authentication and API — from the configuration.
 * server/dev.ts runs exactly this, and the tests do too, so what's tested is what runs
 * (including which origins are trusted).
 */
export function buildServer(
  env: Env,
  db: Database,
  { rateLimit = true, mailer = createMailer(env) }: { rateLimit?: boolean; mailer?: Mailer } = {},
) {
  const origins = trustedOrigins(env)
  const auth = createAuth({
    db,
    secret: env.BETTER_AUTH_SECRET,
    appOrigin: env.APP_ORIGIN,
    trustedOrigins: origins,
    secureCookies: env.NODE_ENV === 'production',
    rateLimit,
    mailer,
    clientIpHeader: env.CLIENT_IP_HEADER,
    trustedProxies: trustedProxies(env),
  })
  const app = createApp({
    db,
    resolveUserId: sessionUser(auth),
    trustedOrigins: origins,
    explainBlockedOrigins: env.NODE_ENV !== 'production',
    authHandler: auth.handler,
    ai: aiSettingsFromEnv(env),
  })
  return { app, auth, origins, mailer }
}
