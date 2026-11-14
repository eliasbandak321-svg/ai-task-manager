import { describe, expect, it } from 'vitest'
import { eachDate, isValidTimeZone, minutesBetween, weekdayOfDate, zonedParts, zonedToUtc } from './zonedTime'

const iso = (date: Date) => date.toISOString()

describe('zonedToUtc', () => {
  it('converts local wall-clock time to UTC on both sides of UTC', () => {
    expect(iso(zonedToUtc('2026-03-10', 9 * 60, 'Europe/Berlin'))).toBe('2026-03-10T08:00:00.000Z') // UTC+1
    expect(iso(zonedToUtc('2026-07-10', 9 * 60, 'Europe/Berlin'))).toBe('2026-07-10T07:00:00.000Z') // UTC+2
    expect(iso(zonedToUtc('2026-03-10', 9 * 60, 'America/New_York'))).toBe('2026-03-10T13:00:00.000Z') // UTC-4 (DST)
    expect(iso(zonedToUtc('2026-03-10', 9 * 60 + 30, 'Asia/Kolkata'))).toBe('2026-03-10T04:00:00.000Z') // UTC+5:30
    expect(iso(zonedToUtc('2026-03-10', 0, 'UTC'))).toBe('2026-03-10T00:00:00.000Z')
  })

  it('moves a time that doesn’t exist (spring forward) past the gap', () => {
    // Berlin 2026-03-29: 02:00 → 03:00. 02:30 local doesn't exist; it becomes 03:30 (01:30Z).
    const instant = zonedToUtc('2026-03-29', 2 * 60 + 30, 'Europe/Berlin')
    expect(iso(instant)).toBe('2026-03-29T01:30:00.000Z')
    expect(zonedParts(instant, 'Europe/Berlin').minutes).toBe(3 * 60 + 30)
  })

  it('picks the earlier instant for a time that exists twice (fall back)', () => {
    // Berlin 2026-10-25: 03:00 → 02:00. 02:30 happens at 00:30Z and again at 01:30Z.
    expect(iso(zonedToUtc('2026-10-25', 2 * 60 + 30, 'Europe/Berlin'))).toBe('2026-10-25T00:30:00.000Z')
  })

  it('keeps local times stable across a DST change (the same 09:00 every day)', () => {
    const before = zonedToUtc('2026-03-28', 9 * 60, 'Europe/Berlin')
    const after = zonedToUtc('2026-03-30', 9 * 60, 'Europe/Berlin')
    expect(zonedParts(before, 'Europe/Berlin').minutes).toBe(540)
    expect(zonedParts(after, 'Europe/Berlin').minutes).toBe(540)
    expect(minutesBetween(before, after)).toBe(2 * 24 * 60 - 60) // one hour shorter
  })
})

describe('zonedParts', () => {
  it('reads the local date, minutes and weekday', () => {
    // 2026-03-10T23:30Z is already Wednesday the 11th in Berlin.
    expect(zonedParts(new Date('2026-03-10T23:30:00Z'), 'Europe/Berlin')).toEqual({
      date: '2026-03-11',
      minutes: 30,
      weekday: 3,
    })
  })
})

describe('helpers', () => {
  it('validates time zones, lists dates and finds weekdays', () => {
    expect(isValidTimeZone('Europe/Berlin')).toBe(true)
    expect(isValidTimeZone('Mars/Olympus')).toBe(false)
    expect(eachDate('2026-02-27', '2026-03-02')).toEqual(['2026-02-27', '2026-02-28', '2026-03-01', '2026-03-02'])
    expect(weekdayOfDate('2026-03-10')).toBe(2) // Tuesday
  })
})
