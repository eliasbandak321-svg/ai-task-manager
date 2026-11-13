import { useSyncExternalStore } from 'react'
import { toIsoDate, type IsoDate } from '../domain'
import { useUserTimeZone } from './workspaceQueries'

/*
  The user's calendar date, which every deadline is compared against. Since M9 it is the date
  in the time zone from the user's settings (falling back to the device's until they're saved),
  so deadlines, the calendar and the scheduler all agree on what "today" is.
  The domain never reads the clock itself; this hook is where the app does it. It re-checks
  every minute and when the window regains focus, so a dashboard left open overnight moves to
  the new day by itself.
*/

function subscribe(onChange: () => void): () => void {
  const interval = window.setInterval(onChange, 60_000)
  window.addEventListener('focus', onChange)
  return () => {
    window.clearInterval(interval)
    window.removeEventListener('focus', onChange)
  }
}

export function useToday(): IsoDate {
  const timeZone = useUserTimeZone()
  // The snapshot is a string, so React only re-renders when the date actually changes.
  return useSyncExternalStore(subscribe, () => toIsoDate(new Date(), timeZone))
}
