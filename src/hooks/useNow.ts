import { useSyncExternalStore } from 'react'

/*
  The current time, rounded down to the minute, as an ISO string. Like useToday, it keeps
  reading the clock out of render: the component re-renders only when the minute changes.
*/

function getNow(): string {
  const now = new Date()
  now.setSeconds(0, 0)
  return now.toISOString()
}

function subscribe(onChange: () => void): () => void {
  const interval = window.setInterval(onChange, 15_000)
  window.addEventListener('focus', onChange)
  return () => {
    window.clearInterval(interval)
    window.removeEventListener('focus', onChange)
  }
}

export function useNow(): string {
  return useSyncExternalStore(subscribe, getNow)
}
