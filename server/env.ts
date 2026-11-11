import { z } from 'zod'
import type { DatabaseConfig } from './db/client'

/*
  Server configuration from environment variables, validated at startup: a missing or wrong
  value stops the server immediately with a clear message, instead of failing later
  (docs/architecture.md §9). Secrets never use the VITE_ prefix, which would bundle them
  into the browser code. Error messages never include DATABASE_URL (it holds the password).

  The database is always chosen explicitly with DATABASE_PROVIDER — there is no default and
  no fallback, so a missing or broken Neon configuration is an error, never a silent switch
  to a different (empty) database:
  - neon      the project's database (Neon PostgreSQL); needs DATABASE_URL and NEON_BRANCH_ID
  - postgres  any other PostgreSQL server; needs DATABASE_URL
  - pglite    the embedded offline database in PGLITE_DIR (`npm run dev:offline`)
*/

export const DATABASE_PROVIDERS = ['neon', 'postgres', 'pglite'] as const

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /** Port of the local API; the Vite dev server proxies /api to it. */
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(8787),
  DATABASE_PROVIDER: z.enum(DATABASE_PROVIDERS, {
    error: (issue) =>
      issue.input === undefined
        ? 'DATABASE_PROVIDER is not set. Copy .env.example to .env and set DATABASE_PROVIDER=neon (or run `npm run dev:offline` to use the embedded PGlite database).'
        : `DATABASE_PROVIDER must be one of: ${DATABASE_PROVIDERS.join(', ')}`,
  }),
  /** A PostgreSQL connection string (Neon or another server). Secret. */
  DATABASE_URL: z
    .string()
    .regex(/^postgres(ql)?:\/\//, 'DATABASE_URL must start with postgres:// or postgresql://')
    .optional(),
  /**
   * The Neon branch DATABASE_URL must point to (e.g. br-…). Not a secret. The API and the
   * migration command refuse to run against any other branch, such as production by mistake.
   */
  NEON_BRANCH_ID: z
    .string()
    .regex(/^br-[a-z0-9-]+$/, 'NEON_BRANCH_ID must look like br-…')
    .optional(),
  /** Where PGlite keeps its data when DATABASE_PROVIDER=pglite. */
  PGLITE_DIR: z.string().min(1).default('.data/pglite'),
  /**
   * Signs and encrypts session cookies. Secret: a long random value (`openssl rand -base64 32`),
   * different for every environment. Changing it signs everyone out.
   */
  BETTER_AUTH_SECRET: z
    .string({ error: 'BETTER_AUTH_SECRET is not set. Generate one with `openssl rand -base64 32` (see .env.example).' })
    .min(32, 'BETTER_AUTH_SECRET must be at least 32 characters long.'),
  /**
   * The address people open the app at (scheme, host and port). Auth cookies, redirects and
   * the CSRF origin check are based on it. In development the Vite server proxies /api.
   */
  APP_ORIGIN: z
    .url({ protocol: /^https?$/, error: 'APP_ORIGIN must be a URL like http://localhost:5173' })
    .transform((url) => new URL(url).origin)
    .default('http://localhost:5173'),
  /**
   * How emails (verification, password reset) are delivered. Development only for now:
   *   console  printed in the API terminal (default)
   *   file     saved as JSON files in MAIL_DIR (used by the end-to-end tests)
   * A real provider is added in M11; production refuses to start until then.
   */
  MAIL_TRANSPORT: z.enum(['console', 'file']).default('console'),
  MAIL_DIR: z.string().min(1).default('.data/mail'),
  MAIL_FROM: z.string().min(3).default('AI Task Manager <no-reply@localhost>'),
  /**
   * Where the client's IP address comes from (rate limiting, session records). Proxies append
   * to X-Forwarded-For and its leftmost entries are set by the client, so only addresses
   * added by proxies we trust count:
   *   CLIENT_IP_HEADER  the header to read (default x-forwarded-for; on hosts that set a
   *                     single-value header, such as x-real-ip, use that)
   *   TRUSTED_PROXIES   comma-separated IPs or CIDR ranges of our own proxies, stripped from
   *                     the right of the chain (development default: this computer)
   */
  CLIENT_IP_HEADER: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'CLIENT_IP_HEADER must be a lowercase header name')
    .default('x-forwarded-for'),
  TRUSTED_PROXIES: z
    .string()
    .optional()
    .transform((value) => (value ?? '').split(',').map((entry) => entry.trim()).filter(Boolean))
    .pipe(z.array(z.string().regex(/^[0-9a-f:.]+(\/\d{1,3})?$/i, 'TRUSTED_PROXIES must list IP addresses or CIDR ranges'))),
})

export type Env = z.infer<typeof envSchema>

