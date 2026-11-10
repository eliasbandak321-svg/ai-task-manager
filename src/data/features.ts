import { ChartNoAxesColumn, Columns3, Flag, Plus, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react'

export interface Feature {
  title: string
  description: string
  icon: LucideIcon
  /** Planned but not built yet; shows a "Coming soon" badge. */
  comingSoon?: boolean
}

/** Landing page feature cards. Copy is approved in docs/design.md §7. */
export const features: readonly Feature[] = [
  {
    title: 'Capture in seconds',
    description: 'Add a task in one line and get back to work. Keyboard-first.',
    icon: Plus,
  },
  {
    title: 'Clear statuses',
    description: 'Move work from To do to In progress to Done at a glance.',
    icon: Columns3,
  },
  {
    title: 'Priorities that matter',
    description: 'Mark what is urgent and filter out the noise.',
    icon: Flag,
  },
  {
    title: 'Progress you can see',
    description: 'Live statistics and a progress bar keep momentum visible.',
    icon: ChartNoAxesColumn,
  },
  {
    title: 'Private by default',
    description: 'Your tasks stay in your browser. No account, no tracking.',
    icon: ShieldCheck,
  },
  {
    title: 'Break it down with AI',
    description: 'Split big tasks into concrete next steps.',
    icon: Sparkles,
    comingSoon: true,
  },
]
