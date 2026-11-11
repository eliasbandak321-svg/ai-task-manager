import { existsSync } from 'node:fs'
import { databaseConfig, loadEnv } from '../env'
import { openDatabase } from './client'

/*
  `npm run db:migrate`: applies pending migrations from drizzle/ to the configured database
  (PGlite by default, or DATABASE_URL). The dev API also does this on startup; this script
  is for doing it explicitly, e.g. against a real PostgreSQL server.
*/

if (existsSync('.env')) process.loadEnvFile('.env')
const env = loadEnv(process.env)
const { close } = await openDatabase(databaseConfig(env)) // opening applies the migrations
await close()
console.log(env.NEON_BRANCH_ID ? `Migrations applied to Neon branch ${env.NEON_BRANCH_ID}.` : 'Migrations applied.')
