import { useSyncExternalStore } from 'react'
import { toIsoDate, type IsoDate } from '../domain'
import { subscribeToClock } from './clock'
import { useUserTimeZone } from './workspaceQueries'

/*
  The user's calendar date, which every deadline is compared against. Since M9 it is the date
  in the time zone from the user's settings (falling back to the device's until they're saved),
  so deadlines, the calendar and the scheduler all agree on what "today" is.
  The domain never reads the clock itself; this hook is where the app does it. It re-checks
  every minute, on focus and when a hidden tab becomes visible (hooks/clock.ts), so a dashboard left open overnight moves to
  the new day by itself.
*/

export function useToday(): IsoDate {
  const timeZone = useUserTimeZone()
  // The snapshot is a string, so React only re-renders when the date actually changes.
  return useSyncExternalStore(subscribeToClock, () => toIsoDate(new Date(), timeZone))
}
