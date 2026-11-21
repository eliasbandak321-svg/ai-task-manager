import { useSyncExternalStore } from 'react'
import { toIsoDate, type IsoDate } from '../domain/dates'
import { subscribeToClock } from './clock'

function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

/**
 * Today's date in the visitor's own time zone, for public pages (the landing page has no user
 * settings). Moves to the new day by itself at midnight or when a sleeping tab wakes up.
 */
export function useDeviceToday(): IsoDate {
  return useSyncExternalStore(subscribeToClock, () => toIsoDate(new Date(), deviceTimeZone()))
}
