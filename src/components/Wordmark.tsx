import { Link } from 'react-router'
import { site } from '../config/site'

interface WordmarkProps {
  /** A route to link to (e.g. "/"). Without it, the wordmark links to the top of the current page. */
  to?: string
  /** Hide the product name visually (the link keeps its accessible name). */
  compact?: boolean
}

/** Brand mark (a cyan–mint–sky–lavender ring, M10) plus the product name. */
export function Wordmark({ to, compact = false }: WordmarkProps) {
  const className = 'inline-flex min-h-11 items-center gap-2.5 rounded-control font-display font-semibold tracking-tight text-ink'
  const content = (
    <>
      <span aria-hidden="true" className="brand-mark" />
      <span className={compact ? 'sr-only' : 'whitespace-nowrap'}>{site.name}</span>
    </>
  )

  return to ? (
    <Link to={to} aria-label={`${site.name}, home`} className={className}>
      {content}
    </Link>
  ) : (
    <a href="#top" aria-label={`${site.name}, back to top`} className={className}>
      {content}
    </a>
  )
}
