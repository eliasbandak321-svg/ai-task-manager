import { describe, expect, it } from 'vitest'
import type { Occurrence } from './calendar'
import { CALENDAR_CHUNK_DAYS, CALENDAR_RANGE_MAX_DAYS, mergeCalendarRanges, rangeDays, splitDateRange } from './calendarRanges'
import { zonedRange } from './calendar'

const occurrence = (eventId: string, start: string, end = start): Occurrence => ({ eventId, occurrenceStart: start, start, end, title: eventId, category: 'focus', taskId: null, isRecurring: false, seriesId: null, sessionStatus: 'planned' })

describe('splitDateRange', () => {
  it('keeps a short range in one chunk', () => {
    expect(splitDateRange('2026-11-14', '2026-11-20')).toEqual([{ from: '2026-11-14', to: '2026-11-20' }])
    expect(splitDateRange('2026-11-20', '2026-11-20')).toEqual([{ from: '2026-11-20', to: '2026-11-20' }])
  })

  it('splits 90 + 7 days into consecutive chunks without gaps or overlaps', () => {
    const chunks = splitDateRange('2026-08-24', '2026-11-28')
    expect(chunks).toEqual([
      { from: '2026-08-24', to: '2026-10-22' },
      { from: '2026-10-23', to: '2026-11-28' },
    ])
    expect(chunks.reduce((sum, chunk) => sum + rangeDays(chunk.from, chunk.to), 0)).toBe(rangeDays('2026-08-24', '2026-11-28'))
  })

  it('handles exact multiples and a whole year', () => {
    expect(splitDateRange('2026-01-01', '2026-03-01', 60)).toHaveLength(1) // exactly 60 days
    expect(splitDateRange('2026-01-01', '2026-03-02', 60)).toHaveLength(2) // 61 days
    const year = splitDateRange('2025-11-21', '2026-11-21')
    expect(year).toHaveLength(7)
    expect(year.at(-1)!.to).toBe('2026-11-21')
  })

  it('returns nothing for an inverted range', () => {
    expect(splitDateRange('2026-11-21', '2026-11-20')).toEqual([])
  })

  it('stays within the API limit even across a daylight-saving change', () => {
    // 2026-10-25: Europe/Berlin falls back, so this zoned range is 60 days + 1 hour long.
    for (const chunk of splitDateRange('2026-09-01', '2026-12-31')) {
      const { start, end } = zonedRange(chunk.from, chunk.to, 'Europe/Berlin')
      expect(end.getTime() - start.getTime()).toBeLessThanOrEqual(CALENDAR_RANGE_MAX_DAYS * 86_400_000)
    }
    expect(CALENDAR_CHUNK_DAYS).toBeLessThan(CALENDAR_RANGE_MAX_DAYS)
  })
})

describe('mergeCalendarRanges', () => {
  it('keeps an occurrence returned by two adjacent chunks once, and sorts by start', () => {
    const boundary = occurrence('night', '2026-10-22T22:30:00.000Z', '2026-10-23T00:30:00.000Z')
    const merged = mergeCalendarRanges([
      { events: [], occurrences: [occurrence('b', '2026-10-20T08:00:00.000Z'), boundary] },
      { events: [], occurrences: [boundary, occurrence('a', '2026-10-24T08:00:00.000Z')] },
    ])
    expect(merged.occurrences.map((item) => item.eventId)).toEqual(['b', 'night', 'a'])
  })

  it('keeps separate occurrences of one recurring event', () => {
    const merged = mergeCalendarRanges([
      { events: [], occurrences: [occurrence('weekly', '2026-10-19T08:00:00.000Z')] },
      { events: [], occurrences: [occurrence('weekly', '2026-10-26T08:00:00.000Z')] },
    ])
    expect(merged.occurrences).toHaveLength(2)
  })

  it('returns empty lists for no data', () => {
    expect(mergeCalendarRanges([])).toEqual({ events: [], occurrences: [] })
  })
})
