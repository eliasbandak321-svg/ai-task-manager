import { ListChecks } from 'lucide-react'
import { Link } from 'react-router'
import { site } from '../config/site'

interface WordmarkProps {
  /** A route to link to (e.g. "/"). Without it, the wordmark links to the top of the current page. */
  to?: string
}

/** Logo tile plus product name. */
export function Wordmark({ to }: WordmarkProps) {
  const className = 'inline-flex min-h-11 items-center gap-2.5 rounded-control font-display font-semibold text-ink'
  const content = (
    <>
      <span className="grid size-8 place-items-center rounded-control border border-glow/30 bg-glow/10 text-glow">
        <ListChecks aria-hidden="true" className="size-4.5" strokeWidth={2} />
      </span>
      <span className="whitespace-nowrap">{site.name}</span>
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
