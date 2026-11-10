import type { ReactNode } from 'react'

interface EyebrowProps {
  children: ReactNode
  className?: string
}

/** Small uppercase label shown above a heading. */
export function Eyebrow({ children, className = '' }: EyebrowProps) {
  return (
    <p
      className={`inline-flex items-center rounded-full border border-glow/25 bg-glow/5 px-3 py-1 text-eyebrow font-medium uppercase text-glow ${className}`}
    >
      {children}
    </p>
  )
}
