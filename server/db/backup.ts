import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { sql } from 'drizzle-orm'
import { databaseConfig, describeDatabase, loadEnv } from '../env'
import { openDatabase } from './client'

/*
  `npm run db:backup`: a read-only JSON snapshot of every table of the configured database
  into .backups/ (git-ignored, readable only by you), for the Data Safety Rule: take one before
  every migration or anything that could touch data. Prints table names and row counts only,
  never contents or the connection string. Exits non-zero if the backup can't be read back.
*/

const envFile = process.env.ENV_FILE ?? '.env'
if (existsSync(envFile)) process.loadEnvFile(envFile)
// A backup never needs the AI provider; don't let AI settings stop it.
const env = loadEnv({ ...process.env, AI_PROVIDER: 'mock' })
const { db, close } = await openDatabase(databaseConfig(env)) // verifies the Neon branch; never migrates
try {
  const rowsOf = async <T>(query: Parameters<typeof db.execute>[0]) => ((await db.execute(query)) as unknown as { rows: T[] }).rows
  const tables = await rowsOf<{ table_schema: string; table_name: string }>(
    sql`select table_schema, table_name from information_schema.tables where table_schema in ('public', 'drizzle') and table_type = 'BASE TABLE' order by 1, 2`,
  )
  const snapshot: Record<string, unknown[]> = {}
  for (const { table_schema, table_name } of tables) {
    snapshot[`${table_schema}.${table_name}`] = await rowsOf<unknown>(sql.raw(`select * from "${table_schema}"."${table_name}"`))
  }
  mkdirSync('.backups', { recursive: true, mode: 0o700 })
  const label = env.DATABASE_PROVIDER === 'neon' ? 'neon-dev' : env.DATABASE_PROVIDER
  const file = `.backups/${label}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  writeFileSync(file, JSON.stringify({ branch: env.NEON_BRANCH_ID ?? null, takenAt: new Date().toISOString(), tables: snapshot }), { mode: 0o600 })

  // Read it back: a backup only counts if it can be restored from.
  const check = JSON.parse(readFileSync(file, 'utf8')) as { tables: Record<string, unknown[]> }
  console.log(`Backup of ${describeDatabase(env)} → ${file}`)
  for (const [name, rows] of Object.entries(check.tables)) console.log(`${name.padEnd(36)} ${rows.length}`)
  if (Object.keys(check.tables).length !== tables.length) throw new Error('Backup verification failed')
} finally {
  await close()
}
