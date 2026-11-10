import { Plus } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { createSubtaskInputSchema, LIMITS, subtaskProgress, toPercent, type Subtask, type Task } from '../../domain'
import { useCreateSubtask, useReorderSubtasks } from '../../hooks/queries'
import { useToast } from '../../hooks/toast'
import { errorMessage } from '../../lib/format'
import { Button } from '../ui/Button'
import { ProgressBar } from '../ui/ProgressBar'
import { controlClass } from '../ui/styles'
import { SubtaskItem } from './SubtaskItem'

interface SubtaskListProps {
  task: Task
  /** The task's subtasks in display order (from getTaskSubtasks). */
  subtasks: readonly Subtask[]
}

/** The checklist inside a task. Every change is saved immediately. */
export function SubtaskList({ task, subtasks }: SubtaskListProps) {
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const createSubtask = useCreateSubtask()
  const reorderSubtasks = useReorderSubtasks()
  const toast = useToast()
  const headingId = useId()
  const inputId = useId()
  const errorId = `${inputId}-error`

  const progress = subtaskProgress(subtasks)
  const atLimit = subtasks.length >= LIMITS.subtasksPerTask

  function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = createSubtaskInputSchema.safeParse({ title })
    if (!parsed.success) {
      setError(errorMessage(parsed.error))
      return
    }
    createSubtask.mutate(
      { taskId: task.id, input: parsed.data },
      {
        onSuccess: () => {
          setTitle('')
          setError(null)
        },
        onError: (caught) => setError(errorMessage(caught)),
      },
    )
  }

  /** Swaps a subtask with its neighbour, then keeps keyboard focus on the moved item. */
  function move(index: number, offset: -1 | 1) {
    const ids = subtasks.map((subtask) => subtask.id)
    const target = index + offset
    ;[ids[index], ids[target]] = [ids[target], ids[index]]
    const movedId = ids[target]
    reorderSubtasks.mutate(
      { taskId: task.id, orderedIds: ids },
      { onError: (caught) => toast(errorMessage(caught), 'error') },
    )
    // React may move the focused DOM node while reordering; put focus back on a move button.
    window.requestAnimationFrame(() => {
      const preferred = document.getElementById(`${movedId}-${offset === -1 ? 'up' : 'down'}`)
      const fallback = document.getElementById(`${movedId}-${offset === -1 ? 'down' : 'up'}`)
      const button = preferred instanceof HTMLButtonElement && !preferred.disabled ? preferred : fallback
      button?.focus()
    })
  }

  return (
    <section aria-labelledby={headingId} className="mt-6 border-t border-line pt-5">
      <div className="flex items-baseline justify-between gap-4">
        <h3 id={headingId} className="font-semibold text-ink">
          Subtasks
        </h3>
        <p className="text-sm text-ink-muted">
          {progress.done} of {progress.total} done
        </p>
      </div>
      {progress.total > 0 && (
        <ProgressBar
          value={toPercent(progress.done, progress.total)}
          label="Subtask progress"
          valueText={`${progress.done} of ${progress.total} subtasks done`}
          className="mt-2"
        />
      )}

      {subtasks.length > 0 && (
        <ul className="mt-3 space-y-1">
          {subtasks.map((subtask, index) => (
            <SubtaskItem
              key={subtask.id}
              subtask={subtask}
              canMoveUp={index > 0}
              canMoveDown={index < subtasks.length - 1}
              onMove={(offset) => move(index, offset)}
            />
          ))}
        </ul>
      )}

      {atLimit ? (
        <p className="mt-3 text-sm text-ink-muted">This task has the maximum of {LIMITS.subtasksPerTask} subtasks.</p>
      ) : (
        <form onSubmit={handleAdd} noValidate className="mt-3">
          <label htmlFor={inputId} className="sr-only">
            New subtask
          </label>
          <div className="flex gap-2">
            <input
              id={inputId}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Add a subtask…"
              autoComplete="off"
              aria-invalid={error !== null}
              aria-describedby={error ? errorId : undefined}
              className={controlClass}
            />
            <Button type="submit" variant="secondary" disabled={createSubtask.isPending}>
              <Plus aria-hidden="true" className="size-4" />
              Add
            </Button>
          </div>
          {error && (
            <p id={errorId} className="mt-1.5 text-sm text-danger">
              {error}
            </p>
          )}
        </form>
      )}
      <p className="mt-2 text-xs text-ink-subtle">Subtask changes are saved immediately.</p>
    </section>
  )
}
