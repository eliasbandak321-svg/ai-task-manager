import { useSyncExternalStore } from 'react'
import { toIsoDate, type IsoDate } from '../domain'

/*
  The user's local calendar date, which every deadline is compared against.
  The domain never reads the clock itself; this hook is where the app does it.
  It re-checks every minute and when the window regains focus, so a dashboard left open
  overnight moves to the new day by itself.
*/

function getToday(): IsoDate {
  return toIsoDate(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone)
}

function subscribe(onChange: () => void): () => void {
  const interval = window.setInterval(onChange, 60_000)
  window.addEventListener('focus', onChange)
  return () => {
    window.clearInterval(interval)
    window.removeEventListener('focus', onChange)
  }
}

export function useToday(): IsoDate {
  // The snapshot is a string, so React only re-renders when the date actually changes.
  return useSyncExternalStore(subscribe, getToday)
}
