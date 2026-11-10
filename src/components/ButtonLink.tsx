import type { ReactNode } from 'react'

interface ButtonLinkProps {
  href: string
  children: ReactNode
  className?: string
}

/**
 * A link styled as the primary pill button.
 * It's an <a>, not a <button>, because it navigates: screen readers announce it as a link.
 */
export function ButtonLink({ href, children, className = '' }: ButtonLinkProps) {
  return (
    <a
      href={href}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-glow px-6 text-sm font-semibold text-night shadow-glow transition duration-(--duration-base) ease-out-expo hover:bg-glow-strong motion-safe:hover:-translate-y-0.5 ${className}`}
    >
      {children}
    </a>
  )
}
