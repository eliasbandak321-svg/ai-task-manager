import { existsSync } from 'node:fs'
import { serve } from '@hono/node-server'
import { openDatabase } from './db/client'
import { assertSchemaUpToDate } from './db/migrations'
import { databaseConfig, describeDatabase, loadEnv } from './env'
import { buildServer } from './server'

/*
  Local entry point (`npm run dev:api`, or `npm run dev` for both the app and the API).
  It only wires things together: configuration, database, authentication, HTTP server.
  In M11 a Vercel Function mounts the same createApp() instead (docs/architecture.md §9).
*/

// ENV_FILE lets the end-to-end tests use their own settings and never read .env (Neon).
const envFile = process.env.ENV_FILE ?? '.env'
if (existsSync(envFile)) process.loadEnvFile(envFile)
const env = loadEnv(process.env)

// Connects (verifying the Neon branch) but never migrates: restarting the server can't change
// a schema. If migrations are pending it stops and asks for `npm run db:migrate`.
const { db, close } = await openDatabase(databaseConfig(env))
await assertSchemaUpToDate(db)
const { app, origins } = buildServer(env, db)

// 127.0.0.1 only: the API isn't reachable from other machines on the network.
const server = serve({ fetch: app.fetch, port: env.API_PORT, hostname: '127.0.0.1' }, ({ port }) => {
  // Never print DATABASE_URL: it contains the password.
  console.log(`API ready on http://127.0.0.1:${port}/api · database: ${describeDatabase(env)}`)
  console.log(`Open the app at ${env.APP_ORIGIN} (also accepted: ${origins.slice(1).join(', ') || 'none'})`)
})

// Close the database cleanly (PGlite must flush to disk) when stopped with Ctrl+C.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close()
    void close().finally(() => process.exit(0))
  })
}
