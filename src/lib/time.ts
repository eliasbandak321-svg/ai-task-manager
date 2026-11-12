import { isIsoDate, zonedParts, zonedRange, zonedToUtc, type EventCategory, type IsoDate } from '../domain'

/*
  Time presentation (M9). Instants are stored in UTC and always shown in the user's time zone
  from their settings — not the device's — so the calendar, the scheduler and every date in
  the app agree, even when travelling or on a computer set to another zone.
*/

/** "Mon, Mar 2, 09:00" in the given time zone (the user's, from their settings). */
export function formatInstant(instant: string, timeZone: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).format(new Date(instant))
}

/** "09:00" in the given time zone. */
export function formatClock(instant: string, timeZone: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).format(new Date(instant))
}

/** "Mon, Mar 2, 09:00–10:30" (with both dates when it spans days). */
export function formatSpan(start: string, end: string, timeZone: string, locale?: string): string {
  const sameDay = zonedParts(new Date(start), timeZone).date === zonedParts(new Date(end), timeZone).date
  return `${formatInstant(start, timeZone, locale)}–${sameDay ? formatClock(end, timeZone, locale) : formatInstant(end, timeZone, locale)}`
}

/** "Monday, March 2" for the local day of an instant. */
export function formatDayHeading(instant: string, timeZone: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'long', month: 'long', day: 'numeric', timeZone }).format(new Date(instant))
}

/** "1 h 30 min", "45 min", "2 h". */
export function formatMinutes(minutes: number): string {
  const rounded = Math.round(minutes)
  const hours = Math.floor(rounded / 60)
  const rest = rounded % 60
  if (hours === 0) return `${rest} min`
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

/** The value for an <input type="datetime-local"> showing `instant` as wall-clock time in `timeZone`. */
export function toLocalInput(instant: string | Date, timeZone: string): string {
  const { date, minutes } = zonedParts(new Date(instant), timeZone)
  return `${date}T${minutesToClock(minutes)}`
}

/** The UTC instant of a datetime-local value read as wall-clock time in `timeZone`, or null. */
export function fromLocalInput(value: string, timeZone: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match || !isIsoDate(match[1])) return null
  const minutes = Number(match[2]) * 60 + Number(match[3])
  if (minutes >= 24 * 60) return null
  return zonedToUtc(match[1], minutes, timeZone).toISOString()
}

/** [start of `from`, start of the day after `to`) in `timeZone`, as ISO instants. */
export function zonedDayRange(from: IsoDate, to: IsoDate, timeZone: string): { from: string; to: string } {
  const range = zonedRange(from, to, timeZone)
  return { from: range.start.toISOString(), to: range.end.toISOString() }
}

/** The local date of an instant in `timeZone`. */
export function zonedDate(instant: string, timeZone: string): IsoDate {
  return zonedParts(new Date(instant), timeZone).date
}

/** "HH:MM" ↔ minutes since midnight, for working-hour fields. */
export function minutesToClock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

export function clockToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const minutes = Number(match[1]) * 60 + Number(match[2])
  return minutes <= 24 * 60 ? minutes : null
}

/** Token-based classes per category (background tint with dark text). */
export const CATEGORY_CLASSES: Record<EventCategory, string> = {
  work_session: 'bg-category-work text-night',
  study: 'bg-category-study text-night',
  meeting: 'bg-category-meeting text-night',
  focus: 'bg-category-focus text-night',
  personal: 'bg-category-personal text-night',
  break: 'bg-category-break text-night',
  other: 'bg-category-other text-night',
}

/** CSS variable per category, for the calendar library (it sets colours inline). */
export const CATEGORY_COLOR_VARS: Record<EventCategory, string> = {
  work_session: 'var(--color-category-work)',
  study: 'var(--color-category-study)',
  meeting: 'var(--color-category-meeting)',
  focus: 'var(--color-category-focus)',
  personal: 'var(--color-category-personal)',
  break: 'var(--color-category-break)',
  other: 'var(--color-category-other)',
}
