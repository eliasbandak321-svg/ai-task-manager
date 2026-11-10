import { CalendarClock, CircleAlert } from 'lucide-react'
import type { DeadlineStatus } from '../../domain'
import type { DueLabel } from '../../lib/format'

const colour: Record<DeadlineStatus, string> = {
  overdue: 'text-danger',
  due_today: 'text-priority-medium',
  due_soon: 'text-glow',
  upcoming: 'text-ink-muted',
  none: 'text-ink-subtle',
}

/** The deadline as text ("Due tomorrow", "Overdue by 2 days"), coloured by urgency. */
export function DueBadge({ label }: { label: DueLabel }) {
  const Icon = label.status === 'overdue' ? CircleAlert : CalendarClock
  return (
    <span className={`inline-flex items-center gap-1.5 ${colour[label.status]}`}>
      <Icon aria-hidden="true" className="size-3.5" />
      {label.text}
    </span>
  )
}
