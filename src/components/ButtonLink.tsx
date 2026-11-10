import type { ReactNode } from 'react'
import { Link } from 'react-router'

type ButtonLinkProps = {
  children: ReactNode
  variant?: 'primary' | 'secondary'
  className?: string
} & ({ to: string; href?: never } | { href: string; to?: never })

const variants = {
  primary: 'bg-glow text-night shadow-glow hover:bg-glow-strong',
  secondary: 'border border-line-strong bg-surface/60 text-ink hover:border-ink-subtle',
}

/**
 * A link styled as a pill button.
 * It's a link, not a <button>, because it navigates: screen readers announce it as a link.
 * Use `to` for app routes (client-side navigation) and `href` for in-page anchors.
 */
export function ButtonLink({ children, variant = 'primary', className = '', ...target }: ButtonLinkProps) {
  const classes = `inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold transition duration-(--duration-base) ease-out-expo motion-safe:hover:-translate-y-0.5 ${variants[variant]} ${className}`

  return target.to !== undefined ? (
    <Link to={target.to} className={classes}>
      {children}
    </Link>
  ) : (
    <a href={target.href} className={classes}>
      {children}
    </a>
  )
}
