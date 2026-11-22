import type { ReactNode } from 'react'
import { useReveal } from '../../hooks/useReveal'

/** Fades and lifts its content in once it scrolls into view (instant under reduced motion). */
export function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const { ref, revealed } = useReveal<HTMLDivElement>()
  return (
    <div ref={ref} data-revealed={revealed} className={`reveal ${className}`}>
      {children}
    </div>
  )
}
