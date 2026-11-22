import { BarChart3, CalendarDays, FolderKanban, LayoutDashboard, Settings, Sparkles, type LucideIcon } from 'lucide-react'

/** The app's sections, in navigation order (M10). */
export const NAV_ITEMS: { to: string; label: string; short: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/app', label: 'Today', short: 'Today', icon: LayoutDashboard, end: true },
  { to: '/app/projects', label: 'Projects', short: 'Projects', icon: FolderKanban },
  { to: '/app/calendar', label: 'Calendar', short: 'Calendar', icon: CalendarDays },
  { to: '/app/assistant', label: 'AI Assistant', short: 'Assistant', icon: Sparkles },
  { to: '/app/insights', label: 'Insights', short: 'Insights', icon: BarChart3 },
  { to: '/app/settings', label: 'Settings', short: 'Settings', icon: Settings },
]
