import { z } from 'zod'
import { RepositoryError } from '../data/errors'
import { daysUntilDue, getDeadlineStatus, isDomainError, type DeadlineStatus, type IsoDate, type Task } from '../domain'

/*
  Presentation helpers: turn domain values into text for people. Kept out of components so
  they can be unit-tested, and out of src/domain because wording is a UI concern.
*/

/**
 * "Mar 14", or "Jan 2, 2027" outside the current year. `locale` defaults to the browser's.
 * The date is formatted *as UTC*, because an IsoDate has no time zone: formatting it in the
 * local zone would show the previous day for users west of UTC.
 */
export function formatIsoDate(date: IsoDate, today: IsoDate, locale?: string): string {
  const sameYear = date.slice(0, 4) === today.slice(0, 4)
  return new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    year: sameYear ? undefined : 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))
}

export const pluralize = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

export interface DueLabel {
  text: string
  /** Drives the colour; the text always carries the meaning too. */
  status: DeadlineStatus
}

/** A short deadline label such as "Due tomorrow" or "Overdue by 2 days"; null without a deadline. */
export function dueLabel(task: Pick<Task, 'dueDate' | 'status'>, today: IsoDate, locale?: string): DueLabel | null {
  if (task.dueDate === null) return null
  const status = getDeadlineStatus(task, today)
  const days = daysUntilDue(task, today) ?? 0

  switch (status) {
    case 'overdue':
      return { text: `Overdue by ${pluralize(-days, 'day')}`, status }
    case 'due_today':
      return { text: 'Due today', status }
    case 'due_soon':
      return { text: days === 1 ? 'Due tomorrow' : `Due in ${pluralize(days, 'day')}`, status }
    default:
      return { text: `Due ${formatIsoDate(task.dueDate, today, locale)}`, status }
  }
}

const GENERIC_ERROR = 'Something went wrong. Please try again.'

/**
 * A message that is safe and useful to show. Rule violations and storage problems are already
 * worded for people; anything unexpected gets a generic message, never a stack trace.
 */
export function errorMessage(error: unknown): string {
  if (isDomainError(error) || error instanceof RepositoryError) return error.message
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? GENERIC_ERROR
  return GENERIC_ERROR
}

/** The first message per top-level field, for showing next to form inputs. */
export function fieldErrors(error: z.ZodError): Partial<Record<string, string>> {
  const result: Partial<Record<string, string>> = {}
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? '')
    result[field] ??= issue.message
  }
  return result
}
