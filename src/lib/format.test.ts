import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { RepositoryError } from '../data/errors'
import { StorageError } from '../data/localRepository'
import { DomainError } from '../domain'
import { dueLabel, errorMessage, fieldErrors, formatIsoDate } from './format'

const TODAY = '2026-03-10'

describe('formatIsoDate', () => {
  it('formats a calendar date without shifting it by the time zone', () => {
    expect(formatIsoDate('2026-03-14', TODAY, 'en-US')).toBe('Mar 14')
  })

  it('adds the year when it differs from the current one', () => {
    expect(formatIsoDate('2027-01-02', TODAY, 'en-US')).toBe('Jan 2, 2027')
  })
})

describe('dueLabel', () => {
  const at = (dueDate: string | null, status: 'todo' | 'done' = 'todo') => dueLabel({ dueDate, status }, TODAY, 'en-US')

  it.each([
    ['2026-03-07', 'Overdue by 3 days', 'overdue'],
    ['2026-03-09', 'Overdue by 1 day', 'overdue'],
    [TODAY, 'Due today', 'due_today'],
    ['2026-03-11', 'Due tomorrow', 'due_soon'],
    ['2026-03-13', 'Due in 3 days', 'due_soon'],
    ['2026-03-20', 'Due Mar 20', 'upcoming'],
  ])('%s → %s', (dueDate, text, status) => {
    expect(at(dueDate)).toEqual({ text, status })
  })

  it('is empty without a deadline, and neutral once the task is done', () => {
    expect(at(null)).toBeNull()
    expect(at('2026-03-01', 'done')).toEqual({ text: 'Due Mar 1', status: 'none' })
  })
})

describe('errorMessage', () => {
  it('shows rule violations and storage problems as they are worded', () => {
    expect(errorMessage(new DomainError('DUPLICATE_PROJECT_NAME', 'You already have a project called "A"'))).toBe(
      'You already have a project called "A"',
    )
    expect(errorMessage(new StorageError('Storage is full.'))).toBe('Storage is full.')
    expect(errorMessage(new RepositoryError("Couldn't reach the server."))).toBe("Couldn't reach the server.")
  })

  it('shows the first validation problem', () => {
    const result = z.object({ name: z.string().min(1, 'Name is required') }).safeParse({ name: '' })
    expect(errorMessage(result.error)).toBe('Name is required')
  })

  it('never shows raw technical errors', () => {
    expect(errorMessage(new TypeError('x is undefined'))).toBe('Something went wrong. Please try again.')
    expect(errorMessage('boom')).toBe('Something went wrong. Please try again.')
  })
})

describe('fieldErrors', () => {
  it('maps each invalid field to its first message', () => {
    const schema = z.object({ title: z.string().min(1, 'Title is required'), due: z.iso.date('Enter a valid date') })
    const result = schema.safeParse({ title: '', due: 'soon' })
    expect(fieldErrors(result.error as z.ZodError)).toEqual({ title: 'Title is required', due: 'Enter a valid date' })
  })
})
