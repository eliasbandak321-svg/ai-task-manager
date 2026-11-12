import { describe, expect, it } from 'vitest'
import { clockToMinutes, formatMinutes, fromLocalInput, minutesToClock, toLocalInput } from './time'

describe('time helpers', () => {
  it('formats durations', () => {
    expect(formatMinutes(45)).toBe('45 min')
    expect(formatMinutes(120)).toBe('2 h')
    expect(formatMinutes(90)).toBe('1 h 30 min')
  })

  it('round-trips datetime-local values and rejects garbage', () => {
    const instant = fromLocalInput('2026-03-02T09:30')
    expect(instant).not.toBeNull()
    expect(toLocalInput(instant as string)).toBe('2026-03-02T09:30')
    expect(fromLocalInput('tomorrow')).toBeNull()
  })

  it('converts working-hour clocks', () => {
    expect(minutesToClock(545)).toBe('09:05')
    expect(clockToMinutes('17:30')).toBe(1050)
    expect(clockToMinutes('25:00')).toBeNull()
    expect(clockToMinutes('9:00')).toBeNull()
  })
})
