import { ArrowUpRight } from 'lucide-react'
import { site } from '../config/site'
import { useScrolledPast } from '../hooks/useScrolledPast'
import { Container } from './Container'
import { Wordmark } from './Wordmark'

const navLinkClass =
  'inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm font-medium text-ink-muted transition-colors duration-(--duration-fast) hover:text-ink'

/** Fixed header: transparent over the hero, solid with blur once the page scrolls (docs/design.md §7). */
export function SiteHeader() {
  const scrolled = useScrolledPast(8)

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-(--duration-base) ${
        scrolled ? 'border-line bg-surface/80 backdrop-blur-md' : 'border-transparent'
      }`}
    >
      <Container className="flex h-16 items-center justify-between gap-4">
        <Wordmark />
        <nav aria-label="Primary">
          <ul className="flex items-center gap-1">
            <li>
              <a href="#features" className={navLinkClass}>
                Features
              </a>
            </li>
            <li className="hidden sm:block">
              <a href={site.repoUrl} className={navLinkClass}>
                GitHub
                <ArrowUpRight aria-hidden="true" className="size-4" />
              </a>
            </li>
          </ul>
        </nav>
      </Container>
    </header>
  )
}
