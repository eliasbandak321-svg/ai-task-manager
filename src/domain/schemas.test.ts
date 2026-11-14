import { describe, expect, it } from 'vitest'
import { makeSubtask, makeTask, nextId, USER_A } from '../test/factories'
import { LIMITS } from './constants'
import {
  createProjectInputSchema,
  createSubtaskInputSchema,
  createTaskInputSchema,
  subtaskSchema,
  taskSchema,
  updateSubtaskInputSchema,
  updateTaskInputSchema,
} from './schemas'

describe('createTaskInputSchema', () => {
  const projectId = nextId()

  it('trims the title and applies defaults', () => {
    const input = createTaskInputSchema.parse({ projectId, title: '  Write report  ' })
    expect(input).toEqual({
      projectId,
      title: 'Write report',
      description: '',
      status: 'todo',
      priority: 'medium',
      dueDate: null,
      estimatedMinutes: null,
    })
  })

  it('accepts whole-minute estimates within limits, or null', () => {
    expect(createTaskInputSchema.parse({ projectId, title: 'A', estimatedMinutes: 45 }).estimatedMinutes).toBe(45)
    for (const estimatedMinutes of [0, 4, 6001, 12.5, '30']) {
      expect(createTaskInputSchema.safeParse({ projectId, title: 'A', estimatedMinutes }).success).toBe(false)
    }
  })

  it('rejects a blank title', () => {
    expect(createTaskInputSchema.safeParse({ projectId, title: '   ' }).success).toBe(false)
  })

  it('rejects titles and descriptions over the length limits', () => {
    const longTitle = 'x'.repeat(LIMITS.taskTitle + 1)
    const longDescription = 'x'.repeat(LIMITS.taskDescription + 1)
    expect(createTaskInputSchema.safeParse({ projectId, title: longTitle }).success).toBe(false)
    expect(createTaskInputSchema.safeParse({ projectId, title: 'ok', description: longDescription }).success).toBe(
      false,
    )
  })

  it('rejects impossible deadlines and unknown statuses or priorities', () => {
    expect(createTaskInputSchema.safeParse({ projectId, title: 'ok', dueDate: '2025-02-29' }).success).toBe(false)
    expect(createTaskInputSchema.safeParse({ projectId, title: 'ok', status: 'blocked' }).success).toBe(false)
    expect(createTaskInputSchema.safeParse({ projectId, title: 'ok', priority: 'urgent' }).success).toBe(false)
  })

  it('rejects server-owned fields such as userId (mass-assignment protection)', () => {
    const result = createTaskInputSchema.safeParse({ projectId, title: 'ok', userId: USER_A })
    expect(result.success).toBe(false)
  })
})

describe('updateTaskInputSchema', () => {
  it('accepts a partial update, including clearing the deadline', () => {
    expect(updateTaskInputSchema.parse({ dueDate: null })).toEqual({ dueDate: null })
  })

  it('rejects an empty update, including one whose only keys are undefined', () => {
    expect(updateTaskInputSchema.safeParse({}).success).toBe(false)
    expect(updateTaskInputSchema.safeParse({ title: undefined }).success).toBe(false)
  })

  it('rejects completedAt, which only the domain logic may set', () => {
    expect(updateTaskInputSchema.safeParse({ completedAt: '2026-01-01T00:00:00.000Z' }).success).toBe(false)
  })
})

describe('createProjectInputSchema', () => {
  it('trims the name and enforces its length', () => {
    expect(createProjectInputSchema.parse({ name: ' Thesis ' })).toEqual({ name: 'Thesis' })
    expect(createProjectInputSchema.safeParse({ name: '' }).success).toBe(false)
    expect(createProjectInputSchema.safeParse({ name: 'x'.repeat(LIMITS.projectName + 1) }).success).toBe(false)
  })
})

describe('subtask input schemas', () => {
  it('requires a non-blank title on create', () => {
    expect(createSubtaskInputSchema.parse({ title: ' Outline ' })).toEqual({ title: 'Outline' })
    expect(createSubtaskInputSchema.safeParse({ title: ' ' }).success).toBe(false)
  })

  it('requires at least one field on update', () => {
    expect(updateSubtaskInputSchema.parse({ done: true })).toEqual({ done: true })
    expect(updateSubtaskInputSchema.safeParse({}).success).toBe(false)
  })
})

describe('entity schemas', () => {
  it('accepts valid entities from the factories', () => {
    expect(taskSchema.safeParse(makeTask()).success).toBe(true)
    expect(taskSchema.safeParse(makeTask({ status: 'done' })).success).toBe(true)
    expect(subtaskSchema.safeParse(makeSubtask()).success).toBe(true)
  })

  it('enforces that completedAt is set exactly when a task is done', () => {
    expect(taskSchema.safeParse(makeTask({ status: 'done', completedAt: null })).success).toBe(false)
    expect(taskSchema.safeParse(makeTask({ status: 'todo', completedAt: '2026-01-01T00:00:00.000Z' })).success).toBe(
      false,
    )
  })
})
