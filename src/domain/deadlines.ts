import { DUE_SOON_DAYS } from './constants'
import { daysBetween, type IsoDate } from './dates'
import type { Task } from './schemas'

/**
 * How urgent a task's deadline is, relative to the user's "today".
 * - `none`: no deadline, or the task is done (a finished task is never overdue)
 * - `overdue`: the deadline was before today
 * - `due_today`
 * - `due_soon`: within the next DUE_SOON_DAYS days (1–3)
 * - `upcoming`: later than that
 */
export type DeadlineStatus = 'none' | 'overdue' | 'due_today' | 'due_soon' | 'upcoming'

type DeadlineFields = Pick<Task, 'dueDate' | 'status'>

/**
 * `today` is the user's local calendar date (see toIsoDate), passed in rather than read from
 * the clock, so the function is pure and tests can pin any date.
 */
export function getDeadlineStatus(task: DeadlineFields, today: IsoDate): DeadlineStatus {
  if (task.dueDate === null || task.status === 'done') return 'none'
  const days = daysBetween(today, task.dueDate)
  if (days < 0) return 'overdue'
  if (days === 0) return 'due_today'
  if (days <= DUE_SOON_DAYS) return 'due_soon'
  return 'upcoming'
}

export function isOverdue(task: DeadlineFields, today: IsoDate): boolean {
  return getDeadlineStatus(task, today) === 'overdue'
}

/** Calendar days until the deadline (negative when past), or null without one. */
export function daysUntilDue(task: Pick<Task, 'dueDate'>, today: IsoDate): number | null {
  return task.dueDate === null ? null : daysBetween(today, task.dueDate)
}
