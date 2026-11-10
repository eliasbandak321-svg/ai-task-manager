import { describe, expect, it } from 'vitest'
import { addDays, daysBetween, isIsoDate, toIsoDate, toTimestamp } from './dates'

describe('isIsoDate', () => {
  it.each(['2026-01-31', '2024-02-29', '2026-12-01', '0050-06-15'])('accepts the real calendar date %s', (value) => {
    expect(isIsoDate(value)).toBe(true)
  })

  it.each(['2025-02-29', '2026-04-31', '2026-13-01', '2026-1-5', '26-01-01', '2026-01-01T00:00:00Z', ''])(
    'rejects %j',
    (value) => {
      expect(isIsoDate(value)).toBe(false)
    },
  )
})

describe('toIsoDate', () => {
  // 23:30 UTC on Jan 1st is already Jan 2nd in Tokyo and still Jan 1st in New York.
  const instant = new Date('2026-01-01T23:30:00Z')

  it('uses the calendar day in the given time zone', () => {
    expect(toIsoDate(instant, 'UTC')).toBe('2026-01-01')
    expect(toIsoDate(instant, 'Asia/Tokyo')).toBe('2026-01-02')
    expect(toIsoDate(instant, 'America/New_York')).toBe('2026-01-01')
  })

  it('zero-pads months and days', () => {
    expect(toIsoDate(new Date('2026-03-04T12:00:00Z'), 'UTC')).toBe('2026-03-04')
  })
})

describe('daysBetween', () => {
  it('counts whole calendar days, negative when going back', () => {
    expect(daysBetween('2026-01-01', '2026-01-01')).toBe(0)
    expect(daysBetween('2026-01-01', '2026-01-04')).toBe(3)
    expect(daysBetween('2026-01-04', '2026-01-01')).toBe(-3)
  })

  it('handles month ends, leap years and year boundaries', () => {
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2)
    expect(daysBetween('2025-02-28', '2025-03-01')).toBe(1)
    expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1)
  })

  it('is not affected by daylight saving changes', () => {
    // Europe switched clocks on 2026-03-29; calendar math must still say 1 day.
    expect(daysBetween('2026-03-28', '2026-03-29')).toBe(1)
    expect(daysBetween('2026-03-29', '2026-03-30')).toBe(1)
  })
})

describe('addDays', () => {
  it('moves forward and backward across months and years', () => {
    expect(addDays('2026-01-30', 3)).toBe('2026-02-02')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
  })
})

describe('toTimestamp', () => {
  it('serialises an instant as an ISO 8601 UTC string', () => {
    expect(toTimestamp(new Date(Date.UTC(2026, 0, 2, 3, 4, 5, 6)))).toBe('2026-01-02T03:04:05.006Z')
  })
})
