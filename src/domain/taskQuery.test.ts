import { describe, expect, it } from 'vitest'
import { makeTask, nextId } from '../test/factories'
import type { Task } from './schemas'
import { filterTasks, matchesSearch, queryTasks, sortTasks, taskQuerySchema } from './taskQuery'

const TODAY = '2026-03-10'
const titles = (tasks: Task[]) => tasks.map((task) => task.title)

describe('taskQuerySchema', () => {
  it('fills in defaults: everything, sorted by deadline', () => {
    expect(taskQuerySchema.parse({})).toEqual({
      search: '',
      projectId: null,
      statuses: [],
      priorities: [],
      deadline: 'any',
      sortBy: 'due_date',
      sortDirection: 'asc',
    })
  })

  it('rejects unknown sort fields and over-long searches', () => {
    expect(taskQuerySchema.safeParse({ sortBy: 'random' }).success).toBe(false)
    expect(taskQuerySchema.safeParse({ search: 'x'.repeat(201) }).success).toBe(false)
  })
})

describe('matchesSearch', () => {
  const task = makeTask({ title: 'Prepare Café presentation', description: 'Slides for the Q3 review' })

  it('matches the title or description, case-insensitively', () => {
    expect(matchesSearch(task, 'prepare')).toBe(true)
    expect(matchesSearch(task, 'SLIDES')).toBe(true)
  })

  it('ignores accents in both the text and the query', () => {
    expect(matchesSearch(task, 'cafe')).toBe(true)
    expect(matchesSearch(makeTask({ title: 'Cafe menu' }), 'café')).toBe(true)
  })

  it('requires every word to match, in any order', () => {
    expect(matchesSearch(task, 'review presentation')).toBe(true)
    expect(matchesSearch(task, 'review budget')).toBe(false)
  })

  it('matches everything for an empty or blank query', () => {
    expect(matchesSearch(task, '')).toBe(true)
    expect(matchesSearch(task, '   ')).toBe(true)
  })
})

describe('filterTasks', () => {
  const projectId = nextId()
  const tasks = [
    makeTask({ title: 'A', projectId, status: 'todo', priority: 'high', dueDate: '2026-03-01' }),
    makeTask({ title: 'B', projectId, status: 'in_progress', priority: 'low', dueDate: TODAY }),
    makeTask({ title: 'C', status: 'done', priority: 'high', dueDate: null }),
    makeTask({ title: 'D', status: 'todo', priority: 'medium', dueDate: '2026-03-12' }),
  ]
  const filter = (input: Parameters<typeof taskQuerySchema.parse>[0]) =>
    titles(filterTasks(tasks, taskQuerySchema.parse(input), TODAY))

  it('returns everything with the default query', () => {
    expect(filter({})).toEqual(['A', 'B', 'C', 'D'])
  })

  it('filters by project', () => {
    expect(filter({ projectId })).toEqual(['A', 'B'])
  })

  it('filters by several statuses or priorities at once', () => {
    expect(filter({ statuses: ['todo', 'done'] })).toEqual(['A', 'C', 'D'])
    expect(filter({ priorities: ['high'] })).toEqual(['A', 'C'])
  })

  it('filters by deadline state', () => {
    expect(filter({ deadline: 'overdue' })).toEqual(['A'])
    expect(filter({ deadline: 'due_today' })).toEqual(['B'])
    expect(filter({ deadline: 'due_soon' })).toEqual(['D'])
    expect(filter({ deadline: 'no_date' })).toEqual(['C'])
  })

  it('combines all filters (AND)', () => {
    expect(filter({ projectId, priorities: ['high'], search: 'a' })).toEqual(['A'])
  })
})

