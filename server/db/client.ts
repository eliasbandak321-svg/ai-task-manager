import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres'
import { migrate as migrateNodePg } from 'drizzle-orm/node-postgres/migrator'
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite'
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator'
import pg from 'pg'
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

export interface DatabaseHandle {
  db: Database
  close: () => Promise<void>
}

const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../drizzle', import.meta.url))

export type DatabaseConfig =
  | { kind: 'pglite'; dataDir?: string } // no dataDir: in-memory (tests)
  | { kind: 'postgres'; url: string }

/** Connects and applies any pending migrations, so the schema is always up to date. */
export async function openDatabase(config: DatabaseConfig): Promise<DatabaseHandle> {
  if (config.kind === 'postgres') {
    const pool = new pg.Pool({ connectionString: config.url })
    const db = drizzleNodePg(pool, { schema })
    await migrateNodePg(db, { migrationsFolder: MIGRATIONS_FOLDER })
    return { db, close: () => pool.end() }
  }

  // PGlite doesn't create missing parent folders, e.g. on the first run after a fresh clone.
  if (config.dataDir) mkdirSync(config.dataDir, { recursive: true })
  const client = new PGlite(config.dataDir)
  const db = drizzlePglite(client, { schema })
  await migratePglite(db, { migrationsFolder: MIGRATIONS_FOLDER })
  return { db, close: () => client.close() }
}
