import { describe, expect, it } from 'vitest'
import { makeProject, makeTask, USER_B } from '../test/factories'
import { computeProjectProgress, computeTaskStats, toPercent } from './stats'

const TODAY = '2026-03-10'

describe('toPercent', () => {
  it('is 0 for an empty list instead of dividing by zero', () => {
    expect(toPercent(0, 0)).toBe(0)
  })

  it('rounds down, so 100% only appears when everything is done', () => {
    expect(toPercent(199, 200)).toBe(99)
    expect(toPercent(200, 200)).toBe(100)
    expect(toPercent(1, 3)).toBe(33)
    expect(toPercent(2, 3)).toBe(66)
  })
})

describe('computeTaskStats', () => {
  it('summarises an empty list', () => {
    expect(computeTaskStats([], TODAY)).toEqual({
      total: 0,
      byStatus: { todo: 0, in_progress: 0, done: 0 },
      openByPriority: { low: 0, medium: 0, high: 0 },
      completionPercent: 0,
      overdue: 0,
      dueToday: 0,
      dueSoon: 0,
    })
  })

  it('counts statuses, open priorities, completion and deadlines', () => {
    const tasks = [
      makeTask({ status: 'todo', priority: 'high', dueDate: '2026-03-01' }), // overdue
      makeTask({ status: 'in_progress', priority: 'high', dueDate: TODAY }), // due today
      makeTask({ status: 'todo', priority: 'low', dueDate: '2026-03-12' }), // due soon
      makeTask({ status: 'done', priority: 'high', dueDate: '2026-03-01' }), // done: no deadline pressure
      makeTask({ status: 'done', priority: 'medium' }),
    ]

    expect(computeTaskStats(tasks, TODAY)).toEqual({
      total: 5,
      byStatus: { todo: 2, in_progress: 1, done: 2 },
      openByPriority: { low: 1, medium: 0, high: 2 },
      completionPercent: 40,
      overdue: 1,
      dueToday: 1,
      dueSoon: 1,
    })
  })
})

describe('computeProjectProgress', () => {
  it('computes stats per project, including projects without tasks', () => {
    const a = makeProject({ name: 'A' })
    const b = makeProject({ name: 'B' })
    const tasks = [
      makeTask({ projectId: a.id, status: 'done' }),
      makeTask({ projectId: a.id, status: 'todo' }),
    ]

    const progress = computeProjectProgress([a, b], tasks, TODAY)

    expect(progress.get(a.id)).toMatchObject({ total: 2, completionPercent: 50 })
    expect(progress.get(b.id)).toMatchObject({ total: 0, completionPercent: 0 })
  })

  it("ignores another user's tasks that reference the project", () => {
    const project = makeProject()
    const foreign = makeTask({ projectId: project.id, userId: USER_B, status: 'done' })

    expect(computeProjectProgress([project], [foreign], TODAY).get(project.id)?.total).toBe(0)
  })
})
