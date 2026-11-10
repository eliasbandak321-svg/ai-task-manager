import type { TaskPriority, TaskStatus } from './schemas'

/*
  Display labels. Typed as Record<Union, string>, so adding a status or priority
  without a label is a compile error rather than a blank badge in the UI.
*/

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
}

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}
