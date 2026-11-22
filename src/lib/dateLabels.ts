import { addDays, type IsoDate } from '../domain/dates'
import { weekdayOfDate } from '../domain/zonedTime'

/*
  Labels for calendar dates (M10). An IsoDate is a calendar day without a time zone, so it is
  formatted at noon UTC with timeZone: 'UTC': the weekday and the day always match the date,
  whatever the device's zone. Kept free of other dependencies, so the public landing page can use it.
*/

function asDate(date: IsoDate): Date {
  return new Date(`${date}T12:00:00Z`)
}

/** "Friday, 20 November" */
export function formatWeekdayDate(date: IsoDate, locale = 'en-GB'): string {
  // Built from parts: en-GB's combined format has no comma ("Friday 20 November").
  const weekday = asDate(date).toLocaleDateString(locale, { weekday: 'long', timeZone: 'UTC' })
  const dayMonth = asDate(date).toLocaleDateString(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' })
  return `${weekday}, ${dayMonth}`
}

/** "16 – 20 November", or "30 November – 4 December" across a month boundary. */
export function formatDayRange(from: IsoDate, to: IsoDate, locale = 'en-GB'): string {
  const sameMonth = from.slice(0, 7) === to.slice(0, 7)
  const start = asDate(from).toLocaleDateString(locale, sameMonth ? { day: 'numeric', timeZone: 'UTC' } : { day: 'numeric', month: 'long', timeZone: 'UTC' })
  const end = asDate(to).toLocaleDateString(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' })
  return `${start} – ${end}`
}

/** Monday to Friday of the (Monday-based) week that contains `date`. */
export function workWeekOf(date: IsoDate, locale = 'en-GB'): { date: IsoDate; short: string; day: number; isToday: boolean }[] {
  const monday = addDays(date, -((weekdayOfDate(date) + 6) % 7))
  return [0, 1, 2, 3, 4].map((offset) => {
    const day = addDays(monday, offset)
    return { date: day, short: asDate(day).toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' }), day: Number(day.slice(8)), isToday: day === date }
  })
}
