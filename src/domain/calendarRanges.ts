import type { CalendarEvent, Occurrence } from './calendar'
import { addDays, daysBetween, type IsoDate } from './dates'

/*
  Loading calendar data for long periods (M10 Insights). The API expands at most
  CALENDAR_RANGE_MAX_DAYS per request (it protects the server from huge recurring expansions),
  so longer periods are split into consecutive chunks of whole days and merged again.
*/

/** The widest range GET /calendar/events accepts (server/workspace/calendarStore.ts). */
export const CALENDAR_RANGE_MAX_DAYS = 62

/**
 * Days per request. Two days below the limit: a zoned day range can be an hour longer than its
 * day count across a daylight-saving change, and the server measures the limit in hours.
 */
export const CALENDAR_CHUNK_DAYS = 60

/** The longest period Insights accepts (custom ranges included): at most 7 calendar requests. */
export const INSIGHTS_MAX_DAYS = 366

/** Splits the inclusive date range [from, to] into consecutive inclusive chunks of at most maxDays days. */
export function splitDateRange(from: IsoDate, to: IsoDate, maxDays: number = CALENDAR_CHUNK_DAYS): { from: IsoDate; to: IsoDate }[] {
  if (maxDays < 1) throw new RangeError('maxDays must be at least 1')
  if (to < from) return []
  const chunks: { from: IsoDate; to: IsoDate }[] = []
  for (let start = from; start <= to; start = addDays(start, maxDays)) {
    const end = addDays(start, maxDays - 1)
    chunks.push({ from: start, to: end < to ? end : to })
  }
  return chunks
}

/** Inclusive day count of [from, to]. */
export function rangeDays(from: IsoDate, to: IsoDate): number {
  return daysBetween(from, to) + 1
}

/**
 * Merges calendar responses for adjacent ranges. An event or occurrence that crosses a chunk
 * boundary is returned by both requests; each is kept once (events by id, occurrences by event
 * and original start), and occurrences stay sorted by start.
 */
export function mergeCalendarRanges(parts: readonly { events: readonly CalendarEvent[]; occurrences: readonly Occurrence[] }[]): { events: CalendarEvent[]; occurrences: Occurrence[] } {
  const events = new Map<string, CalendarEvent>()
  const occurrences = new Map<string, Occurrence>()
  for (const part of parts) {
    for (const event of part.events) events.set(event.id, event)
    for (const occurrence of part.occurrences) occurrences.set(`${occurrence.eventId}|${occurrence.occurrenceStart}`, occurrence)
  }
  return {
    events: [...events.values()],
    occurrences: [...occurrences.values()].sort((a, b) => a.start.localeCompare(b.start)),
  }
}
