import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { describeRepositoryContract } from '../../src/test/repositoryContract'
import { createTestUser } from '../test/testDatabase'
import { duplicateNameError } from '../test/duplicateNameError'
import { openDatabase, type DatabaseHandle } from './client'
import { DbRepository, isUniqueViolation } from './dbRepository'

/*
  The DATABASE_URL path: the node-postgres driver over the real PostgreSQL network protocol,
  as used with a local PostgreSQL server or Neon (M11). No server is installed here, so PGlite
  is served over a socket and the driver connects to it like to any PostgreSQL server.
*/

const PORT = 54_329
let server: PGLiteSocketServer
let backend: PGlite
let handle: DatabaseHandle

beforeAll(async () => {
  backend = new PGlite()
  server = new PGLiteSocketServer({ db: backend, port: PORT, host: '127.0.0.1' })
  await server.start()
  handle = await openDatabase({ kind: 'postgres', url: `postgres://postgres@127.0.0.1:${PORT}/postgres` }, { migrate: true })
})

afterAll(async () => {
  await handle?.close()
  await server?.stop()
  await backend?.close()
})

describe('node-postgres driver (DATABASE_URL)', () => {
  it('applies the migrations over the network protocol', async () => {
    const result = await backend.query<{ count: number }>(
      "select count(*)::int as count from information_schema.tables where table_schema = 'public'",
    )
    expect(result.rows[0].count).toBe(14) // 3 task-data + 5 auth + 6 calendar, scheduling and AI tables
  })
})

describeRepositoryContract('DbRepository over node-postgres', async () => new DbRepository(handle.db, await createTestUser(handle.db)))

// Last on purpose: after a database error the PGlite socket test server drops the connection
// (a limitation of the test server, not of PostgreSQL), which would break later tests.
describe('node-postgres errors', () => {
  it('recognises this driver’s unique-violation error too', async () => {
    expect(isUniqueViolation(await duplicateNameError(handle.db, await createTestUser(handle.db)))).toBe(true)
  })
})
