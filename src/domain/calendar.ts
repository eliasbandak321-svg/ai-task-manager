import { z } from 'zod'
import { addDays, type IsoDate, type Timestamp } from './dates'
import { idSchema, isoDateSchema, timestampSchema } from './schemas'
import { addMinutes, isValidTimeZone, minutesBetween, weekdayOfDate, zonedParts, zonedToUtc } from './zonedTime'

/*
  Calendar events (M9). An event is stored once with UTC start/end instants plus the IANA time
  zone it was created in. A recurring event stores a *rule*, not rows: occurrences are computed
  for the range being viewed (expandEvent), so a daily event never creates unlimited records.

  Recurrence follows local wall-clock time in the event's zone: "every Monday at 09:00" stays at
  09:00 across daylight-saving changes.

  Exceptions:
  - a deleted occurrence is listed in `excludedStarts` (its original start instant);
  - an edited occurrence is excluded from the series and stored as its own event that points
    back to the series (`seriesId`, `originalStart`).
*/

export const EVENT_CATEGORIES = ['work_session', 'study', 'meeting', 'focus', 'personal', 'break', 'other'] as const
export type EventCategory = (typeof EVENT_CATEGORIES)[number]

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  work_session: 'Work session',
  study: 'Study session',
  meeting: 'Meeting',
  focus: 'Focus time',
  personal: 'Personal',
  break: 'Break',
  other: 'Other',
}

/** Categories that count as working time (for daily limits and workload). */
export const WORK_CATEGORIES: readonly EventCategory[] = ['work_session', 'study', 'focus']

export const RECURRENCE_FREQUENCIES = ['daily', 'weekly', 'monthly'] as const
const MAX_EVENT_MINUTES = 14 * 24 * 60
/** Safety caps when expanding a series, whatever the rule says. */
const MAX_OCCURRENCES = 1000
const MAX_ITERATIONS = 50_000

export const timeZoneSchema = z.string().min(1).max(64).refine(isValidTimeZone, 'Unknown time zone')

export const recurrenceSchema = z
  .strictObject({
    freq: z.enum(RECURRENCE_FREQUENCIES),
    /** Every N days / weeks / months. */
    interval: z.int().min(1).max(52).default(1),
    /** Weekly only: which weekdays (0 = Sunday). Defaults to the first occurrence's weekday. */
    byWeekday: z.array(z.int().min(0).max(6)).min(1).max(7).nullable().default(null),
    /** Last local date that may have an occurrence (inclusive). */
    until: isoDateSchema.nullable().default(null),
    /** Maximum number of occurrences. */
    count: z.int().min(1).max(MAX_OCCURRENCES).nullable().default(null),
  })
  .refine((rule) => rule.freq === 'weekly' || rule.byWeekday === null, {
    message: 'Weekdays can only be chosen for weekly events',
    path: ['byWeekday'],
  })

export type Recurrence = z.output<typeof recurrenceSchema>

const eventTitle = z.string().trim().min(1, 'Title is required').max(200, 'Title must be at most 200 characters')
const eventDescription = z.string().trim().max(2000, 'Description must be at most 2000 characters')

