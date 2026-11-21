import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../lib/theme'

interface ThemeToggleProps {
  /** Show the text label next to the icon (used in the app sidebar). */
  showLabel?: boolean
  className?: string
}

/** Switches between light and dark. The label always names the theme you will get. */
export function ThemeToggle({ showLabel = false, className = '' }: ThemeToggleProps) {
  const { theme, setPreference } = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'
  const label = `Switch to ${next} theme`
  const Icon = theme === 'dark' ? Sun : Moon
  return (
    <button
      type="button"
      onClick={() => setPreference(next)}
      aria-label={showLabel ? undefined : label}
      title={showLabel ? undefined : label}
      className={`inline-flex min-h-10 items-center gap-3 rounded-full text-sm text-ink-muted transition-colors duration-(--duration-fast) hover:text-ink ${
        showLabel ? 'w-full rounded-xl px-3 hover:bg-raised' : 'size-10 justify-center border border-line-strong bg-surface/70 hover:border-ink'
      } ${className}`}
    >
      <Icon aria-hidden="true" className="size-4.5 shrink-0" />
      {showLabel && <span>{next === 'dark' ? 'Dark theme' : 'Light theme'}</span>}
    </button>
  )
}
