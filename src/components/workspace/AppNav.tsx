import { BarChart3, CalendarDays, FolderKanban, LayoutDashboard, Settings, Sparkles, type LucideIcon } from 'lucide-react'
import { NavLink } from 'react-router'

const ITEMS: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/app/projects', label: 'Projects', icon: FolderKanban },
  { to: '/app/assistant', label: 'AI Assistant', icon: Sparkles },
  { to: '/app/insights', label: 'Insights', icon: BarChart3 },
  { to: '/app/settings', label: 'Settings', icon: Settings },
]

/**
 * The app's main navigation. One row of links: on small screens it scrolls sideways, so every
 * section stays one tap away. The current page is marked with aria-current (NavLink).
 */
export function AppNav() {
  return (
    <nav aria-label="Main" className="border-b border-line">
      <ul className="-mb-px flex gap-1 overflow-x-auto px-1">
        {ITEMS.map(({ to, label, icon: Icon, end }) => (
          <li key={to} className="shrink-0">
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors duration-(--duration-fast) ${
                  isActive ? 'border-glow text-ink' : 'border-transparent text-ink-muted hover:text-ink'
                }`
              }
            >
              <Icon aria-hidden="true" className="size-4" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
