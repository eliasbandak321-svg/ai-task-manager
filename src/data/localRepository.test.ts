import { describe, expect, it } from 'vitest'
import { createInboxProject } from '../domain'
import { nextId, T0, USER_A, USER_B } from '../test/factories'
import { describeRepositoryContract } from '../test/repositoryContract'
import { createMemoryStorage, LocalRepository, STORAGE_KEY, StorageError } from './localRepository'

function createRepository(storage = createMemoryStorage()) {
  return new LocalRepository({ storage, now: () => new Date(T0), newId: nextId })
}

describeRepositoryContract('LocalRepository', async () => createRepository())

describe('LocalRepository (local storage specifics)', () => {
  it('keeps data across instances that share the same storage, like a page reload', async () => {
    const storage = createMemoryStorage()
    const first = createRepository(storage)
    const [inbox] = await first.listProjects()
    await first.createTask({ projectId: inbox.id, title: 'Survives a reload' })

    const second = createRepository(storage)
    expect((await second.listTasks()).map((task) => task.title)).toEqual(['Survives a reload'])
    expect(await second.listProjects()).toEqual([inbox])
  })

  it('uses the injected clock and id generator', async () => {
    const repo = createRepository()
    const [inbox] = await repo.listProjects()
    const task = await repo.createTask({ projectId: inbox.id, title: 'A' })
    expect(task.createdAt).toBe(T0)
    expect(task.id).toMatch(/^00000000-0000-4000-8000-/)
  })

  it("only ever shows the owner's rows, even if the storage contains someone else's", async () => {
    const otherInbox = createInboxProject({ id: nextId(), userId: USER_B, now: new Date(T0) })
    const mine = createInboxProject({ id: nextId(), userId: USER_A, now: new Date(T0) })
    const storage = createMemoryStorage({
      [STORAGE_KEY]: JSON.stringify({ version: 1, userId: USER_A, projects: [otherInbox, mine], tasks: [], subtasks: [] }),
    })
    const repo = createRepository(storage)

    expect(await repo.listProjects()).toEqual([mine])
    await expect(repo.deleteProject(otherInbox.id)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await expect(repo.createTask({ projectId: otherInbox.id, title: 'Sneaky' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('refuses to load unreadable or invalid saved data instead of guessing', async () => {
    for (const raw of ['{not json', JSON.stringify({ version: 1, userId: 'nope' })]) {
      const repo = createRepository(createMemoryStorage({ [STORAGE_KEY]: raw }))
      await expect(repo.listProjects()).rejects.toBeInstanceOf(StorageError)
    }
  })

  it('reports a failed save (for example, full storage) as a StorageError', async () => {
    const storage = createMemoryStorage()
    const repo = createRepository(storage)
    const [inbox] = await repo.listProjects()
    storage.setItem = () => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    }
    await expect(repo.createTask({ projectId: inbox.id, title: 'A' })).rejects.toBeInstanceOf(StorageError)
  })
})
