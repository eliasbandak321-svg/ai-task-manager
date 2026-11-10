import { useEffect, useRef, useState } from 'react'

// One observer shared by every revealed element, instead of one observer per element.
let sharedObserver: IntersectionObserver | null = null
const callbacks = new WeakMap<Element, () => void>()

function getObserver(): IntersectionObserver {
  sharedObserver ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        callbacks.get(entry.target)?.()
        callbacks.delete(entry.target)
        sharedObserver?.unobserve(entry.target) // reveal once, then stop watching
      }
    },
    { threshold: 0.15 },
  )
  return sharedObserver
}

/**
 * Scroll reveal: returns a ref to attach and whether the element has been revealed.
 * Without IntersectionObserver (old browsers, jsdom), content is shown immediately.
 */
export function useReveal<T extends Element>() {
  const ref = useRef<T>(null)
  const [revealed, setRevealed] = useState(() => typeof IntersectionObserver === 'undefined')

  useEffect(() => {
    const element = ref.current
    if (!element || revealed) return
    const observer = getObserver()
    callbacks.set(element, () => setRevealed(true))
    observer.observe(element)
    return () => {
      callbacks.delete(element)
      observer.unobserve(element)
    }
  }, [revealed])

  return { ref, revealed }
}
