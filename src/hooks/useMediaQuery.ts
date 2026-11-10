import { useSyncExternalStore } from 'react'

/**
 * Subscribes to a CSS media query, e.g. useMediaQuery('(prefers-reduced-motion: reduce)').
 * Returns false where matchMedia is unavailable (for example in jsdom tests).
 *
 * useSyncExternalStore is React's built-in way to read a value that lives outside React
 * and changes over time; it avoids the flash of a wrong value that useState + useEffect causes.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== 'function') return () => {}
      const list = window.matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    },
    () => typeof window.matchMedia === 'function' && window.matchMedia(query).matches,
  )
}
