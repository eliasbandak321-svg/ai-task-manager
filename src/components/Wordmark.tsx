import { ListChecks } from 'lucide-react'
import { site } from '../config/site'

/** Logo tile plus product name. Links back to the top of the page. */
export function Wordmark() {
  return (
    <a
      href="#top"
      aria-label={`${site.name}, back to top`}
      className="inline-flex min-h-11 items-center gap-2.5 rounded-control font-display font-semibold text-ink"
    >
      <span className="grid size-8 place-items-center rounded-control border border-glow/30 bg-glow/10 text-glow">
        <ListChecks aria-hidden="true" className="size-4.5" strokeWidth={2} />
      </span>
      <span className="whitespace-nowrap">{site.name}</span>
    </a>
  )
}
