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
import { AiService } from '../ai/aiService'
import { MockAiProvider } from '../ai/mockProvider'
import { Workspace } from '../workspace/workspace'

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
    // Tests never use the paid AI provider, whatever .env says; the key isn't kept around.
    delete process.env.ANTHROPIC_API_KEY
    const env = loadEnv({ ...process.env, AI_PROVIDER: 'mock' })
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

  it('runs the M9 calendar, scheduling, plan and assistant flows on Neon (demo AI)', async () => {
    const workspace = new Workspace(handle.db, await newUser())
    const ai = new AiService(workspace, { provider: new MockAiProvider(), dailyRequestLimit: 50 })
    await workspace.preferences.save({
      timeZone: 'Europe/Berlin',
      useCase: 'student',
      workDays: [0, 1, 2, 3, 4, 5, 6],
      dayStartMinutes: 0,
      dayEndMinutes: 1440,
      focusPeriod: 'none',
      sessionMinutes: 60,
      breakMinutes: 0,
      maxDailyMinutes: 960,
    })

    const plan = await ai.plan({ goal: 'Neon contract goal' })
    const applied = await workspace.apply(plan.id, {})
    expect(applied.status).toBe('applied')
    await expect(workspace.apply(plan.id, {})).rejects.toMatchObject({ code: 'PROPOSAL_DECIDED' })

    const now = new Date()
    const series = await workspace.calendar.create({
      title: 'Standup',
      category: 'meeting',
      startAt: new Date(now.getTime() + 86_400_000).toISOString(),
      endAt: new Date(now.getTime() + 86_400_000 + 900_000).toISOString(),
      timeZone: 'Europe/Berlin',
      recurrence: { freq: 'daily', count: 5 },
    })
    const week = await workspace.calendar.occurrences(now, new Date(now.getTime() + 8 * 86_400_000))
    expect(week.filter((o) => o.eventId === series.id)).toHaveLength(5)

    const today = now.toISOString().slice(0, 10)
    const schedule = await workspace.proposeSchedule({ from: today, to: today })
    if (schedule.payload.kind === 'schedule' && schedule.payload.items.length > 0) {
      await workspace.apply(schedule.id, {})
    }

    const chat = await ai.chat({ message: 'What should I focus on?' })
    expect(chat.message.source).toBe('mock')

    // Dependencies (migration 0003): stored, cycles refused, effort computed.
    const [first, second] = (await workspace.tasks.listTasks()).slice(0, 2)
    await workspace.dependencies.set(first.id, { dependsOn: [] })
    await workspace.dependencies.set(second.id, { dependsOn: [first.id] })
    await expect(workspace.dependencies.set(first.id, { dependsOn: [second.id] })).rejects.toMatchObject({ code: 'DEPENDENCY_CYCLE' })
    expect((await workspace.efforts())[first.id]).toMatchObject({ completedMinutes: 0 })

    // Another user sees none of it.
    const other = new Workspace(handle.db, await newUser())
    expect(await other.calendar.occurrences(now, new Date(now.getTime() + 8 * 86_400_000))).toEqual([])
    await expect(other.proposals.get(plan.id)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(await new AiService(other, { provider: new MockAiProvider(), dailyRequestLimit: 50 }).listConversations()).toEqual([])
  })
})
