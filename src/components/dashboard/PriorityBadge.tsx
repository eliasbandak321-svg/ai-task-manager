import { Flag } from 'lucide-react'
import { PRIORITY_LABELS, type TaskPriority } from '../../domain'

const colour: Record<TaskPriority, string> = {
  high: 'text-priority-high',
  medium: 'text-priority-medium',
  low: 'text-priority-low',
}

/** Priority as an icon and a text label: colour is never the only signal (docs/design.md §2). */
export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${colour[priority]}`}>
      <Flag aria-hidden="true" className="size-3.5" />
      {PRIORITY_LABELS[priority]} priority
    </span>
  )
}