export const calendarEventSchema = z.object({
  id: idSchema,
  userId: idSchema,
  title: eventTitle,
  description: z.string(),
  category: z.enum(EVENT_CATEGORIES),
  startAt: timestampSchema,
  endAt: timestampSchema,
  timeZone: z.string(),
  taskId: idSchema.nullable(),
  recurrence: recurrenceSchema.nullable(),
  excludedStarts: z.array(timestampSchema),
  seriesId: idSchema.nullable(),
  originalStart: timestampSchema.nullable(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})
export type CalendarEvent = z.infer<typeof calendarEventSchema>

function validSpan<T extends { startAt?: string; endAt?: string }>(event: T): boolean {
  if (!event.startAt || !event.endAt) return true
  const minutes = minutesBetween(new Date(event.startAt), new Date(event.endAt))
  return minutes > 0 && minutes <= MAX_EVENT_MINUTES
}
const SPAN_MESSAGE = { message: 'The end must be after the start (and at most 14 days later)', path: ['endAt'] }

export const createEventInputSchema = z
  .strictObject({
    title: eventTitle,
    description: eventDescription.default(''),
    category: z.enum(EVENT_CATEGORIES).default('other'),
    startAt: timestampSchema,
    endAt: timestampSchema,
    timeZone: timeZoneSchema,
    taskId: idSchema.nullable().default(null),
    recurrence: recurrenceSchema.nullable().default(null),
  })
  .refine(validSpan, SPAN_MESSAGE)
export type CreateEventInput = z.output<typeof createEventInputSchema>

/** Which events an edit or delete of a recurring event applies to. */
export const EDIT_SCOPES = ['occurrence', 'following', 'series'] as const
export type EditScope = (typeof EDIT_SCOPES)[number]

export const updateEventInputSchema = z
  .strictObject({
    title: eventTitle,
    description: eventDescription,
    category: z.enum(EVENT_CATEGORIES),
    startAt: timestampSchema,
    endAt: timestampSchema,
    timeZone: timeZoneSchema,
    taskId: idSchema.nullable(),
    recurrence: recurrenceSchema.nullable(),
  })
  .partial()
  .refine((value) => Object.values(value).some((field) => field !== undefined), 'Provide at least one field to update')
  .refine(validSpan, SPAN_MESSAGE)
export type UpdateEventInput = z.output<typeof updateEventInputSchema>

/** One concrete appearance of an event in time. */
export interface Occurrence {
  eventId: string
  /** Identifies this occurrence within its series: its original (unedited) start. */
  occurrenceStart: Timestamp
  start: Timestamp
  end: Timestamp
  title: string
  category: EventCategory
  taskId: string | null
  isRecurring: boolean
  /** Set for an edited occurrence stored as its own event. */
  seriesId: string | null
}

interface RangeEvent {
  id: string
  title: string
  category: EventCategory
  startAt: string
  endAt: string
  timeZone: string
  taskId: string | null
  recurrence: Recurrence | null
  excludedStarts: readonly string[]
  seriesId: string | null
}

function addMonths(date: IsoDate, months: number): IsoDate | null {
  const [year, month, day] = date.split('-').map(Number)
  const total = year * 12 + (month - 1) + months
  const targetYear = Math.floor(total / 12)
  const targetMonth = (total % 12) + 1
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate()
  if (day > lastDay) return null // e.g. the 31st in a 30-day month: that month has no occurrence
  return `${String(targetYear).padStart(4, '0')}-${String(targetMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** The local dates of a series, in order, from its first date (lazily). */
function* seriesDates(first: IsoDate, rule: Recurrence): Generator<IsoDate> {
  if (rule.freq === 'daily') {
    for (let date = first; ; date = addDays(date, rule.interval)) yield date
  }
  if (rule.freq === 'monthly') {
    for (let step = 0; ; step += rule.interval) {
      const date = addMonths(first, step)
      if (date) yield date
      if (step > 12 * 200) return
    }
  }
  // Weekly: weeks start on Monday (like RFC 5545's default WKST=MO).
  const weekdays = [...new Set(rule.byWeekday ?? [weekdayOfDate(first)])].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
  const mondayOfFirstWeek = addDays(first, -((weekdayOfDate(first) + 6) % 7))
  for (let week = mondayOfFirstWeek; ; week = addDays(week, 7 * rule.interval)) {
    for (const weekday of weekdays) {
      const date = addDays(week, (weekday + 6) % 7)
      if (date >= first) yield date
    }
  }
}

/** The occurrences of `event` that overlap [rangeStart, rangeEnd). */
export function expandEvent(event: RangeEvent, rangeStart: Date, rangeEnd: Date): Occurrence[] {
  const start = new Date(event.startAt)
  const durationMinutes = minutesBetween(start, new Date(event.endAt))
  const base = {
    eventId: event.id,
    title: event.title,
    category: event.category,
    taskId: event.taskId,
    isRecurring: event.recurrence !== null,
    seriesId: event.seriesId,
  }
  const overlaps = (occurrenceStart: Date) =>
    occurrenceStart < rangeEnd && addMinutes(occurrenceStart, durationMinutes) > rangeStart

  if (!event.recurrence) {
    return overlaps(start)
      ? [{ ...base, occurrenceStart: event.startAt, start: event.startAt, end: event.endAt }]
      : []
  }

  const rule = event.recurrence
  const { date: firstDate, minutes } = zonedParts(start, event.timeZone)
  const excluded = new Set(event.excludedStarts)
  const occurrences: Occurrence[] = []
  let produced = 0 // since the series began, for `count`
  for (const date of seriesDates(firstDate, rule)) {
    if (rule.until !== null && date > rule.until) break
    if (rule.count !== null && produced >= rule.count) break
    // Guards against huge ranges: the API also limits how wide a requested range may be.
    if (occurrences.length >= MAX_OCCURRENCES || produced >= MAX_ITERATIONS) break
    const occurrenceStart = zonedToUtc(date, minutes, event.timeZone)
    if (occurrenceStart >= rangeEnd) break
    produced += 1
    const key = occurrenceStart.toISOString()
    if (!excluded.has(key) && overlaps(occurrenceStart)) {
      occurrences.push({
        ...base,
        occurrenceStart: key,
        start: key,
        end: addMinutes(occurrenceStart, durationMinutes).toISOString(),
      })
    }
  }
  return occurrences
}

/** All occurrences of many events in a range, sorted by start. */
export function expandEvents(events: readonly RangeEvent[], rangeStart: Date, rangeEnd: Date): Occurrence[] {
  return events
    .flatMap((event) => expandEvent(event, rangeStart, rangeEnd))
    .sort((a, b) => a.start.localeCompare(b.start) || a.eventId.localeCompare(b.eventId))
}

/** True when `occurrenceStart` is a real (not excluded) occurrence of the series. */
export function isOccurrenceOf(event: RangeEvent, occurrenceStart: string): boolean {
  const at = new Date(occurrenceStart)
  return expandEvent(event, at, addMinutes(at, 1)).some((occurrence) => occurrence.occurrenceStart === occurrenceStart)
}

export interface Interval {
  start: Date
  end: Date
}

/** Pairs of occurrences that overlap in time (for warnings; breaks are ignored). */
export function findConflicts(occurrences: readonly Occurrence[]): [Occurrence, Occurrence][] {
  const relevant = occurrences.filter((occurrence) => occurrence.category !== 'break')
  const sorted = [...relevant].sort((a, b) => a.start.localeCompare(b.start))
  const conflicts: [Occurrence, Occurrence][] = []
  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length && sorted[j].start < sorted[i].end; j += 1) {
      conflicts.push([sorted[i], sorted[j]])
    }
  }
  return conflicts
}

/** The local date range [from, to] as UTC instants [start of from, start of the day after to). */
export function zonedRange(from: IsoDate, to: IsoDate, timeZone: string): Interval {
  return { start: zonedToUtc(from, 0, timeZone), end: zonedToUtc(addDays(to, 1), 0, timeZone) }
}