function isNeonHost(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith('.neon.tech')
  } catch {
    return false
  }
}

/** Checks that the settings agree with the chosen provider. Returns a message, or null if fine. */
function providerProblem(env: Env): string | null {
  switch (env.DATABASE_PROVIDER) {
    case 'neon':
      if (!env.DATABASE_URL) return 'DATABASE_PROVIDER=neon needs DATABASE_URL (the Neon branch connection string).'
      if (!isNeonHost(env.DATABASE_URL)) return 'DATABASE_PROVIDER=neon, but DATABASE_URL does not point to a Neon host.'
      if (!env.NEON_BRANCH_ID) return 'DATABASE_PROVIDER=neon needs NEON_BRANCH_ID (see .env.example).'
      return null
    case 'postgres':
      if (!env.DATABASE_URL) return 'DATABASE_PROVIDER=postgres needs DATABASE_URL.'
      if (isNeonHost(env.DATABASE_URL)) return 'DATABASE_URL points to Neon: use DATABASE_PROVIDER=neon, which checks the branch.'
      return null
    case 'pglite':
      if (env.NODE_ENV === 'production') return 'The embedded PGlite database cannot be used in production.'
      return null
  }
}

function securityProblem(env: Env): string | null {
  if (env.NODE_ENV !== 'production') return null
  if (!env.APP_ORIGIN.startsWith('https://')) {
    return 'APP_ORIGIN must use https in production (session cookies are only sent over HTTPS).'
  }
  if (env.TRUSTED_PROXIES.length === 0 && env.CLIENT_IP_HEADER === 'x-forwarded-for') {
    // Without this, a multi-hop X-Forwarded-For can't be trusted and Better Auth puts every
    // client in one shared rate-limit bucket: a few failed sign-ins would lock everyone out.
    return 'Configure the client IP in production: set TRUSTED_PROXIES, or CLIENT_IP_HEADER to a header your host sets itself (see docs/architecture.md, M11 checklist).'
  }
  // Development transports would print reset links to logs or disk.
  return 'No email provider is configured for production yet (M11). MAIL_TRANSPORT=console/file is development only.'
}

/** Trusted proxies for client-IP resolution: in development, this computer (the Vite proxy). */
export function trustedProxies(env: Pick<Env, 'TRUSTED_PROXIES' | 'NODE_ENV'>): string[] {
  if (env.TRUSTED_PROXIES.length > 0 || env.NODE_ENV === 'production') return env.TRUSTED_PROXIES
  return ['127.0.0.1', '::1']
}

export function loadEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source)
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`)
  }
  const problem = providerProblem(result.data) ?? securityProblem(result.data)
  if (problem) throw new Error(`Invalid environment configuration: ${problem}`)
  return result.data
}

export function databaseConfig(env: Env): DatabaseConfig {
  switch (env.DATABASE_PROVIDER) {
    case 'neon':
      return { kind: 'postgres', url: env.DATABASE_URL as string, expectedNeonBranchId: env.NEON_BRANCH_ID }
    case 'postgres':
      return { kind: 'postgres', url: env.DATABASE_URL as string }
    case 'pglite':
      return { kind: 'pglite', dataDir: env.PGLITE_DIR }
  }
}

const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]']

/**
 * The origins allowed to send requests that change data (CSRF check), for both the API and
 * Better Auth.
 *
 * - Production: exactly APP_ORIGIN.
 * - Development with a local APP_ORIGIN: also the other loopback names for the *same* scheme
 *   and port. `localhost`, `127.0.0.1` and `[::1]` all mean this computer, but browsers treat
 *   them as different origins, and tools open the dev server under either name (Vite prints
 *   localhost; VS Code's port forwarding often opens 127.0.0.1). Only this machine can use
 *   these addresses, so trusting them doesn't let any other website through.
 */
export function trustedOrigins(env: Pick<Env, 'APP_ORIGIN' | 'NODE_ENV'>): string[] {
  const app = new URL(env.APP_ORIGIN)
  if (env.NODE_ENV === 'production' || !LOOPBACK_HOSTS.includes(app.hostname)) return [app.origin]
  const port = app.port ? `:${app.port}` : ''
  return [app.origin, ...LOOPBACK_HOSTS.map((host) => `${app.protocol}//${host}${port}`).filter((origin) => origin !== app.origin)]
}

/** A short description of the database for logs. Never includes the connection string. */
export function describeDatabase(env: Env): string {
  switch (env.DATABASE_PROVIDER) {
    case 'neon':
      return `Neon branch ${env.NEON_BRANCH_ID} (verified)`
    case 'postgres':
      return 'PostgreSQL (DATABASE_URL)'
    case 'pglite':
      return `PGlite, offline (${env.PGLITE_DIR})`
  }
}
