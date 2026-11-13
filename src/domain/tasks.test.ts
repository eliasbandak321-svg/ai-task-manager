import { describe, expect, it } from 'vitest'
import { makeProject, makeSubtask, makeTask, nextId, T0, USER_A, USER_B } from '../test/factories'
import { errorCode } from '../test/domainErrors'
import { createTaskInputSchema, taskSchema } from './schemas'
import { createTask, planTaskDeletion, setTaskStatus, updateTask } from './tasks'

const now = new Date('2026-02-01T10:00:00.000Z')
const NOW = '2026-02-01T10:00:00.000Z'


describe('createTask', () => {
  const project = makeProject()

  it('creates a task from parsed input', () => {
    const id = nextId()
    const input = createTaskInputSchema.parse({ projectId: project.id, title: 'Write intro', priority: 'high' })

    expect(createTask(input, [project], { id, userId: USER_A, now })).toEqual({
      id,
      userId: USER_A,
      projectId: project.id,
      title: 'Write intro',
      description: '',
      status: 'todo',
      priority: 'high',
      dueDate: null,
      estimatedMinutes: null,
      completedAt: null,
      createdAt: NOW,
      updatedAt: NOW,
    })
  })

  it('sets completedAt when a task is created as done', () => {
    const input = createTaskInputSchema.parse({ projectId: project.id, title: 'Already done', status: 'done' })
    expect(createTask(input, [project], { id: nextId(), userId: USER_A, now }).completedAt).toBe(NOW)
  })

  it('rejects a project that does not exist', () => {
    const input = createTaskInputSchema.parse({ projectId: nextId(), title: 'x' })
    expect(errorCode(() => createTask(input, [project], { id: nextId(), userId: USER_A, now }))).toBe('NOT_FOUND')
  })

  it("treats another user's project as not found", () => {
    const othersProject = makeProject({ userId: USER_B })
    const input = createTaskInputSchema.parse({ projectId: othersProject.id, title: 'x' })
    expect(errorCode(() => createTask(input, [othersProject], { id: nextId(), userId: USER_A, now }))).toBe(
      'NOT_FOUND',
    )
  })
})

describe('updateTask', () => {
  const project = makeProject()
  const otherProject = makeProject()
  const projects = [project, otherProject]

  it('applies changed fields and bumps updatedAt', () => {
    const task = makeTask({ projectId: project.id })
    const updated = updateTask(task, { title: 'New title', priority: 'high', dueDate: '2026-03-01' }, projects, now)
    expect(updated).toEqual({ ...task, title: 'New title', priority: 'high', dueDate: '2026-03-01', updatedAt: NOW })
  })

  it('returns the same object when nothing actually changes', () => {
    const task = makeTask({ projectId: project.id, title: 'Same', priority: 'low' })
    expect(updateTask(task, { title: 'Same', priority: 'low' }, projects, now)).toBe(task)
  })

  it('clears the deadline with null', () => {
    const task = makeTask({ projectId: project.id, dueDate: '2026-03-01' })
    expect(updateTask(task, { dueDate: null }, projects, now).dueDate).toBeNull()
  })

  it("moves a task to another of the user's projects", () => {
    const task = makeTask({ projectId: project.id })
    expect(updateTask(task, { projectId: otherProject.id }, projects, now).projectId).toBe(otherProject.id)
  })

  it("refuses to move a task into another user's project", () => {
    const task = makeTask({ projectId: project.id })
    const foreign = makeProject({ userId: USER_B })
    expect(errorCode(() => updateTask(task, { projectId: foreign.id }, [...projects, foreign], now))).toBe(
      'NOT_FOUND',
    )
  })

  it('does not mutate the original task', () => {
    const task = makeTask({ projectId: project.id, title: 'Original' })
    updateTask(task, { title: 'Changed' }, projects, now)
    expect(task.title).toBe('Original')
  })
})

describe('setTaskStatus and completedAt', () => {
  const project = makeProject()

  it('sets completedAt when a task becomes done', () => {
    const task = makeTask({ projectId: project.id, status: 'in_progress' })
    expect(setTaskStatus(task, 'done', now)).toMatchObject({ status: 'done', completedAt: NOW, updatedAt: NOW })
  })

  it('clears completedAt when a done task is reopened', () => {
    const task = makeTask({ projectId: project.id, status: 'done', completedAt: T0 })
    expect(setTaskStatus(task, 'todo', now)).toMatchObject({ status: 'todo', completedAt: null })
  })

  it('keeps the original completedAt when a done task is edited', () => {
    const task = makeTask({ projectId: project.id, status: 'done', completedAt: T0 })
    expect(updateTask(task, { title: 'Renamed' }, [project], now).completedAt).toBe(T0)
  })

  it('allows any status change, including skipping In progress', () => {
    const task = makeTask({ projectId: project.id, status: 'todo' })
    expect(setTaskStatus(task, 'done', now).status).toBe('done')
  })

  it('returns the same object when the status is unchanged', () => {
    const task = makeTask({ projectId: project.id, status: 'todo' })
    expect(setTaskStatus(task, 'todo', now)).toBe(task)
  })
})

describe('task invariants', () => {
  it('keeps every task valid through any sequence of status changes', () => {
    const project = makeProject()
    const statuses = ['todo', 'done', 'done', 'in_progress', 'done', 'todo', 'in_progress', 'in_progress'] as const
    let task = makeTask({ projectId: project.id })
    statuses.forEach((status, step) => {
      task = setTaskStatus(task, status, new Date(Date.UTC(2026, 1, 1, step)))
      expect(taskSchema.safeParse(task).success).toBe(true)
    })
  })
})

describe('planTaskDeletion', () => {
  it("includes the task's own subtasks only", () => {
    const task = makeTask()
    const own = makeSubtask({ taskId: task.id })
    const other = makeSubtask()
    const foreign = makeSubtask({ taskId: task.id, userId: USER_B })
    expect(planTaskDeletion(task, [own, other, foreign])).toEqual({ taskId: task.id, subtaskIds: [own.id] })
  })
})

describe('ownership checks', () => {
  it('rejects combining a task and a project list from different users', () => {
    const foreignTask = makeTask({ userId: USER_B })
    const project = makeProject()
    expect(errorCode(() => updateTask(foreignTask, { projectId: project.id }, [project], now))).toBe('NOT_FOUND')
  })
})
