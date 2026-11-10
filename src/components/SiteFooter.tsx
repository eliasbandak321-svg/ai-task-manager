import { ArrowUpRight } from 'lucide-react'
import { site } from '../config/site'
import { Container } from './Container'
import { Wordmark } from './Wordmark'

// Computed once when the module loads; render functions should stay pure.
const year = new Date().getFullYear()

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <Container className="flex flex-col gap-6 py-10 text-sm text-ink-subtle md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <Wordmark />
          <p>Built with React, TypeScript and Three.js</p>
        </div>
        <div className="flex flex-col gap-1 md:items-end">
          <a
            href={site.repoUrl}
            className="inline-flex min-h-11 items-center gap-1 text-ink-muted transition-colors duration-(--duration-fast) hover:text-ink"
          >
            Source on GitHub
            <ArrowUpRight aria-hidden="true" className="size-4" />
          </a>
          <p>
            © {year} {site.name}
          </p>
        </div>
      </Container>
    </footer>
  )
}
