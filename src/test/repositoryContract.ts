import { beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { TaskRepository } from '../data/repository'
import { LIMITS, type DomainErrorCode, type Project } from '../domain'

/*
  The behaviour every TaskRepository must have, written once and run against each adapter:
  the local adapter now (src/data/localRepository.test.ts) and the HTTP adapter in M6.
  If both pass the same contract, the UI can't tell them apart.
*/

const MISSING_ID = '00000000-0000-4000-8000-ffffffffffff'

function rejectsWith(promise: Promise<unknown>, code: DomainErrorCode) {
  return expect(promise).rejects.toMatchObject({ name: 'DomainError', code })
}

function rejectsAsInvalid(promise: Promise<unknown>) {
  return expect(promise).rejects.toBeInstanceOf(z.ZodError)
}

export function describeRepositoryContract(adapterName: string, createRepository: () => Promise<TaskRepository>) {
  describe(`${adapterName}: repository contract`, () => {
    let repo: TaskRepository
    let inbox: Project

    beforeEach(async () => {
      repo = await createRepository()
      const projects = await repo.listProjects()
      inbox = projects[0]
    })

    describe('projects', () => {
      it('starts with exactly one project: the Inbox', async () => {
        const projects = await repo.listProjects()
        expect(projects).toHaveLength(1)
        expect(projects[0]).toMatchObject({ name: 'Inbox', isInbox: true })
      })

      it('creates projects and lists them Inbox first, then by name', async () => {
        await repo.createProject({ name: '  Work ' })
        await repo.createProject({ name: 'Home' })
        const names = (await repo.listProjects()).map((project) => project.name)
        expect(names).toEqual(['Inbox', 'Home', 'Work'])
      })

      it('rejects duplicate and reserved names', async () => {
        await repo.createProject({ name: 'Work' })
        await rejectsWith(repo.createProject({ name: 'work' }), 'DUPLICATE_PROJECT_NAME')
        await rejectsWith(repo.createProject({ name: 'INBOX' }), 'RESERVED_PROJECT_NAME')
      })

      it('rejects invalid input and server-owned fields', async () => {
        await rejectsAsInvalid(repo.createProject({ name: '   ' }))
        await rejectsAsInvalid(repo.createProject({ name: 'x'.repeat(LIMITS.projectName + 1) }))
        // A request can't choose its owner (mass assignment).
        await rejectsAsInvalid(repo.createProject({ name: 'Mine', userId: MISSING_ID } as never))
      })

      it('renames a project, but never the Inbox', async () => {
        const work = await repo.createProject({ name: 'Work' })
        const renamed = await repo.updateProject(work.id, { name: 'Job' })
        expect(renamed.name).toBe('Job')
        await rejectsWith(repo.updateProject(inbox.id, { name: 'Other' }), 'INBOX_PROTECTED')
      })

      it('reports unknown projects as not found', async () => {
        await rejectsWith(repo.updateProject(MISSING_ID, { name: 'X' }), 'NOT_FOUND')
        await rejectsWith(repo.deleteProject(MISSING_ID), 'NOT_FOUND')
      })

      it('deletes a project with its tasks and their subtasks, and nothing else', async () => {
        const work = await repo.createProject({ name: 'Work' })
        const doomed = await repo.createTask({ projectId: work.id, title: 'Doomed' })
        await repo.createSubtask(doomed.id, { title: 'Doomed step' })
        const kept = await repo.createTask({ projectId: inbox.id, title: 'Kept' })
        await repo.createSubtask(kept.id, { title: 'Kept step' })

        await repo.deleteProject(work.id)

        expect((await repo.listProjects()).map((project) => project.name)).toEqual(['Inbox'])
        expect((await repo.listTasks()).map((task) => task.title)).toEqual(['Kept'])
        expect((await repo.listSubtasks()).map((subtask) => subtask.title)).toEqual(['Kept step'])
      })

      it('never deletes the Inbox', async () => {
        await rejectsWith(repo.deleteProject(inbox.id), 'INBOX_PROTECTED')
      })
    })

    describe('tasks', () => {
      it('creates a task with defaults and trimmed text', async () => {
        const task = await repo.createTask({ projectId: inbox.id, title: '  Write report  ' })
        expect(task).toMatchObject({
          projectId: inbox.id,
          title: 'Write report',
          description: '',
          status: 'todo',
          priority: 'medium',
          dueDate: null,
          completedAt: null,
        })
        expect(await repo.listTasks()).toEqual([task])
      })

      it('rejects tasks in unknown projects', async () => {
        await rejectsWith(repo.createTask({ projectId: MISSING_ID, title: 'Lost' }), 'NOT_FOUND')
      })

      it('rejects invalid input and server-owned fields', async () => {
        await rejectsAsInvalid(repo.createTask({ projectId: inbox.id, title: '' }))
        await rejectsAsInvalid(repo.createTask({ projectId: inbox.id, title: 'A', dueDate: '2026-02-30' }))
        await rejectsAsInvalid(
          repo.createTask({ projectId: inbox.id, title: 'A', completedAt: '2026-01-01T00:00:00.000Z' } as never),
        )
      })

      it('updates fields and manages completedAt', async () => {
        const task = await repo.createTask({ projectId: inbox.id, title: 'A' })
        const done = await repo.updateTask(task.id, { status: 'done', priority: 'high' })
        expect(done).toMatchObject({ status: 'done', priority: 'high' })
        expect(done.completedAt).not.toBeNull()

        const reopened = await repo.updateTask(task.id, { status: 'todo' })
        expect(reopened.completedAt).toBeNull()
        expect(await repo.listTasks()).toEqual([reopened])
      })

      it('moves a task to another project', async () => {
        const work = await repo.createProject({ name: 'Work' })
        const task = await repo.createTask({ projectId: inbox.id, title: 'A' })
        expect((await repo.updateTask(task.id, { projectId: work.id })).projectId).toBe(work.id)
        await rejectsWith(repo.updateTask(task.id, { projectId: MISSING_ID }), 'NOT_FOUND')
      })

      it('rejects empty updates and unknown tasks', async () => {
        const task = await repo.createTask({ projectId: inbox.id, title: 'A' })
        await rejectsAsInvalid(repo.updateTask(task.id, {}))
        await rejectsWith(repo.updateTask(MISSING_ID, { title: 'B' }), 'NOT_FOUND')
        await rejectsWith(repo.deleteTask(MISSING_ID), 'NOT_FOUND')
      })

      it('deletes a task with its subtasks', async () => {
        const task = await repo.createTask({ projectId: inbox.id, title: 'A' })
        const other = await repo.createTask({ projectId: inbox.id, title: 'B' })
        await repo.createSubtask(task.id, { title: 'step' })
        const keptStep = await repo.createSubtask(other.id, { title: 'other step' })

        await repo.deleteTask(task.id)

        expect(await repo.listTasks()).toEqual([other])
        expect(await repo.listSubtasks()).toEqual([keptStep])
      })

      it('returns copies, so callers cannot change stored data by accident', async () => {
        const task = await repo.createTask({ projectId: inbox.id, title: 'A' })
        task.title = 'Mutated'
        expect((await repo.listTasks())[0].title).toBe('A')
      })
    })

    describe('subtasks', () => {
      it('appends subtasks in order', async () => {
        const task = await repo.createTask({ projectId: inbox.id, title: 'A' })
        const first = await repo.createSubtask(task.id, { title: 'One' })
        const second = await repo.createSubtask(task.id, { title: ' Two ' })
        expect([first.position, second.position]).toEqual([0, 1])
        expect(second).toMatchObject({ title: 'Two', done: false, taskId: task.id })
      })

      it('rejects subtasks for unknown tasks, invalid titles, and more than the limit', async () => {
        await rejectsWith(repo.createSubtask(MISSING_ID, { title: 'x' }), 'NOT_FOUND')
        const task = await repo.createTask({ projectId: inbox.id, title: 'A' })
        await rejectsAsInvalid(repo.createSubtask(task.id, { title: ' ' }))
        for (let i = 0; i < LIMITS.subtasksPerTask; i += 1) {
          await repo.createSubtask(task.id, { title: `Step ${i}` })
        }
        await rejectsWith(repo.createSubtask(task.id, { title: 'One too many' }), 'SUBTASK_LIMIT_REACHED')
      })

      it('checks off, renames and deletes subtasks', async () => {
        const task = await repo.createTask({ projectId: inbox.id, title: 'A' })
        const step = await repo.createSubtask(task.id, { title: 'Step' })

        expect(await repo.updateSubtask(step.id, { done: true, title: 'Renamed' })).toMatchObject({
          done: true,
          title: 'Renamed',
        })
        await rejectsAsInvalid(repo.updateSubtask(step.id, {}))

        await repo.deleteSubtask(step.id)
        expect(await repo.listSubtasks()).toEqual([])
        await rejectsWith(repo.deleteSubtask(step.id), 'NOT_FOUND')
        await rejectsWith(repo.updateSubtask(step.id, { done: false }), 'NOT_FOUND')
      })

      it('reorders subtasks, requiring every id exactly once', async () => {
        const task = await repo.createTask({ projectId: inbox.id, title: 'A' })
        const a = await repo.createSubtask(task.id, { title: 'a' })
        const b = await repo.createSubtask(task.id, { title: 'b' })
        const c = await repo.createSubtask(task.id, { title: 'c' })

        const reordered = await repo.reorderSubtasks(task.id, [c.id, a.id, b.id])
        expect(reordered.map((subtask) => [subtask.title, subtask.position])).toEqual([
          ['c', 0],
          ['a', 1],
          ['b', 2],
        ])
        await rejectsWith(repo.reorderSubtasks(task.id, [a.id, b.id]), 'INVALID_SUBTASK_ORDER')
        await rejectsWith(repo.reorderSubtasks(MISSING_ID, []), 'NOT_FOUND')
      })
    })
  })
}
