import { randomUUID } from 'node:crypto'
import { createInboxProject } from '../../src/domain'
import type { Database } from './client'
import { projects, users } from './schema'

export interface NewUser {
  id: string
  name: string
  email: string
}

/**
 * Creates a user with their Inbox, unless they already exist. This is the sign-up step:
 * in M6 it runs for the development user at startup, and in M7 Better Auth calls it after
 * a real sign-up. Safe to run twice (the one-Inbox-per-user index makes the insert a no-op).
 */
export async function ensureUserWithInbox(
  db: Database,
  user: NewUser,
  { now = () => new Date(), newId = randomUUID }: { now?: () => Date; newId?: () => string } = {},
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(users).values(user).onConflictDoNothing({ target: users.id })
    const inbox = createInboxProject({ id: newId(), userId: user.id, now: now() })
    await tx
      .insert(projects)
      .values({ ...inbox, createdAt: new Date(inbox.createdAt), updatedAt: new Date(inbox.updatedAt) })
      .onConflictDoNothing()
  })
}
