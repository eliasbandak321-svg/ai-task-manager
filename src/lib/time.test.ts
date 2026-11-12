import { describe, expect, it } from 'vitest'
import { clockToMinutes, formatClock, formatMinutes, formatSpan, fromLocalInput, minutesToClock, toLocalInput, zonedDate, zonedDayRange } from './time'

describe('time helpers', () => {
  it('formats durations', () => {
    expect(formatMinutes(45)).toBe('45 min')
    expect(formatMinutes(120)).toBe('2 h')
    expect(formatMinutes(90)).toBe('1 h 30 min')
  })

  it('reads and writes datetime-local values in the user’s time zone, whatever the device uses', () => {
    expect(fromLocalInput('2026-03-02T09:30', 'Europe/Berlin')).toBe('2026-03-02T08:30:00.000Z')
    expect(fromLocalInput('2026-03-02T09:30', 'America/New_York')).toBe('2026-03-02T14:30:00.000Z')
    expect(toLocalInput('2026-03-02T08:30:00.000Z', 'Europe/Berlin')).toBe('2026-03-02T09:30')
    expect(toLocalInput('2026-03-02T08:30:00.000Z', 'Asia/Tokyo')).toBe('2026-03-02T17:30')
    // Across the spring-forward gap in Berlin (02:00–03:00 doesn't exist on 2026-03-29).
    expect(fromLocalInput('2026-03-29T02:30', 'Europe/Berlin')).toBe('2026-03-29T01:30:00.000Z')
    expect(fromLocalInput('tomorrow', 'UTC')).toBeNull()
    expect(fromLocalInput('2026-02-30T10:00', 'UTC')).toBeNull()
  })

  it('formats instants and day ranges in the given zone', () => {
    expect(formatClock('2026-03-02T08:30:00.000Z', 'Europe/Berlin', 'en-GB')).toBe('09:30')
    expect(formatClock('2026-03-02T08:30:00.000Z', 'America/New_York', 'en-GB')).toBe('03:30')
    expect(formatSpan('2026-03-02T22:30:00.000Z', '2026-03-02T23:30:00.000Z', 'Europe/Berlin', 'en-GB')).toMatch(/23:30–00:30, Tue|Mon.*23:30.*Tue.*00:30/)
    expect(zonedDayRange('2026-03-29', '2026-03-29', 'Europe/Berlin')).toEqual({ from: '2026-03-28T23:00:00.000Z', to: '2026-03-29T22:00:00.000Z' })
    expect(zonedDate('2026-03-02T23:30:00.000Z', 'Europe/Berlin')).toBe('2026-03-03')
  })

  it('converts working-hour clocks', () => {
    expect(minutesToClock(545)).toBe('09:05')
    expect(clockToMinutes('17:30')).toBe(1050)
    expect(clockToMinutes('25:00')).toBeNull()
    expect(clockToMinutes('9:00')).toBeNull()
  })
})
