import { describe, expect, it } from 'vitest'
import {
  createEventInputSchema,
  expandEvent,
  expandEvents,
  findConflicts,
  isOccurrenceOf,
  recurrenceSchema,
  updateEventInputSchema,
  zonedRange,
  type Recurrence,
} from './calendar'
import { zonedParts } from './zonedTime'

const TZ = 'Europe/Berlin'
const rule = (input: Partial<Recurrence> & Pick<Recurrence, 'freq'>) => recurrenceSchema.parse(input)

function event(overrides: Partial<Parameters<typeof expandEvent>[0]> = {}) {
  return {
    id: 'e1',
    title: 'Standup',
    category: 'meeting' as const,
    startAt: '2026-03-02T08:00:00.000Z', // Monday 09:00 in Berlin
    endAt: '2026-03-02T08:30:00.000Z',
    timeZone: TZ,
    taskId: null,
    recurrence: null,
    excludedStarts: [],
    seriesId: null,
    ...overrides,
  }
}

const localTimes = (occurrences: ReturnType<typeof expandEvent>) =>
  occurrences.map((occurrence) => {
    const parts = zonedParts(new Date(occurrence.start), TZ)
    return `${parts.date} ${String(Math.floor(parts.minutes / 60)).padStart(2, '0')}:${String(parts.minutes % 60).padStart(2, '0')}`
  })

describe('expandEvent', () => {
  it('returns a single event when it overlaps the range', () => {
    const range = zonedRange('2026-03-02', '2026-03-02', TZ)
    expect(expandEvent(event(), range.start, range.end)).toHaveLength(1)
    const later = zonedRange('2026-03-03', '2026-03-09', TZ)
    expect(expandEvent(event(), later.start, later.end)).toEqual([])
  })

  it('repeats daily at the same local time across the daylight-saving change', () => {
    const range = zonedRange('2026-03-27', '2026-03-31', TZ)
    const occurrences = expandEvent(event({ recurrence: rule({ freq: 'daily' }) }), range.start, range.end)
    expect(localTimes(occurrences)).toEqual([
      '2026-03-27 09:00',
      '2026-03-28 09:00',
      '2026-03-29 09:00', // DST starts this night
      '2026-03-30 09:00',
      '2026-03-31 09:00',
    ])
    expect(occurrences[3].start).toBe('2026-03-30T07:00:00.000Z') // UTC shifted by an hour
  })

  it('repeats on selected weekdays, every other week', () => {
    const range = zonedRange('2026-03-02', '2026-03-22', TZ)
    const occurrences = expandEvent(
      event({ recurrence: rule({ freq: 'weekly', byWeekday: [1, 3], interval: 2 }) }),
      range.start,
      range.end,
    )
    expect(localTimes(occurrences).map((time) => time.slice(0, 10))).toEqual([
      '2026-03-02', // Mon
      '2026-03-04', // Wed
      '2026-03-16', // Mon, two weeks later
      '2026-03-18',
    ])
  })

  it('repeats monthly on the same day, skipping months without it', () => {
    const range = zonedRange('2026-01-01', '2026-05-31', TZ)
    const occurrences = expandEvent(
      event({ startAt: '2026-01-31T08:00:00.000Z', endAt: '2026-01-31T09:00:00.000Z', recurrence: rule({ freq: 'monthly' }) }),
      range.start,
      range.end,
    )
    expect(localTimes(occurrences).map((time) => time.slice(0, 10))).toEqual(['2026-01-31', '2026-03-31', '2026-05-31'])
  })

  it('stops at "until" and after "count", and skips excluded occurrences', () => {
    const range = zonedRange('2026-03-01', '2026-04-30', TZ)
    expect(expandEvent(event({ recurrence: rule({ freq: 'daily', until: '2026-03-04' }) }), range.start, range.end)).toHaveLength(3)
    expect(expandEvent(event({ recurrence: rule({ freq: 'daily', count: 5 }) }), range.start, range.end)).toHaveLength(5)
    const excluded = expandEvent(
      event({ recurrence: rule({ freq: 'daily', count: 3 }), excludedStarts: ['2026-03-03T08:00:00.000Z'] }),
      range.start,
      range.end,
    )
    expect(localTimes(excluded).map((time) => time.slice(0, 10))).toEqual(['2026-03-02', '2026-03-04'])
  })

  it('computes only the viewed range of an endless series', () => {
    const range = zonedRange('2030-06-03', '2030-06-09', TZ)
    const occurrences = expandEvent(event({ recurrence: rule({ freq: 'daily' }) }), range.start, range.end)
    expect(occurrences).toHaveLength(7)
  })

  it('identifies real occurrences of a series', () => {
    const series = event({ recurrence: rule({ freq: 'weekly' }) })
    expect(isOccurrenceOf(series, '2026-03-09T08:00:00.000Z')).toBe(true)
    expect(isOccurrenceOf(series, '2026-03-10T08:00:00.000Z')).toBe(false)
  })
})

describe('expandEvents and conflicts', () => {
  it('sorts occurrences and finds overlaps, ignoring breaks', () => {
    const range = zonedRange('2026-03-02', '2026-03-02', TZ)
    const occurrences = expandEvents(
      [
        event({ id: 'b', startAt: '2026-03-02T08:15:00.000Z', endAt: '2026-03-02T09:00:00.000Z', category: 'work_session' }),
        event({ id: 'a' }),
        event({ id: 'c', startAt: '2026-03-02T08:20:00.000Z', endAt: '2026-03-02T08:25:00.000Z', category: 'break' }),
        event({ id: 'd', startAt: '2026-03-02T10:00:00.000Z', endAt: '2026-03-02T11:00:00.000Z' }),
      ],
      range.start,
      range.end,
    )
    expect(occurrences.map((occurrence) => occurrence.eventId)).toEqual(['a', 'b', 'c', 'd'])
    expect(findConflicts(occurrences).map(([x, y]) => `${x.eventId}-${y.eventId}`)).toEqual(['a-b'])
  })
})

describe('event input schemas', () => {
  const valid = {
    title: ' Deep work ',
    startAt: '2026-03-02T08:00:00.000Z',
    endAt: '2026-03-02T10:00:00.000Z',
    timeZone: TZ,
  }

  it('applies defaults and trims text', () => {
    expect(createEventInputSchema.parse(valid)).toMatchObject({ title: 'Deep work', category: 'other', taskId: null, recurrence: null })
  })

  it('rejects bad spans, unknown time zones, invalid rules and server-owned fields', () => {
    expect(createEventInputSchema.safeParse({ ...valid, endAt: valid.startAt }).success).toBe(false)
    expect(createEventInputSchema.safeParse({ ...valid, endAt: '2026-03-30T08:00:00.000Z' }).success).toBe(false)
    expect(createEventInputSchema.safeParse({ ...valid, timeZone: 'Mars/Olympus' }).success).toBe(false)
    expect(createEventInputSchema.safeParse({ ...valid, recurrence: { freq: 'daily', byWeekday: [1] } }).success).toBe(false)
    expect(createEventInputSchema.safeParse({ ...valid, userId: '00000000-0000-4000-8000-000000000001' }).success).toBe(false)
    expect(updateEventInputSchema.safeParse({}).success).toBe(false)
  })
})
