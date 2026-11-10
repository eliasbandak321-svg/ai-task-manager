import { useEffect, useState } from 'react'

/**
 * True once the page has scrolled more than `offset` pixels.
 * State only updates when the threshold is crossed, so scrolling doesn't re-render on every frame.
 */
export function useScrolledPast(offset: number): boolean {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > offset)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [offset])

  return scrolled
}
