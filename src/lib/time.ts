import type { EventCategory } from '../domain'

/*
  Time presentation for the calendar (M9). Instants are stored in UTC; the calendar shows them
  in the browser's time zone, the way people read their own calendar.
*/

/** "Mon, Mar 2, 09:00" in the browser's zone. */
export function formatInstant(instant: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(instant))
}

/** "09:00". */
export function formatClock(instant: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(new Date(instant))
}

/** "09:00–10:30" (or with dates when it spans days). */
export function formatSpan(start: string, end: string, locale?: string): string {
  const sameDay = new Date(start).toDateString() === new Date(end).toDateString()
  return `${formatInstant(start, locale)}–${sameDay ? formatClock(end, locale) : formatInstant(end, locale)}`
}

/** "1 h 30 min", "45 min", "2 h". */
export function formatMinutes(minutes: number): string {
  const rounded = Math.round(minutes)
  const hours = Math.floor(rounded / 60)
  const rest = rounded % 60
  if (hours === 0) return `${rest} min`
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

/** The value for an <input type="datetime-local"> showing `instant` in the browser's zone. */
export function toLocalInput(instant: string | Date): string {
  const date = new Date(instant)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** The UTC instant of a datetime-local value (interpreted in the browser's zone), or null. */
export function fromLocalInput(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
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
