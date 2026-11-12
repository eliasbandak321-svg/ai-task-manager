import { describe, expect, it } from 'vitest'
import { defaultPreferences, freeSlots, preferencesSchema, scheduleTasks, type Preferences, type SchedulableTask } from './scheduling'
import { zonedParts, zonedToUtc } from './zonedTime'

const TZ = 'Europe/Berlin'
// Monday 2026-03-02, 07:00 Berlin: before the working day starts.
const NOW = zonedToUtc('2026-03-02', 7 * 60, TZ)
const prefs: Preferences = { ...defaultPreferences(TZ), focusPeriod: 'none', breakMinutes: 0 }

function task(overrides: Partial<SchedulableTask> = {}): SchedulableTask {
  return {
    id: overrides.id ?? 'task',
    title: 'Task',
    priority: 'medium',
    dueDate: null,
    createdAt: '2026-03-01T00:00:00.000Z',
    estimatedMinutes: 60,
    scheduledMinutes: 0,
    ...overrides,
  }
}

const local = (date: Date) => {
  const parts = zonedParts(date, TZ)
  return `${parts.date} ${String(Math.floor(parts.minutes / 60)).padStart(2, '0')}:${String(parts.minutes % 60).padStart(2, '0')}`
}
const sessionsOf = (result: ReturnType<typeof scheduleTasks>) =>
  result.sessions.map((session) => `${session.taskId} ${local(session.start)}-${local(session.end).slice(11)}`)

describe('freeSlots', () => {
  it('uses working hours on working days, after now, minus commitments', () => {
    const busy = [{ start: zonedToUtc('2026-03-02', 10 * 60, TZ), end: zonedToUtc('2026-03-02', 12 * 60, TZ), category: 'meeting' as const }]
    const slots = freeSlots(prefs, busy, '2026-03-02', '2026-03-08', NOW)
    expect(slots.map((slot) => `${local(slot.start)}-${local(slot.end).slice(11)}`)).toEqual([
      '2026-03-02 09:00-10:00',
      '2026-03-02 12:00-17:00',
      '2026-03-03 09:00-17:00',
      '2026-03-04 09:00-17:00',
      '2026-03-05 09:00-17:00',
      '2026-03-06 09:00-17:00', // Saturday and Sunday aren't working days
    ])
  })
})

describe('scheduleTasks', () => {
  it('places sessions earliest-deadline first, then by priority', () => {
    const result = scheduleTasks({
      tasks: [
        task({ id: 'later', dueDate: '2026-03-06', priority: 'high' }),
        task({ id: 'sooner', dueDate: '2026-03-03', priority: 'low' }),
        task({ id: 'nodate', priority: 'high' }),
      ],
      busy: [],
      prefs,
      from: '2026-03-02',
      to: '2026-03-06',
      now: NOW,
    })
    expect(sessionsOf(result)).toEqual([
      'sooner 2026-03-02 09:00-10:00',
      'later 2026-03-02 10:00-11:00',
      'nodate 2026-03-02 11:00-12:00',
    ])
    expect(result.unscheduled).toEqual([])
  })

  it('splits big tasks into sessions, keeps breaks and the daily maximum', () => {
    const result = scheduleTasks({
      tasks: [task({ id: 'essay', estimatedMinutes: 300 })],
      busy: [],
      prefs: { ...prefs, sessionMinutes: 90, breakMinutes: 15, maxDailyMinutes: 180 },
      from: '2026-03-02',
      to: '2026-03-06',
      now: NOW,
    })
    expect(sessionsOf(result)).toEqual([
      'essay 2026-03-02 09:00-10:30',
      'essay 2026-03-02 10:45-12:15', // after a 15-minute break; 180 min reached
      'essay 2026-03-03 09:00-10:30',
      'essay 2026-03-03 10:45-11:15',
    ])
  })

  it('counts existing work events towards the daily maximum and works around meetings', () => {
    const busy = [
      { start: zonedToUtc('2026-03-02', 9 * 60, TZ), end: zonedToUtc('2026-03-02', 11 * 60, TZ), category: 'focus' as const },
      { start: zonedToUtc('2026-03-02', 11 * 60, TZ), end: zonedToUtc('2026-03-02', 12 * 60, TZ), category: 'meeting' as const },
    ]
    const result = scheduleTasks({
      tasks: [task({ id: 'a', estimatedMinutes: 120 })],
      busy,
      prefs: { ...prefs, maxDailyMinutes: 180, sessionMinutes: 120 },
      from: '2026-03-02',
      to: '2026-03-03',
      now: NOW,
    })
    // Monday: 120 min of focus already booked, so only 60 more; the meeting is avoided.
    expect(sessionsOf(result)).toEqual(['a 2026-03-02 12:00-13:00', 'a 2026-03-03 09:00-10:00'])
  })

  it('prefers the focus period within a day', () => {
    const result = scheduleTasks({
      tasks: [task({ id: 'deep' })],
      busy: [],
      prefs: { ...prefs, focusPeriod: 'afternoon' },
      from: '2026-03-02',
      to: '2026-03-02',
      now: NOW,
    })
    expect(sessionsOf(result)).toEqual(['deep 2026-03-02 12:00-13:00'])
  })

  it('never overbooks: reports what doesn’t fit before the deadline, and why', () => {
    const result = scheduleTasks({
      tasks: [
        task({ id: 'exam', estimatedMinutes: 600, dueDate: '2026-03-02' }),
        task({ id: 'late', dueDate: '2026-02-27' }),
      ],
      busy: [],
      prefs,
      from: '2026-03-02',
      to: '2026-03-06',
      now: NOW,
    })
    const scheduled = result.sessions.reduce((sum, session) => sum + (session.end.getTime() - session.start.getTime()) / 60_000, 0)
    expect(scheduled).toBe(360) // the daily maximum on the due date
    expect(result.unscheduled).toEqual([
      { taskId: 'late', reason: 'deadline_passed', missingMinutes: 60 },
      { taskId: 'exam', reason: 'not_enough_time', missingMinutes: 240 },
    ])
    expect(result.freeMinutes).toBe(5 * 8 * 60)
  })

  it('subtracts work that is already scheduled, and flags missing estimates', () => {
    const result = scheduleTasks({
      tasks: [task({ id: 'half', estimatedMinutes: 120, scheduledMinutes: 90 }), task({ id: 'unknown', estimatedMinutes: null })],
      busy: [],
      prefs,
      from: '2026-03-02',
      to: '2026-03-02',
      now: NOW,
    })
    expect(sessionsOf(result)).toEqual(['half 2026-03-02 09:00-09:30', 'unknown 2026-03-02 09:30-10:30'])
    expect(result.assumedEstimates).toEqual(['unknown'])
  })

  it('never schedules in the past', () => {
    const midday = zonedToUtc('2026-03-02', 13 * 60 + 7, TZ)
    const result = scheduleTasks({ tasks: [task()], busy: [], prefs, from: '2026-02-20', to: '2026-03-02', now: midday })
    expect(sessionsOf(result)).toEqual(['task 2026-03-02 13:07-14:07'])
  })
})

describe('preferencesSchema', () => {
  it('validates working hours and days', () => {
    expect(preferencesSchema.safeParse(prefs).success).toBe(true)
    expect(preferencesSchema.safeParse({ ...prefs, workDays: [] }).success).toBe(false)
    expect(preferencesSchema.safeParse({ ...prefs, dayStartMinutes: 600, dayEndMinutes: 610 }).success).toBe(false)
    expect(preferencesSchema.safeParse({ ...prefs, timeZone: 'Nowhere/Land' }).success).toBe(false)
  })
})
