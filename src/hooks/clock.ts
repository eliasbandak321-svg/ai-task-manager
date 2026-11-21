/*
  Re-checks the clock (M10): every minute, when the window regains focus, and when a hidden or
  suspended tab becomes visible again. Hooks built on it (useToday, useDeviceToday) return a date
  string, so React only re-renders when the calendar day actually changes, e.g. at midnight.
*/
export function subscribeToClock(onChange: () => void): () => void {
  const interval = window.setInterval(onChange, 60_000)
  const onVisible = () => {
    if (document.visibilityState === 'visible') onChange()
  }
  window.addEventListener('focus', onChange)
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    window.clearInterval(interval)
    window.removeEventListener('focus', onChange)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
