import { describe, expect, it } from 'vitest'
import { loadEnv } from '../env'
import { openDatabase } from './client'
import { assertMigrationAllowed } from './migrationPolicy'
import { assertSchemaUpToDate, pendingMigrations } from './migrations'

describe('migration status (read-only check used by servers)', () => {
  it('reports every migration as pending on an empty database, and none after migrating', async () => {
    const database = await openDatabase({ kind: 'pglite' }) // opening alone never migrates
    try {
      expect(await pendingMigrations(database.db)).toEqual(['0000_init', '0001_auth', '0002_calendar_ai'])
      await expect(assertSchemaUpToDate(database.db)).rejects.toThrow(
        'The database schema is out of date (pending migrations: 0000_init, 0001_auth, 0002_calendar_ai). Run `npm run db:migrate`',
      )

      await database.migrate()
      expect(await pendingMigrations(database.db)).toEqual([])
      await expect(assertSchemaUpToDate(database.db)).resolves.toBeUndefined()
    } finally {
      await database.close()
    }
  })
})

describe('assertMigrationAllowed', () => {
  const base = {
    DATABASE_PROVIDER: 'neon',
    DATABASE_URL: 'postgresql://u:p@ep-x-1.c-1.aws.neon.tech/neondb',
    NEON_BRANCH_ID: 'br-prod-1',
    BETTER_AUTH_SECRET: 'test-secret-that-is-at-least-32-characters-long',
    APP_ORIGIN: 'https://tasks.example.com',
  }

  it('allows development migrations', () => {
    expect(() => assertMigrationAllowed(loadEnv(base), [])).not.toThrow()
  })

  it('refuses production without an explicit confirmation naming the exact branch', () => {
    // Built directly: loadEnv refuses production until a real email provider exists (M11).
    const production = { ...loadEnv(base), NODE_ENV: 'production' as const }
    const expected = 'Refusing to migrate a production database without explicit confirmation'
    expect(() => assertMigrationAllowed(production, [])).toThrow(expected)
    expect(() => assertMigrationAllowed(production, ['--confirm-production=br-other'])).toThrow(expected)
    expect(() => assertMigrationAllowed(production, ['--confirm-production=br-prod-1'])).not.toThrow()
  })
})
