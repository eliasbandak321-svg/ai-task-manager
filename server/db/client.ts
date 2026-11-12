import { mkdirSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres'
import { migrate as migrateNodePg } from 'drizzle-orm/node-postgres/migrator'
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite'
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator'
import pg from 'pg'
import { MIGRATIONS_FOLDER } from './migrations'
import * as schema from './schema'

/*
  Two ways to reach PostgreSQL, behind one Database type:

  - PGlite (default for local development and tests): real PostgreSQL compiled to
    WebAssembly, running inside the Node process. No installation, no account. Data is kept
    in a folder (.data/pglite), or in memory for tests.
  - node-postgres (when DATABASE_URL is set): any real PostgreSQL server, such as a local
    install or Neon (production, M11).

  The rest of the server only sees `Database`, so it doesn't know which one it talks to.
*/

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>
/** A transaction handle, as passed to `db.transaction(async (tx) => …)`. */
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]

export interface DatabaseHandle {
  db: Database
  /** Applies pending migrations. Only `npm run db:migrate` and tests call this. */
  migrate: () => Promise<void>
  close: () => Promise<void>
}

export type DatabaseConfig =
  | { kind: 'pglite'; dataDir?: string } // no dataDir: in-memory (tests)
  | {
      kind: 'postgres'
      url: string
      /** When set, refuse to touch any Neon branch but this one (checked before migrating). */
      expectedNeonBranchId?: string
    }

/**
 * Makes sure we're connected to the intended Neon branch, so a wrong connection string
 * (say, production's) fails before any migration or write. Neon reports the branch of the
 * current compute in the `neon.branch_id` setting.
 */
export async function assertNeonBranch(
  query: (sql: string) => Promise<{ rows: { branch: string | null }[] }>,
  expected: string,
): Promise<void> {
  const result = await query("select current_setting('neon.branch_id', true) as branch")
  const actual = result.rows[0]?.branch
  if (actual !== expected) {
    throw new Error(
      `Refusing to use this database: NEON_BRANCH_ID is ${expected}, but the connection points to ${actual ?? 'a database that is not a Neon branch'}.`,
    )
  }
}

export interface OpenOptions {
  /**
   * Apply pending migrations after connecting. Only the explicit migration command
   * (npm run db:migrate) and test databases do this; servers never do (see migrations.ts).
   */
  migrate?: boolean
}

/** Connects (checking the Neon branch first, when configured). */
export async function openDatabase(config: DatabaseConfig, { migrate = false }: OpenOptions = {}): Promise<DatabaseHandle> {
  if (config.kind === 'postgres') {
    const pool = new pg.Pool({ connectionString: config.url })
    // Idle connections can be dropped by the server (Neon suspends idle compute after a few
    // minutes). Without this handler that error would crash the process; the pool simply
    // opens a new connection for the next query.
    pool.on('error', (error) => console.warn('Database connection closed by the server:', error.message))
    try {
      if (config.expectedNeonBranchId) {
        await assertNeonBranch((sql) => pool.query<{ branch: string | null }>(sql), config.expectedNeonBranchId)
      }
      const db = drizzleNodePg(pool, { schema })
      const handle: DatabaseHandle = {
        db,
        migrate: () => migrateNodePg(db, { migrationsFolder: MIGRATIONS_FOLDER }),
        close: () => pool.end(),
      }
      if (migrate) await handle.migrate()
      return handle
    } catch (error) {
      await pool.end()
      throw error
    }
  }

  // PGlite doesn't create missing parent folders, e.g. on the first run after a fresh clone.
  if (config.dataDir) mkdirSync(config.dataDir, { recursive: true })
  const client = new PGlite(config.dataDir)
  const db = drizzlePglite(client, { schema })
  const handle: DatabaseHandle = {
    db,
    migrate: () => migratePglite(db, { migrationsFolder: MIGRATIONS_FOLDER }),
    close: () => client.close(),
  }
  if (migrate) await handle.migrate()
  return handle
}
