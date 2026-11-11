import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { sql } from 'drizzle-orm'
import { readMigrationFiles } from 'drizzle-orm/migrator'
import type { Database } from './client'

/*
  Migration safety (docs/architecture.md §9, "Migrations"):
  - Servers never apply migrations. On startup they only *check* that the schema is current
    (assertSchemaUpToDate) and refuse to start otherwise, so restarting a server can never
    change a database schema — development or production.
  - Migrations are applied only by the explicit `npm run db:migrate` command
    (server/db/migrate.ts), which refuses a production database without confirmation.
*/

export const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../drizzle', import.meta.url))

interface JournalEntry {
  tag: string
}

/** The committed migrations, in order, with Drizzle's content hash for each. */
function committedMigrations(): { tag: string; hash: string }[] {
  const journal = JSON.parse(readFileSync(`${MIGRATIONS_FOLDER}/meta/_journal.json`, 'utf8')) as {
    entries: JournalEntry[]
  }
  const files = readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER })
  return files.map((file, index) => ({ tag: journal.entries[index]?.tag ?? `#${index}`, hash: file.hash }))
}

/** Rows of a raw query; both drivers (PGlite and node-postgres) return `{ rows }`. */
async function rows<T>(db: Database, query: ReturnType<typeof sql>): Promise<T[]> {
  return ((await db.execute(query)) as unknown as { rows: T[] }).rows
}

/** Names of committed migrations that the database hasn't applied yet. Read-only. */
export async function pendingMigrations(db: Database): Promise<string[]> {
  const [{ present }] = await rows<{ present: boolean }>(
    db,
    sql`select to_regclass('drizzle.__drizzle_migrations') is not null as present`,
  )
  const applied = present
    ? new Set((await rows<{ hash: string }>(db, sql`select hash from drizzle.__drizzle_migrations`)).map((row) => row.hash))
    : new Set<string>()
  return committedMigrations()
    .filter((migration) => !applied.has(migration.hash))
    .map((migration) => migration.tag)
}

/** Refuses to continue when the schema is behind the code. */
export async function assertSchemaUpToDate(db: Database): Promise<void> {
  const pending = await pendingMigrations(db)
  if (pending.length > 0) {
    throw new Error(
      `The database schema is out of date (pending migrations: ${pending.join(', ')}). ` +
        'Run `npm run db:migrate` to apply them. Servers never migrate automatically.',
    )
  }
}
