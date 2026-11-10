import { describe, expect, it } from 'vitest'
import { countActiveFilters, DEFAULT_FILTERS, parseTaskFilters, toSearchParams } from './taskFilters'

describe('parseTaskFilters', () => {
  it('uses the defaults for an empty URL', () => {
    expect(parseTaskFilters(new URLSearchParams())).toEqual(DEFAULT_FILTERS)
  })

  it('reads every filter from the URL', () => {
    const params = new URLSearchParams('q=report&status=todo&status=done&priority=high&due=overdue&sort=title&dir=desc')
    expect(parseTaskFilters(params)).toEqual({
      search: 'report',
      statuses: ['todo', 'done'],
      priorities: ['high'],
      deadline: 'overdue',
      sortBy: 'title',
      sortDirection: 'desc',
    })
  })

  it('ignores invalid or repeated values instead of failing, since anyone can edit a URL', () => {
    const params = new URLSearchParams(
      `q=${'x'.repeat(500)}&status=nope&status=todo&status=todo&priority=urgent&due=yesterday&sort=random&dir=up`,
    )
    expect(parseTaskFilters(params)).toEqual({ ...DEFAULT_FILTERS, statuses: ['todo'] })
  })

  it('keeps the search exactly as typed, including spaces between words', () => {
    expect(parseTaskFilters(new URLSearchParams('q=buy+')).search).toBe('buy ')
  })
})

describe('toSearchParams', () => {
  it('omits defaults, so a clean view has a clean URL', () => {
    expect(toSearchParams(DEFAULT_FILTERS).toString()).toBe('')
  })

  it('round-trips through parseTaskFilters', () => {
    const filters = {
      search: 'café',
      statuses: ['in_progress' as const],
      priorities: ['low' as const, 'high' as const],
      deadline: 'due_soon' as const,
      sortBy: 'priority' as const,
      sortDirection: 'desc' as const,
    }
    expect(parseTaskFilters(toSearchParams(filters))).toEqual(filters)
  })
})

describe('countActiveFilters', () => {
  it('counts search and filters, but not sorting', () => {
    expect(countActiveFilters(DEFAULT_FILTERS)).toBe(0)
    expect(countActiveFilters({ ...DEFAULT_FILTERS, search: '   ' })).toBe(0)
    expect(
      countActiveFilters({ ...DEFAULT_FILTERS, search: 'a', statuses: ['todo', 'done'], deadline: 'no_date', sortBy: 'title' }),
    ).toBe(4)
  })
})
