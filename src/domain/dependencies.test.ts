import { describe, expect, it } from 'vitest'
import { findCycle, openPrerequisites, planDependencies } from './dependencies'
import { computeTaskEffort } from './effort'

const A = '00000000-0000-4000-8000-00000000000a'
const B = '00000000-0000-4000-8000-00000000000b'
const C = '00000000-0000-4000-8000-00000000000c'
const known = new Set([A, B, C])

describe('dependencies', () => {
  it('finds cycles, including longer ones', () => {
    expect(findCycle([{ taskId: A, dependsOnId: B }])).toBeNull()
    expect(findCycle([{ taskId: A, dependsOnId: B }, { taskId: B, dependsOnId: C }, { taskId: C, dependsOnId: A }])).toEqual([A, B, C, A])
  })

  it('refuses self-references, unknown tasks and cycles; replaces a task’s prerequisites', () => {
    const existing = [{ taskId: B, dependsOnId: A }]
    expect(() => planDependencies(A, [A], existing, known)).toThrow(expect.objectContaining({ code: 'DEPENDENCY_CYCLE' }))
    expect(() => planDependencies(A, [B], existing, known)).toThrow(expect.objectContaining({ code: 'DEPENDENCY_CYCLE' }))
    expect(() => planDependencies(A, ['00000000-0000-4000-8000-000000000999'], existing, known)).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }))
    expect(planDependencies(C, [A, B, A], existing, known)).toEqual([
      { taskId: C, dependsOnId: A },
      { taskId: C, dependsOnId: B },
    ])
    // Replacing B's own prerequisites can't conflict with its old edge.
    expect(planDependencies(B, [C], existing, known)).toEqual([{ taskId: B, dependsOnId: C }])
  })

  it('collects open prerequisites transitively', () => {
    const edges = [{ taskId: C, dependsOnId: B }, { taskId: B, dependsOnId: A }]
    expect([...openPrerequisites([C], edges, () => true)].sort()).toEqual([A, B])
    expect([...openPrerequisites([C], edges, (id) => id !== B)]).toEqual([])
  })
})

describe('computeTaskEffort', () => {
  const now = new Date('2026-03-02T12:00:00.000Z')
  const session = (start: string, end: string, sessionStatus: 'planned' | 'completed' | 'skipped', category: 'work_session' | 'meeting' = 'work_session') => ({
    taskId: A,
    start,
    end,
    category,
    sessionStatus,
  })

  it('separates completed, planned, missed and skipped work', () => {
    const effort = computeTaskEffort(
      { id: A, estimatedMinutes: 300 },
      [
        session('2026-03-01T09:00:00.000Z', '2026-03-01T10:00:00.000Z', 'completed'),
        session('2026-03-01T11:00:00.000Z', '2026-03-01T11:30:00.000Z', 'planned'), // missed
        session('2026-03-01T13:00:00.000Z', '2026-03-01T14:00:00.000Z', 'skipped'),
        session('2026-03-02T11:30:00.000Z', '2026-03-02T12:30:00.000Z', 'planned'), // ongoing
        session('2026-03-03T09:00:00.000Z', '2026-03-03T10:00:00.000Z', 'planned'),
        session('2026-03-03T11:00:00.000Z', '2026-03-03T12:00:00.000Z', 'completed', 'meeting'), // not work
        { ...session('2026-03-03T13:00:00.000Z', '2026-03-03T14:00:00.000Z', 'planned'), taskId: B },
      ],
      now,
    )
    expect(effort).toEqual({
      estimatedMinutes: 300,
      completedMinutes: 60,
      plannedMinutes: 120,
      missedMinutes: 30,
      remainingMinutes: 240,
      plannedUntil: '2026-03-03T10:00:00.000Z',
    })
  })

  it('has no remaining effort without an estimate, and never goes below zero', () => {
    expect(computeTaskEffort({ id: A, estimatedMinutes: null }, [], now).remainingMinutes).toBeNull()
    const over = computeTaskEffort({ id: A, estimatedMinutes: 30 }, [session('2026-03-01T09:00:00.000Z', '2026-03-01T10:00:00.000Z', 'completed')], now)
    expect(over.remainingMinutes).toBe(0)
  })
})
