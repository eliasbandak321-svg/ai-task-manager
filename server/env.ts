import { z } from 'zod'
import type { DatabaseConfig } from './db/client'

/*
  Server configuration from environment variables, validated at startup: a missing or wrong
  value stops the server immediately with a clear message, instead of failing later
  (docs/architecture.md §9). Secrets never use the VITE_ prefix, which would bundle them
  into the browser code.
*/

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /** Port of the local API; the Vite dev server proxies /api to it. */
  API_PORT: z.coerce.number().int().min(1).max(65_535).default(8787),
  /** A PostgreSQL connection string. When unset, the API uses the embedded PGlite database. */
  DATABASE_URL: z
    .string()
    .regex(/^postgres(ql)?:\/\//, 'DATABASE_URL must start with postgres:// or postgresql://')
    .optional(),
  /**
   * The Neon branch DATABASE_URL must point to (e.g. br-…). Not a secret. When set, the API and
   * migrations refuse to run against any other branch, such as production by mistake.
   */
  NEON_BRANCH_ID: z
    .string()
    .regex(/^br-[a-z0-9-]+$/, 'NEON_BRANCH_ID must look like br-…')
    .optional(),
  /** Where PGlite keeps its data when DATABASE_URL is unset. */
  PGLITE_DIR: z.string().min(1).default('.data/pglite'),
  /** The single local user until accounts exist (M7). */
  DEV_USER_ID: z.uuid().default('00000000-0000-4000-8000-000000000001'),
})

export type Env = z.infer<typeof envSchema>

export function loadEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source)
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`)
  }
  if (result.data.NODE_ENV === 'production' && !result.data.DATABASE_URL) {
    throw new Error('DATABASE_URL is required in production.')
  }
  // A Neon database is only used with the branch check, so a pasted connection string can't
  // silently point the app at the wrong branch (such as production).
  if (result.data.DATABASE_URL && isNeonHost(result.data.DATABASE_URL) && !result.data.NEON_BRANCH_ID) {
    throw new Error('NEON_BRANCH_ID is required when DATABASE_URL points to Neon (see .env.example).')
  }
  return result.data
}

function isNeonHost(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith('.neon.tech')
  } catch {
    return false
  }
}

export function databaseConfig(env: Env): DatabaseConfig {
  return env.DATABASE_URL
    ? { kind: 'postgres', url: env.DATABASE_URL, expectedNeonBranchId: env.NEON_BRANCH_ID }
    : { kind: 'pglite', dataDir: env.PGLITE_DIR }
}
