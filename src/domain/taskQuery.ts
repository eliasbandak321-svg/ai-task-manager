import { z } from 'zod'
import { LIMITS, TASK_PRIORITIES, TASK_STATUSES } from './constants'
import type { IsoDate } from './dates'
import { getDeadlineStatus } from './deadlines'
import { idSchema, taskPrioritySchema, taskStatusSchema, type Task, type TaskPriority, type TaskStatus } from './schemas'

/*
  Search, filter and sort as one validated "query" object. The same object will become
  URL search params in the dashboard (M5) and API query params (M6), so it is a Zod schema:
  anything a user types into a URL is validated before use.
*/

export const TASK_SORT_FIELDS = ['due_date', 'priority', 'status', 'title', 'created_at', 'updated_at'] as const
export const DEADLINE_FILTERS = ['any', 'overdue', 'due_today', 'due_soon', 'no_date'] as const

export const taskQuerySchema = z.object({
  search: z.string().trim().max(LIMITS.searchQuery).default(''),
  projectId: idSchema.nullable().default(null), // null: all projects
  statuses: z.array(taskStatusSchema).default([]), // empty: all statuses
  priorities: z.array(taskPrioritySchema).default([]), // empty: all priorities
  deadline: z.enum(DEADLINE_FILTERS).default('any'),
  sortBy: z.enum(TASK_SORT_FIELDS).default('due_date'),
  sortDirection: z.enum(['asc', 'desc']).default('asc'),
})

export type TaskQuery = z.output<typeof taskQuerySchema>
export type TaskSortField = TaskQuery['sortBy']
export type SortDirection = TaskQuery['sortDirection']

// ---------- Search ----------

/** Lowercase and strip accents, so "Café" matches "cafe" (and vice versa). */
function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

/** Every word of the query must appear in the title or the description (in any order). */
export function matchesSearch(task: Pick<Task, 'title' | 'description'>, search: string): boolean {
  const terms = normalizeText(search).split(/\s+/).filter(Boolean)
  if (terms.length === 0) return true
  const haystack = normalizeText(`${task.title}\n${task.description}`)
  return terms.every((term) => haystack.includes(term))
}

// ---------- Filter ----------

export function filterTasks(tasks: readonly Task[], query: TaskQuery, today: IsoDate): Task[] {
  const statuses = new Set(query.statuses)
  const priorities = new Set(query.priorities)

  return tasks.filter((task) => {
    if (query.projectId !== null && task.projectId !== query.projectId) return false
    if (statuses.size > 0 && !statuses.has(task.status)) return false
    if (priorities.size > 0 && !priorities.has(task.priority)) return false
    if (!matchesDeadlineFilter(task, query.deadline, today)) return false
    return matchesSearch(task, query.search)
  })
}

function matchesDeadlineFilter(task: Task, filter: TaskQuery['deadline'], today: IsoDate): boolean {
  if (filter === 'any') return true
  if (filter === 'no_date') return task.dueDate === null
  return getDeadlineStatus(task, today) === filter
}

// ---------- Sort ----------

// Ranks follow workflow and importance order, not the alphabet ("high" < "low" alphabetically).
const PRIORITY_RANK = Object.fromEntries(TASK_PRIORITIES.map((p, i) => [p, i])) as Record<TaskPriority, number>
const STATUS_RANK = Object.fromEntries(TASK_STATUSES.map((s, i) => [s, i])) as Record<TaskStatus, number>
const titleCollator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })

const compareBy: Record<Exclude<TaskSortField, 'due_date'>, (a: Task, b: Task) => number> = {
  priority: (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
  status: (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status],
  title: (a, b) => titleCollator.compare(a.title, b.title),
  // ISO timestamps sort correctly as plain strings.
  created_at: (a, b) => a.createdAt.localeCompare(b.createdAt),
  updated_at: (a, b) => a.updatedAt.localeCompare(b.updatedAt),
}

/** Oldest first, then by id: a deterministic tie-breaker independent of the sort direction. */
function tieBreak(a: Task, b: Task): number {
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)
}

/**
 * Returns a new sorted array. Tasks without a deadline always go last when sorting by
 * deadline (in both directions), because "no deadline" isn't earlier or later than a date.
 */
export function sortTasks(tasks: readonly Task[], sortBy: TaskSortField, direction: SortDirection): Task[] {
  const sign = direction === 'asc' ? 1 : -1

  return [...tasks].sort((a, b) => {
    let primary: number
    if (sortBy === 'due_date') {
      if (a.dueDate === null || b.dueDate === null) {
        if (a.dueDate !== b.dueDate) return a.dueDate === null ? 1 : -1
        primary = 0
      } else {
        primary = sign * a.dueDate.localeCompare(b.dueDate)
      }
    } else {
      primary = sign * compareBy[sortBy](a, b)
    }
    return primary || tieBreak(a, b)
  })
}

/** The full pipeline used by the dashboard: filter, then sort. */
export function queryTasks(tasks: readonly Task[], query: TaskQuery, today: IsoDate): Task[] {
  return sortTasks(filterTasks(tasks, query, today), query.sortBy, query.sortDirection)
}
