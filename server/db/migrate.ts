import { existsSync } from 'node:fs'
import { databaseConfig, describeDatabase, loadEnv } from '../env'
import { openDatabase } from './client'
import { assertMigrationAllowed } from './migrationPolicy'
import { pendingMigrations } from './migrations'

/*
  `npm run db:migrate`: the only way migrations are applied (servers never migrate).
  1. Load and validate the configuration (an explicit DATABASE_PROVIDER is required).
  2. Refuse production unless confirmed with --confirm-production=<NEON_BRANCH_ID>.
  3. Connect; for Neon, verify the branch before anything else.
  4. Show what will be applied, apply it, and report.
*/

if (existsSync('.env')) process.loadEnvFile('.env')
const env = loadEnv(process.env)
assertMigrationAllowed(env, process.argv.slice(2))

const database = await openDatabase(databaseConfig(env)) // for Neon, verifies the branch first
console.log(`Target: ${describeDatabase(env)} · NODE_ENV=${env.NODE_ENV}`)
try {
  const pending = await pendingMigrations(database.db)
  if (pending.length === 0) {
    console.log('Schema is up to date. Nothing to apply.')
  } else {
    console.log(`Applying: ${pending.join(', ')}`)
    await database.migrate()
    console.log('Migrations applied.')
  }
} finally {
  await database.close()
}
