import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { describeRepositoryContract } from '../../src/test/repositoryContract'
import { createTestUser, setupTestDatabase } from '../test/testDatabase'
import { duplicateNameError } from '../test/duplicateNameError'
import { DbRepository, isUniqueViolation } from './dbRepository'
import { ensureUserWithInbox } from './users'

const database = setupTestDatabase()

// The same contract the browser's LocalRepository passes: identical behaviour, real PostgreSQL.
describeRepositoryContract('DbRepository', async () => new DbRepository(database(), await createTestUser(database())))

describe('DbRepository (database specifics)', () => {
  it('keeps each user’s data separate', async () => {
    const alice = new DbRepository(database(), await createTestUser(database()))
    const bob = new DbRepository(database(), await createTestUser(database()))
    const [aliceInbox] = await alice.listProjects()
    const task = await alice.createTask({ projectId: aliceInbox.id, title: 'Private' })
    const step = await alice.createSubtask(task.id, { title: 'Private step' })

    expect(await bob.listTasks()).toEqual([])
    expect(await bob.listSubtasks()).toEqual([])
    expect((await bob.listProjects()).map((project) => project.id)).not.toContain(aliceInbox.id)

    // Every way of reaching Alice's data by id reports "not found" to Bob.
    const notFound = { code: 'NOT_FOUND' }
    await expect(bob.updateTask(task.id, { title: 'Hacked' })).rejects.toMatchObject(notFound)
    await expect(bob.deleteTask(task.id)).rejects.toMatchObject(notFound)
    await expect(bob.createTask({ projectId: aliceInbox.id, title: 'Sneaky' })).rejects.toMatchObject(notFound)
    await expect(bob.createSubtask(task.id, { title: 'Sneaky' })).rejects.toMatchObject(notFound)
    await expect(bob.updateSubtask(step.id, { done: true })).rejects.toMatchObject(notFound)
    await expect(bob.deleteSubtask(step.id)).rejects.toMatchObject(notFound)
    await expect(bob.reorderSubtasks(task.id, [step.id])).rejects.toMatchObject(notFound)
    await expect(bob.deleteProject(aliceInbox.id)).rejects.toMatchObject(notFound)

    // Bob can't move his task into Alice's project either.
    const [bobInbox] = await bob.listProjects()
    const bobTask = await bob.createTask({ projectId: bobInbox.id, title: 'Mine' })
    await expect(bob.updateTask(bobTask.id, { projectId: aliceInbox.id })).rejects.toMatchObject(notFound)

    // And Alice's data is untouched.
    expect(await alice.listTasks()).toEqual([task])
    expect(await alice.listSubtasks()).toEqual([step])
  })

  it('treats ids that are not UUIDs as not found, without querying', async () => {
    const repo = new DbRepository(database(), await createTestUser(database()))
    await expect(repo.deleteTask('not-a-uuid')).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(repo.updateProject("1'; drop table task; --", { name: 'x' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('stores timestamps and dates without shifting them', async () => {
    const now = new Date('2026-03-10T23:30:00.123Z')
    const repo = new DbRepository(database(), await createTestUser(database()), { now: () => now })
    const [inbox] = await repo.listProjects()
    await repo.createTask({ projectId: inbox.id, title: 'A', dueDate: '2026-03-11', status: 'done' })

    const [stored] = await repo.listTasks()
    expect(stored).toMatchObject({
      dueDate: '2026-03-11',
      createdAt: '2026-03-10T23:30:00.123Z',
      completedAt: '2026-03-10T23:30:00.123Z',
    })
  })

  it('signing up twice keeps exactly one Inbox', async () => {
    const id = randomUUID()
    const user = { id, name: 'Twice', email: `${id}@example.test` }
    await ensureUserWithInbox(database(), user)
    await ensureUserWithInbox(database(), user)
    expect(await new DbRepository(database(), id).listProjects()).toHaveLength(1)
  })
})

describe('database constraints (second line of defence)', () => {
  it('rejects a task that points at another user’s project, even when written directly', async () => {
    const alice = await createTestUser(database())
    const bob = await createTestUser(database())
    const [aliceInbox] = await new DbRepository(database(), alice).listProjects()

    await expect(
      database().execute(sql`
        insert into task (id, user_id, project_id, title, status, priority, created_at, updated_at)
        values (${randomUUID()}, ${bob}, ${aliceInbox.id}, 'Sneaky', 'todo', 'medium', now(), now())`),
    ).rejects.toThrow()
  })

  it('rejects invalid statuses and a completed_at that contradicts the status', async () => {
    const userId = await createTestUser(database())
    const [inbox] = await new DbRepository(database(), userId).listProjects()
    const insert = (status: string, completedAt: string | null) =>
      database().execute(sql`
        insert into task (id, user_id, project_id, title, status, priority, completed_at, created_at, updated_at)
        values (${randomUUID()}, ${userId}, ${inbox.id}, 'A', ${status}, 'medium', ${completedAt}, now(), now())`)

    await expect(insert('maybe', null)).rejects.toThrow()
    await expect(insert('done', null)).rejects.toThrow()
    await expect(insert('todo', '2026-01-01T00:00:00Z')).rejects.toThrow()
  })

  it('recognises the driver’s unique-violation error, so a race reports a duplicate name', async () => {
    const error = await duplicateNameError(database(), await createTestUser(database()))
    expect(isUniqueViolation(error)).toBe(true)
    expect(isUniqueViolation(new Error('something else'))).toBe(false)
  })

  it('lets exactly one of two concurrent creates with the same name succeed', async () => {
    const repo = new DbRepository(database(), await createTestUser(database()))
    // Whichever guard catches it (the domain check or the unique index), the result is the same rule error.
    const results = await Promise.allSettled([repo.createProject({ name: 'Race' }), repo.createProject({ name: 'race' })])
    const failures = results.filter((result) => result.status === 'rejected')
    expect(failures).toHaveLength(1)
    expect((failures[0] as PromiseRejectedResult).reason).toMatchObject({ code: 'DUPLICATE_PROJECT_NAME' })
  })
})
