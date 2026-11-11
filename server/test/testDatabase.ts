import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll } from 'vitest'
import { openDatabase, type Database, type DatabaseHandle } from '../db/client'
import { ensureUserWithInbox } from '../db/users'

/**
 * One in-memory PostgreSQL (PGlite) per test file, with all migrations applied: real SQL,
 * constraints and transactions, without a database server. Tests stay independent by
 * creating a fresh user each time (createTestUser), since every query is scoped to a user.
 */
export function setupTestDatabase(): () => Database {
  let handle: DatabaseHandle | undefined
  beforeAll(async () => {
    handle = await openDatabase({ kind: 'pglite' }, { migrate: true })
  })
  afterAll(async () => {
    await handle?.close()
  })
  return () => {
    if (!handle) throw new Error('The test database is not open yet')
    return handle.db
  }
}

/** Signs up a new user (with their Inbox) and returns their id. */
export async function createTestUser(db: Database): Promise<string> {
  const id = randomUUID()
  await ensureUserWithInbox(db, { id, name: 'Test user', email: `${id}@example.test` })
  return id
}