describe('sortTasks', () => {
  it('sorts by deadline with tasks without a deadline last, in both directions', () => {
    const tasks = [
      makeTask({ title: 'none', dueDate: null }),
      makeTask({ title: 'late', dueDate: '2026-05-01' }),
      makeTask({ title: 'early', dueDate: '2026-04-01' }),
    ]
    expect(titles(sortTasks(tasks, 'due_date', 'asc'))).toEqual(['early', 'late', 'none'])
    expect(titles(sortTasks(tasks, 'due_date', 'desc'))).toEqual(['late', 'early', 'none'])
  })

  it('orders tasks without a deadline among themselves by creation time', () => {
    const later = makeTask({ title: 'later', dueDate: null, createdAt: '2026-01-02T00:00:00.000Z' })
    const earlier = makeTask({ title: 'earlier', dueDate: null, createdAt: '2026-01-01T00:00:00.000Z' })
    expect(titles(sortTasks([later, earlier], 'due_date', 'desc'))).toEqual(['earlier', 'later'])
  })

  it('sorts by priority rank, not alphabetically', () => {
    const tasks = [
      makeTask({ title: 'm', priority: 'medium' }),
      makeTask({ title: 'h', priority: 'high' }),
      makeTask({ title: 'l', priority: 'low' }),
    ]
    expect(titles(sortTasks(tasks, 'priority', 'desc'))).toEqual(['h', 'm', 'l'])
    expect(titles(sortTasks(tasks, 'priority', 'asc'))).toEqual(['l', 'm', 'h'])
  })

  it('sorts by status in workflow order', () => {
    const tasks = [
      makeTask({ title: 'done', status: 'done' }),
      makeTask({ title: 'todo', status: 'todo' }),
      makeTask({ title: 'doing', status: 'in_progress' }),
    ]
    expect(titles(sortTasks(tasks, 'status', 'asc'))).toEqual(['todo', 'doing', 'done'])
  })

  it('sorts titles naturally and case-insensitively', () => {
    const tasks = [makeTask({ title: 'step 10' }), makeTask({ title: 'Step 2' }), makeTask({ title: 'apple' })]
    expect(titles(sortTasks(tasks, 'title', 'asc'))).toEqual(['apple', 'Step 2', 'step 10'])
  })

  it('sorts by creation and update time', () => {
    const older = makeTask({ title: 'older', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-02-02T00:00:00.000Z' })
    const newer = makeTask({ title: 'newer', createdAt: '2026-01-02T00:00:00.000Z', updatedAt: '2026-02-01T00:00:00.000Z' })
    expect(titles(sortTasks([newer, older], 'created_at', 'asc'))).toEqual(['older', 'newer'])
    expect(titles(sortTasks([newer, older], 'updated_at', 'desc'))).toEqual(['older', 'newer'])
  })

  it('breaks ties by creation time, so the order is stable and predictable', () => {
    const first = makeTask({ title: 'first', priority: 'high', createdAt: '2026-01-01T00:00:00.000Z' })
    const second = makeTask({ title: 'second', priority: 'high', createdAt: '2026-01-02T00:00:00.000Z' })
    expect(titles(sortTasks([second, first], 'priority', 'desc'))).toEqual(['first', 'second'])
    expect(titles(sortTasks([second, first], 'priority', 'asc'))).toEqual(['first', 'second'])
  })

  it('does not mutate its input', () => {
    const tasks = [makeTask({ title: 'b' }), makeTask({ title: 'a' })]
    sortTasks(tasks, 'title', 'asc')
    expect(titles(tasks)).toEqual(['b', 'a'])
  })
})

describe('queryTasks', () => {
  it('filters, then sorts', () => {
    const tasks = [
      makeTask({ title: 'Write draft', priority: 'low' }),
      makeTask({ title: 'Write outline', priority: 'high' }),
      makeTask({ title: 'Read paper', priority: 'high' }),
    ]
    const query = taskQuerySchema.parse({ search: 'write', sortBy: 'priority', sortDirection: 'desc' })
    expect(titles(queryTasks(tasks, query, TODAY))).toEqual(['Write outline', 'Write draft'])
  })
})
