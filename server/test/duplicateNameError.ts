import { randomUUID } from 'node:crypto'
import type { Database } from '../db/client'
import { projects } from '../db/schema'

/** Inserts the same project name twice for `userId` and returns the database error. */
export async function duplicateNameError(db: Database, userId: string): Promise<unknown> {
  const row = () => ({ id: randomUUID(), userId, name: 'Same', createdAt: new Date(), updatedAt: new Date() })
  await db.insert(projects).values(row())
  return db.insert(projects).values(row()).then(
    () => null,
    (error: unknown) => error,
  )
}
