import { describe, expect, it } from 'vitest'
import { makeSubtask, makeTask, nextId, USER_A, USER_B } from '../test/factories'
import { errorCode } from '../test/domainErrors'
import { LIMITS } from './constants'
import {
  addSubtask,
  getTaskSubtasks,
  reorderSubtasks,
  subtaskProgress,
  updateSubtask,
} from './subtasks'


describe('getTaskSubtasks', () => {
  it("returns only the task's subtasks, ordered by position", () => {
    const task = makeTask()
    const second = makeSubtask({ taskId: task.id, position: 5 })
    const first = makeSubtask({ taskId: task.id, position: 1 })
    const other = makeSubtask({ position: 0 })
    expect(getTaskSubtasks([second, other, first], task)).toEqual([first, second])
  })

  it("ignores another user's subtasks that point at the task", () => {
    const task = makeTask()
    const foreign = makeSubtask({ taskId: task.id, userId: USER_B })
    expect(getTaskSubtasks([foreign], task)).toEqual([])
  })
})

describe('addSubtask', () => {
  it('appends after the highest existing position', () => {
    const task = makeTask()
    const existing = [makeSubtask({ taskId: task.id, position: 0 }), makeSubtask({ taskId: task.id, position: 4 })]
    const id = nextId()

    expect(addSubtask(task, existing, { title: 'Draft' }, { id, userId: USER_A })).toEqual({
      id,
      userId: USER_A,
      taskId: task.id,
      title: 'Draft',
      done: false,
      position: 5,
    })
  })

  it('starts at position 0 for the first subtask', () => {
    const task = makeTask()
    expect(addSubtask(task, [], { title: 'First' }, { id: nextId(), userId: USER_A }).position).toBe(0)
  })

  it('enforces the per-task limit', () => {
    const task = makeTask()
    const full = Array.from({ length: LIMITS.subtasksPerTask }, (_, position) =>
      makeSubtask({ taskId: task.id, position }),
    )
    expect(errorCode(() => addSubtask(task, full, { title: 'One more' }, { id: nextId(), userId: USER_A }))).toBe(
      'SUBTASK_LIMIT_REACHED',
    )
  })

  it("refuses to add a subtask to another user's task", () => {
    const foreignTask = makeTask({ userId: USER_B })
    expect(errorCode(() => addSubtask(foreignTask, [], { title: 'x' }, { id: nextId(), userId: USER_A }))).toBe(
      'NOT_FOUND',
    )
  })
})

describe('updateSubtask', () => {
  it('toggles done and renames', () => {
    const subtask = makeSubtask({ title: 'Old', done: false })
    expect(updateSubtask(subtask, { done: true, title: 'New' })).toEqual({ ...subtask, done: true, title: 'New' })
  })

  it('returns the same object when nothing changes', () => {
    const subtask = makeSubtask({ done: true })
    expect(updateSubtask(subtask, { done: true })).toBe(subtask)
  })
})

describe('reorderSubtasks', () => {
  it('assigns positions 0..n-1 in the given order', () => {
    const task = makeTask()
    const a = makeSubtask({ taskId: task.id, position: 0 })
    const b = makeSubtask({ taskId: task.id, position: 1 })
    const c = makeSubtask({ taskId: task.id, position: 2 })

    const result = reorderSubtasks(task, [a, b, c], [c.id, a.id, b.id])

    expect(result.map((s) => [s.id, s.position])).toEqual([
      [c.id, 0],
      [a.id, 1],
      [b.id, 2],
    ])
  })

  it.each([
    ['a missing id', (ids: string[]) => ids.slice(1)],
    ['an unknown id', (ids: string[]) => [...ids.slice(1), nextId()]],
    ['a duplicate id', (ids: string[]) => [ids[0], ids[0], ids[2]]],
  ])('rejects an order with %s', (_, mutate) => {
    const task = makeTask()
    const subtasks = [0, 1, 2].map((position) => makeSubtask({ taskId: task.id, position }))
    const ids = subtasks.map((s) => s.id)
    expect(errorCode(() => reorderSubtasks(task, subtasks, mutate(ids)))).toBe('INVALID_SUBTASK_ORDER')
  })
})

describe('subtaskProgress', () => {
  it('counts done and total', () => {
    const subtasks = [makeSubtask({ done: true }), makeSubtask({ done: false }), makeSubtask({ done: true })]
    expect(subtaskProgress(subtasks)).toEqual({ done: 2, total: 3 })
  })

  it('handles a task with no subtasks', () => {
    expect(subtaskProgress([])).toEqual({ done: 0, total: 0 })
  })
})
