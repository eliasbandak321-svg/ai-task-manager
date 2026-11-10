import { Folder, ListChecks } from 'lucide-react'
import { useId } from 'react'
import { STATUS_LABELS, TASK_STATUSES, type IsoDate, type Task, type TaskStatus } from '../../domain'
import { useUpdateTask } from '../../hooks/queries'
import { useToast } from '../../hooks/toast'
import { dueLabel, errorMessage } from '../../lib/format'
import { controlClass } from '../ui/styles'
import { DueBadge } from './DueBadge'
import { PriorityBadge } from './PriorityBadge'

interface TaskItemProps {
  task: Task
  today: IsoDate
  subtasks: { done: number; total: number }
  /** Shown in the "All tasks" view, where tasks from every project are mixed. */
  projectName?: string
  onOpen: () => void
}

/** One task row: the title opens the details; the status can be changed right here. */
export function TaskItem({ task, today, subtasks, projectName, onOpen }: TaskItemProps) {
  const updateTask = useUpdateTask()
  const toast = useToast()
  const statusId = useId()
  const due = dueLabel(task, today)
  const isDone = task.status === 'done'

  // The row may disappear before the save finishes (e.g. a status filter hides it), so the
  // feedback runs off the promise rather than per-call callbacks (see hooks/queries.ts).
  async function changeStatus(status: TaskStatus) {
    try {
      const saved = await updateTask.mutateAsync({ id: task.id, input: { status } })
      if (saved.status === 'done') toast(`Completed “${saved.title}”`)
    } catch (error) {
      toast(errorMessage(error), 'error')
    }
  }

  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="min-w-0 flex-1">
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={onOpen}
          className={`max-w-full text-left font-medium break-words transition-colors duration-(--duration-fast) hover:text-glow ${
            isDone ? 'text-ink-subtle line-through' : 'text-ink'
          }`}
        >
          {task.title}
        </button>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
          <PriorityBadge priority={task.priority} />
          {due && <DueBadge label={due} />}
          {subtasks.total > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <ListChecks aria-hidden="true" className="size-3.5" />
              {subtasks.done}/{subtasks.total}
              <span className="sr-only"> subtasks done</span>
            </span>
          )}
          {projectName && (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <Folder aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="truncate">{projectName}</span>
            </span>
          )}
        </div>
      </div>
      <div className="sm:w-40">
        <label htmlFor={statusId} className="sr-only">
          Status of “{task.title}”
        </label>
        <select
          id={statusId}
          value={task.status}
          onChange={(event) => void changeStatus(event.target.value as TaskStatus)}
          className={controlClass}
        >
          {TASK_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>
    </li>
  )
}
