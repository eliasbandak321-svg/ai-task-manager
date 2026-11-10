import { describe, expect, it } from 'vitest'
import { makeTask } from '../test/factories'
import { daysUntilDue, getDeadlineStatus, isOverdue } from './deadlines'

const TODAY = '2026-03-10'

describe('getDeadlineStatus', () => {
  it.each([
    ['2026-03-09', 'overdue'],
    ['2026-01-01', 'overdue'],
    ['2026-03-10', 'due_today'],
    ['2026-03-11', 'due_soon'],
    ['2026-03-13', 'due_soon'], // 3 days ahead: last "soon" day
    ['2026-03-14', 'upcoming'],
  ] as const)('a task due %s is %s', (dueDate, expected) => {
    expect(getDeadlineStatus(makeTask({ dueDate }), TODAY)).toBe(expected)
  })

  it('is "none" without a deadline', () => {
    expect(getDeadlineStatus(makeTask({ dueDate: null }), TODAY)).toBe('none')
  })

  it('is "none" for done tasks, even past their deadline', () => {
    expect(getDeadlineStatus(makeTask({ status: 'done', dueDate: '2026-01-01' }), TODAY)).toBe('none')
  })

  it('treats In progress tasks like To do tasks', () => {
    expect(getDeadlineStatus(makeTask({ status: 'in_progress', dueDate: '2026-03-01' }), TODAY)).toBe('overdue')
  })
})

describe('isOverdue', () => {
  it('is true only for open tasks past their deadline', () => {
    expect(isOverdue(makeTask({ dueDate: '2026-03-09' }), TODAY)).toBe(true)
    expect(isOverdue(makeTask({ dueDate: TODAY }), TODAY)).toBe(false)
    expect(isOverdue(makeTask({ status: 'done', dueDate: '2026-03-09' }), TODAY)).toBe(false)
  })
})

describe('daysUntilDue', () => {
  it('counts calendar days, negative when overdue, null without a deadline', () => {
    expect(daysUntilDue(makeTask({ dueDate: '2026-03-15' }), TODAY)).toBe(5)
    expect(daysUntilDue(makeTask({ dueDate: '2026-03-08' }), TODAY)).toBe(-2)
    expect(daysUntilDue(makeTask({ dueDate: null }), TODAY)).toBeNull()
  })
})
