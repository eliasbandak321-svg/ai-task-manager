import { z } from 'zod'
import { LIMITS, taskPrioritySchema, taskQuerySchema, taskStatusSchema, type TaskQuery } from '../domain'

/*
  The dashboard keeps search, filters and sorting in the URL (?q=…&status=todo&sort=title),
  so a filtered view survives a reload, can be bookmarked, and works with Back and Forward.
  The project comes from the route path (/app/projects/:id), not from these parameters.

  URLs are user input, so each value is validated with the domain's taskQuerySchema.
  An invalid value falls back to its default instead of breaking the page.
*/

export type TaskFilters = Omit<TaskQuery, 'projectId'>

const shape = taskQuerySchema.shape

/*
  Search is kept exactly as typed (no trimming): the URL is the search box's state, and
  trimming would delete the space while someone types "buy milk". Matching ignores
  surrounding whitespace anyway (matchesSearch splits the query into words).
*/
const rawSearchSchema = z.string().max(LIMITS.searchQuery)

export const DEFAULT_FILTERS: TaskFilters = taskQuerySchema.omit({ projectId: true }).parse({})

const PARAM = {
  search: 'q',
  statuses: 'status',
  priorities: 'priority',
  deadline: 'due',
  sortBy: 'sort',
  sortDirection: 'dir',
} as const

/** The parsed value, or `fallback` when the value is missing or invalid. */
function parseOr<T>(value: string | null, schema: z.ZodType<T>, fallback: T): T {
  if (value === null) return fallback
  const result = schema.safeParse(value)
  return result.success ? result.data : fallback
}

/** The valid, distinct values of a repeated parameter (e.g. ?status=todo&status=done). */
function parseList<T>(values: string[], schema: z.ZodType<T>): T[] {
  const valid = values.flatMap((value) => {
    const result = schema.safeParse(value)
    return result.success ? [result.data] : []
  })
  return [...new Set(valid)]
}

export function parseTaskFilters(params: URLSearchParams): TaskFilters {
  return {
    search: parseOr(params.get(PARAM.search), rawSearchSchema, DEFAULT_FILTERS.search),
    statuses: parseList(params.getAll(PARAM.statuses), taskStatusSchema),
    priorities: parseList(params.getAll(PARAM.priorities), taskPrioritySchema),
    deadline: parseOr(params.get(PARAM.deadline), shape.deadline, DEFAULT_FILTERS.deadline),
    sortBy: parseOr(params.get(PARAM.sortBy), shape.sortBy, DEFAULT_FILTERS.sortBy),
    sortDirection: parseOr(params.get(PARAM.sortDirection), shape.sortDirection, DEFAULT_FILTERS.sortDirection),
  }
}

/** The URL parameters for `filters`, leaving out every value that equals its default. */
export function toSearchParams(filters: TaskFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.search !== '') params.set(PARAM.search, filters.search)
  for (const status of filters.statuses) params.append(PARAM.statuses, status)
  for (const priority of filters.priorities) params.append(PARAM.priorities, priority)
  if (filters.deadline !== DEFAULT_FILTERS.deadline) params.set(PARAM.deadline, filters.deadline)
  if (filters.sortBy !== DEFAULT_FILTERS.sortBy) params.set(PARAM.sortBy, filters.sortBy)
  if (filters.sortDirection !== DEFAULT_FILTERS.sortDirection) params.set(PARAM.sortDirection, filters.sortDirection)
  return params
}

/** How many filters narrow the list (sorting doesn't count: it hides nothing). */
export function countActiveFilters(filters: TaskFilters): number {
  return (
    (filters.search.trim() === '' ? 0 : 1) +
    filters.statuses.length +
    filters.priorities.length +
    (filters.deadline === 'any' ? 0 : 1)
  )
}
