/*
  Two kinds of time, deliberately kept apart:

  - IsoDate ("2026-03-14"): a calendar day with no time and no time zone. Used for deadlines,
    because "due on the 14th" means the 14th wherever the user is.
  - Timestamp ("2026-03-14T09:30:00.000Z"): an exact instant in UTC. Used for createdAt,
    updatedAt and completedAt.

  Mixing them is a classic bug: storing a deadline as midnight UTC shows it a day early
  for anyone west of London.
*/

/** A calendar date in `YYYY-MM-DD` format. */
export type IsoDate = string

/** An instant as an ISO 8601 UTC string, e.g. `2026-03-14T09:30:00.000Z`. */
export type Timestamp = string

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const MS_PER_DAY = 86_400_000

/** Parses an IsoDate to milliseconds at UTC midnight, or NaN if it isn't a real calendar date. */
function toUtcMidnight(date: IsoDate): number {
  const match = ISO_DATE_PATTERN.exec(date)
  if (!match) return Number.NaN
  const [, year, month, day] = match.map(Number)
  // setUTCFullYear, unlike Date.UTC, doesn't treat years 0–99 as 1900–1999.
  const ms = new Date(0).setUTCFullYear(year, month - 1, day)
  // Dates silently roll over (Feb 30 → Mar 2), so reject dates that changed.
  const check = new Date(ms)
  return check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day
    ? ms
    : Number.NaN
}

function fromUtcMidnight(ms: number): IsoDate {
  return new Date(ms).toISOString().slice(0, 10)
}

/** True when the value is a real calendar date in `YYYY-MM-DD` format. */
export function isIsoDate(value: string): boolean {
  return !Number.isNaN(toUtcMidnight(value))
}

/**
 * The calendar date of an instant in a given IANA time zone (e.g. "Europe/Berlin").
 * Used to compute "today" for the user, which is what deadlines are compared against.
 */
export function toIsoDate(instant: Date, timeZone: string): IsoDate {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

/**
 * Whole calendar days from `from` to `to` (negative if `to` is earlier).
 * Uses UTC midnights, so daylight-saving changes can never produce 0.96 or 1.04 days.
 */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtcMidnight(to) - toUtcMidnight(from)) / MS_PER_DAY)
}

/** The date `days` calendar days after `date` (use a negative number to go back). */
export function addDays(date: IsoDate, days: number): IsoDate {
  return fromUtcMidnight(toUtcMidnight(date) + days * MS_PER_DAY)
}

/** Serialises an instant for storage and JSON. */
export function toTimestamp(instant: Date): Timestamp {
  return instant.toISOString()
}
