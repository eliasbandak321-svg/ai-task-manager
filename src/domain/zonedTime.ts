import { addDays, type IsoDate } from './dates'

/*
  Wall-clock time in an IANA time zone ("Europe/Berlin"), without a date library.

  Calendar events are stored as UTC instants; scheduling and recurrence think in the user's
  local days and hours ("weekdays 9:00–17:00", "every Monday at 10:00"). These helpers convert
  between the two, correctly across daylight-saving changes:
  - a local time that doesn't exist (spring forward, 02:30) moves forward by the gap;
  - a local time that exists twice (fall back, 02:30) resolves to the earlier one.
*/

export const MINUTES_PER_DAY = 24 * 60
const MS_PER_MINUTE = 60_000

interface LocalParts {
  date: IsoDate
  /** Minutes since local midnight, 0–1439. */
  minutes: number
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number
}

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
const formatters = new Map<string, Intl.DateTimeFormat>()

function formatter(timeZone: string): Intl.DateTimeFormat {
  let format = formatters.get(timeZone)
  if (!format) {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short',
      hourCycle: 'h23',
    })
    formatters.set(timeZone, format)
  }
  return format
}

/** True for a time zone this runtime knows (e.g. "Europe/Berlin", "UTC"). */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    formatter(timeZone)
    return true
  } catch {
    return false
  }
}

/** The local date, time of day and weekday of an instant in `timeZone`. */
export function zonedParts(instant: Date, timeZone: string): LocalParts {
  const parts = formatter(timeZone).formatToParts(instant)
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ''
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
    weekday: WEEKDAYS[get('weekday')] ?? 0,
  }
}

/** How far local time in `timeZone` is ahead of UTC at `instant`, in milliseconds. */
function offsetMs(instant: number, timeZone: string): number {
  const parts = formatter(timeZone).formatToParts(new Date(instant))
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - Math.floor(instant / 1000) * 1000
}

/** The UTC instant of local `date` at `minutes` past midnight in `timeZone`. */
export function zonedToUtc(date: IsoDate, minutes: number, timeZone: string): Date {
  const [year, month, day] = date.split('-').map(Number)
  const wallClockAsUtc = Date.UTC(year, month - 1, day, 0, minutes)
  // The offset a day before and a day after: equal except around a daylight-saving change.
  const offsets = [...new Set([offsetMs(wallClockAsUtc - 86_400_000, timeZone), offsetMs(wallClockAsUtc + 86_400_000, timeZone)])]
  const candidates = offsets.map((offset) => wallClockAsUtc - offset)
  const target = zonedParts(new Date(wallClockAsUtc), 'UTC')
  const matching = candidates.filter((candidate) => {
    const local = zonedParts(new Date(candidate), timeZone)
    return local.date === target.date && local.minutes === target.minutes
  })
  // Exists twice (fall back): the earlier instant. Doesn't exist (spring forward): the later
  // candidate, which is the requested time shifted forward by the gap.
  return new Date(matching.length > 0 ? Math.min(...matching) : Math.max(...candidates))
}

/** The start of local `date` (local midnight) as a UTC instant. */
export function startOfZonedDay(date: IsoDate, timeZone: string): Date {
  return zonedToUtc(date, 0, timeZone)
}

/** Each local date from `from` to `to`, inclusive. */
export function eachDate(from: IsoDate, to: IsoDate): IsoDate[] {
  const dates: IsoDate[] = []
  for (let date = from; date <= to; date = addDays(date, 1)) dates.push(date)
  return dates
}

/** Weekday (0 = Sunday) of a calendar date, independent of any time zone. */
export function weekdayOfDate(date: IsoDate): number {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

export function addMinutes(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * MS_PER_MINUTE)
}

export function minutesBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / MS_PER_MINUTE)
}
