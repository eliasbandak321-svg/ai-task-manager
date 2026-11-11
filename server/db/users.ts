import { randomUUID } from 'node:crypto'
import { createInboxProject } from '../../src/domain'
import type { Database } from './client'
import { projects, users } from './schema'

export interface NewUser {
  id: string
  name: string
  email: string
}

interface Clock {
  now?: () => Date
  newId?: () => string
}

type Executor = Pick<Database, 'insert'>

/**
 * Creates the user's Inbox unless they already have one. Better Auth calls this right after
 * sign-up; DbRepository also calls it if a user somehow has none (e.g. the sign-up hook
 * failed), so every user always has an Inbox. Safe to run any number of times: the
 * one-Inbox-per-user index turns a second insert into a no-op.
 */
export async function createInboxFor(db: Executor, userId: string, { now = () => new Date(), newId = randomUUID }: Clock = {}) {
  const inbox = createInboxProject({ id: newId(), userId, now: now() })
  await db
    .insert(projects)
    .values({ ...inbox, createdAt: new Date(inbox.createdAt), updatedAt: new Date(inbox.updatedAt) })
    .onConflictDoNothing()
}

/**
 * Creates a user row with their Inbox, unless they already exist. Used by tests, which need
 * users without going through the sign-up flow. Real users are created by Better Auth.
 */
export async function ensureUserWithInbox(db: Database, user: NewUser, clock: Clock = {}): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.insert(users).values(user).onConflictDoNothing({ target: users.id })
    await createInboxFor(tx, user.id, clock)
  })
}
