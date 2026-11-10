import { HardDrive } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router'
import { Container } from '../Container'
import { Wordmark } from '../Wordmark'
import { ProjectNav } from './ProjectNav'

/**
 * Dashboard layout: header, project navigation (a sidebar on large screens, a collapsible
 * list on small ones) and the page content.
 */
export function AppShell() {
  const { pathname } = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const previousPath = useRef(pathname)

  // In a single-page app the browser doesn't reset focus on navigation. Moving focus to the
  // main region tells screen reader and keyboard users that the page content changed.
  useEffect(() => {
    if (previousPath.current === pathname) return
    previousPath.current = pathname
    window.scrollTo({ top: 0 })
    // preventScroll: otherwise the browser scrolls <main> to the very top, under the sticky header.
    mainRef.current?.focus({ preventScroll: true })
  }, [pathname])

  return (
    <div className="min-h-svh">
      <a
        href="#main"
        className="sr-only rounded-full bg-glow px-4 py-2 text-sm font-semibold text-night focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-60"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-line bg-night/90 backdrop-blur-md">
        <Container className="flex h-16 items-center justify-between gap-4">
          <Wordmark to="/" />
          <p className="inline-flex items-center gap-2 text-sm text-ink-subtle">
            <HardDrive aria-hidden="true" className="size-4" />
            <span className="sm:hidden">Saved locally</span>
            <span className="hidden sm:inline">Saved in this browser · accounts coming soon</span>
          </p>
        </Container>
      </header>

      {/* pb-28 below lg: room to scroll the last controls above a notification (see Toaster). */}
      <Container className="flex flex-col gap-6 pt-6 pb-28 lg:flex-row lg:items-start lg:gap-10 lg:py-10">
        <ProjectNav />
        <main id="main" ref={mainRef} tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">
          <Outlet />
        </main>
      </Container>
    </div>
  )
}
