import { existsSync } from 'node:fs'
import { inArray } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { describeRepositoryContract } from '../../src/test/repositoryContract'
import { databaseConfig, loadEnv } from '../env'
import { createTestUser } from '../test/testDatabase'
import { openDatabase, type DatabaseHandle } from './client'
import { DbRepository } from './dbRepository'
import { assertSchemaUpToDate } from './migrations'
import { users } from './schema'

/*
  Opt-in: `npm run test:neon` runs the repository contract against the real Neon development
  branch configured in .env. Skipped otherwise, so `npm run test:run` and CI stay offline.

  Safety: it only runs when NEON_BRANCH_ID is set (openDatabase refuses any other branch),
  and it deletes every user it created afterwards; their data goes with them (cascade).
*/

const enabled = process.env.RUN_NEON_TESTS === '1'

// Every query crosses the internet, and one contract test creates 50 subtasks one at a time.
vi.setConfig({ testTimeout: 60_000 })

describe.skipIf(!enabled)('Neon development branch', () => {
  let handle: DatabaseHandle
  const createdUsers: string[] = []

  beforeAll(async () => {
    if (existsSync('.env')) process.loadEnvFile('.env')
    const env = loadEnv(process.env)
    if (env.DATABASE_PROVIDER !== 'neon') {
      throw new Error('test:neon needs DATABASE_PROVIDER=neon in .env')
    }
    handle = await openDatabase(databaseConfig(env)) // verifies the branch; never migrates
    await assertSchemaUpToDate(handle.db)
  }, 60_000)

  afterAll(async () => {
    if (handle && createdUsers.length > 0) {
      await handle.db.delete(users).where(inArray(users.id, createdUsers))
    }
    await handle?.close()
  }, 60_000)

  async function newUser(): Promise<string> {
    const id = await createTestUser(handle.db)
    createdUsers.push(id)
    return id
  }

  describeRepositoryContract('DbRepository on Neon', async () => new DbRepository(handle.db, await newUser()))

  it('keeps two users apart on Neon', async () => {
    const alice = new DbRepository(handle.db, await newUser())
    const bob = new DbRepository(handle.db, await newUser())
    const [inbox] = await alice.listProjects()
    const task = await alice.createTask({ projectId: inbox.id, title: 'Private' })
    expect(await bob.listTasks()).toEqual([])
    await expect(bob.updateTask(task.id, { title: 'Hacked' })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
