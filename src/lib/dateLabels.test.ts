import { describe, expect, it } from 'vitest'
import { toIsoDate } from '../domain/dates'
import { formatDayRange, formatWeekdayDate, workWeekOf } from './dateLabels'

describe('date labels', () => {
  it('always pairs the right weekday with the date', () => {
    expect(formatWeekdayDate('2026-11-20')).toBe('Friday, 20 November')
    expect(formatWeekdayDate('2026-11-21')).toBe('Saturday, 21 November')
    expect(formatWeekdayDate('2026-11-22')).toBe('Sunday, 22 November')
    expect(formatWeekdayDate('2026-11-17')).toBe('Tuesday, 17 November')
    expect(formatWeekdayDate('2028-02-29')).toBe('Tuesday, 29 February')
  })

  it('formats a week range, also across months', () => {
    expect(formatDayRange('2026-11-16', '2026-11-20')).toBe('16 – 20 November')
    expect(formatDayRange('2026-11-30', '2026-12-04')).toBe('30 November – 4 December')
  })

  it('gives Monday to Friday of the current week, marking today', () => {
    const wednesday = workWeekOf('2026-11-18')
    expect(wednesday.map((day) => `${day.short} ${day.day}`)).toEqual(['Mon 16', 'Tue 17', 'Wed 18', 'Thu 19', 'Fri 20'])
    expect(wednesday.filter((day) => day.isToday).map((day) => day.date)).toEqual(['2026-11-18'])
    // At the weekend the week shown is the one that just ended; no weekday is "today".
    const saturday = workWeekOf('2026-11-21')
    expect(saturday[0].date).toBe('2026-11-16')
    expect(saturday.some((day) => day.isToday)).toBe(false)
    expect(workWeekOf('2026-11-23')[0].date).toBe('2026-11-23')
  })

  it("uses the visitor's own time zone for today's date", () => {
    // 22:30 UTC on Friday 20 November is already Saturday in Auckland and still Friday in Los Angeles.
    const instant = new Date('2026-11-20T22:30:00Z')
    expect(formatWeekdayDate(toIsoDate(instant, 'Pacific/Auckland'))).toBe('Saturday, 21 November')
    expect(formatWeekdayDate(toIsoDate(instant, 'America/Los_Angeles'))).toBe('Friday, 20 November')
  })
})
