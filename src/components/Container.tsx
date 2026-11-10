import type { ReactNode } from 'react'

interface ContainerProps {
  children: ReactNode
  className?: string
}

/** Centers content at the shared content width with responsive side padding (docs/design.md §4). */
export function Container({ children, className = '' }: ContainerProps) {
  return <div className={`mx-auto w-full max-w-content px-5 md:px-8 xl:px-10 ${className}`}>{children}</div>
}
