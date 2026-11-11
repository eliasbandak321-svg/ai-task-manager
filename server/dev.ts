import { existsSync } from 'node:fs'
import { serve } from '@hono/node-server'
import { createApp } from './app'
import { developmentUser } from './auth'
import { openDatabase } from './db/client'
import { ensureUserWithInbox } from './db/users'
import { databaseConfig, loadEnv } from './env'

/*
  Local entry point (`npm run dev:api`, or `npm run dev` for both the app and the API).
  It only wires things together: configuration, database, development user, HTTP server.
  In M11 a Vercel Function mounts the same createApp() instead (docs/architecture.md §9).
*/

if (existsSync('.env')) process.loadEnvFile('.env')
const env = loadEnv(process.env)

const { db, close } = await openDatabase(databaseConfig(env))
await ensureUserWithInbox(db, { id: env.DEV_USER_ID, name: 'Local user', email: 'local-user@localhost' })

const app = createApp({ db, resolveUserId: developmentUser(env.DEV_USER_ID, env.NODE_ENV) })

// 127.0.0.1 only: the API isn't reachable from other machines on the network.
const server = serve({ fetch: app.fetch, port: env.API_PORT, hostname: '127.0.0.1' }, ({ port }) => {
  // Never print DATABASE_URL: it contains the password.
  const database = env.NEON_BRANCH_ID
    ? `Neon branch ${env.NEON_BRANCH_ID} (verified)`
    : env.DATABASE_URL
      ? 'PostgreSQL (DATABASE_URL)'
      : `PGlite (${env.PGLITE_DIR})`
  console.log(`API ready on http://127.0.0.1:${port}/api · database: ${database}`)
})

// Close the database cleanly (PGlite must flush to disk) when stopped with Ctrl+C.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    server.close()
    void close().finally(() => process.exit(0))
  })
}
