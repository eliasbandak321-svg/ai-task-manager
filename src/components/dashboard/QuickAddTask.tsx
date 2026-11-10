import { Plus } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { createTaskInputSchema } from '../../domain'
import { useCreateTask } from '../../hooks/queries'
import { useToast } from '../../hooks/toast'
import { errorMessage } from '../../lib/format'
import { Button } from '../ui/Button'
import { controlClass } from '../ui/styles'

interface QuickAddTaskProps {
  projectId: string
  projectName: string
}

/** One-line task capture (landing page feature 01): type a title, press Enter, keep going. */
export function QuickAddTask({ projectId, projectName }: QuickAddTaskProps) {
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)
  const createTask = useCreateTask()
  const toast = useToast()
  const inputId = useId()
  const errorId = `${inputId}-error`

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = createTaskInputSchema.shape.title.safeParse(title)
    if (!parsed.success) {
      setError(errorMessage(parsed.error))
      return
    }
    createTask.mutate(
      { projectId, title: parsed.data },
      {
        onSuccess: (task) => {
          setTitle('')
          setError(null)
          toast(`Added “${task.title}” to ${projectName}`)
        },
        onError: (caught) => setError(errorMessage(caught)),
      },
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <label htmlFor={inputId} className="sr-only">
        Add a task to {projectName}
      </label>
      <div className="flex gap-2">
        <input
          id={inputId}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={`Add a task to ${projectName}…`}
          autoComplete="off"
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          className={controlClass}
        />
        <Button type="submit" variant="secondary" disabled={createTask.isPending}>
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
  )
}
