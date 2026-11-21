import { NavLink } from 'react-router'
import { NAV_ITEMS } from './navItems'


interface AppNavProps {
  /** "sidebar" on large screens, "bar" for the bottom bar on phones and tablets. */
  variant: 'sidebar' | 'bar'
  className?: string
}

/**
 * The app's main navigation (M10). The same links render as the desktop sidebar and as the
 * bottom bar on small screens; only one of them is visible at a time, and both are named "Main".
 * The current page is marked with aria-current (NavLink).
 */
export function AppNav({ variant, className = '' }: AppNavProps) {
  if (variant === 'bar') {
    return (
      <nav aria-label="Main" className={className}>
        <ul className="grid grid-cols-6 gap-1">
          {NAV_ITEMS.map(({ to, short, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                aria-label={label}
                className={({ isActive }) =>
                  `flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-[0.6875rem] font-medium transition-colors duration-(--duration-fast) ${
                    isActive ? 'bg-raised text-ink' : 'text-ink-subtle hover:text-ink'
                  }`
                }
              >
                <Icon aria-hidden="true" className="size-5" />
                <span className="max-w-full truncate">{short}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    )
  }
  return (
    <nav aria-label="Main" className={className}>
      <ul className="flex flex-col gap-0.5">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                `relative flex min-h-10 items-center gap-3 rounded-xl px-3 text-[0.9375rem] transition-colors duration-(--duration-fast) ${
                  isActive
                    ? 'nav-active bg-surface font-medium text-ink shadow-soft ring-1 ring-line'
                    : 'text-ink-muted hover:bg-raised hover:text-ink'
                }`
              }
            >
              <Icon aria-hidden="true" className="size-4.5 shrink-0" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
