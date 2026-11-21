import { ArrowLeft } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import { AccountMenu } from '../auth/AccountMenu'
import { ThemeToggle } from '../ThemeToggle'
import { Wordmark } from '../Wordmark'
import { AppNav } from '../workspace/AppNav'
import { NAV_ITEMS } from '../workspace/navItems'

/** The section name shown in the top bar ("Workspace / Calendar"). */
function sectionFor(pathname: string): string {
  const match = [...NAV_ITEMS].reverse().find((item) => (item.end ? pathname === item.to : pathname.startsWith(item.to)))
  return match?.label ?? 'Workspace'
}

/**
 * App layout (M10): a sidebar with the main navigation on large screens, a top bar with the
 * account menu, and a bottom navigation bar on phones and tablets.
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
    <div className="app-shell min-h-svh lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      <a
        href="#main"
        className="sr-only rounded-full bg-btn px-4 py-2 text-sm font-semibold text-btn-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-60"
      >
        Skip to content
      </a>

      <aside aria-label="Sidebar" className="app-sidebar sticky top-0 hidden h-svh flex-col gap-6 overflow-y-auto border-r border-line bg-raised/60 px-3 py-4 lg:flex">
        <div className="px-1">
          <Wordmark to="/app" />
        </div>
        <AppNav variant="sidebar" />
        <div className="mt-auto flex flex-col gap-0.5 border-t border-line pt-3">
          <ThemeToggle showLabel />
          <Link to="/" className="flex min-h-10 items-center gap-3 rounded-xl px-3 text-sm text-ink-muted hover:bg-raised hover:text-ink">
            <ArrowLeft aria-hidden="true" className="size-4.5" />
            Back to website
          </Link>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 border-b border-line bg-night/85 backdrop-blur-md">
          <div className="flex h-16 items-center gap-3 px-5 md:px-8">
            <div className="lg:hidden">
              <Wordmark to="/app" compact />
            </div>
            <p className="hidden min-w-0 flex-1 truncate text-sm text-ink-subtle lg:block">
              Workspace / <span className="font-medium text-ink">{sectionFor(pathname)}</span>
            </p>
            <span className="flex-1 lg:hidden" />
            <ThemeToggle className="lg:hidden" />
            <AccountMenu />
          </div>
        </header>

        {/* pb-28 / pb-36: room to scroll the last controls above a notification and the bottom bar. */}
        <div className="app-main mx-auto w-full max-w-[80rem] px-5 pt-6 pb-36 md:px-8 lg:pt-8 lg:pb-28">
          <main id="main" ref={mainRef} tabIndex={-1} className="min-w-0 focus:outline-none">
            <Outlet />
          </main>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/90 px-2 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden">
        <AppNav variant="bar" />
      </div>
    </div>
  )
}
