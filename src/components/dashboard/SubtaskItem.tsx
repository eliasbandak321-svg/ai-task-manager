import { ArrowDown, ArrowUp, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { updateSubtaskInputSchema, type Subtask } from '../../domain'
import { useDeleteSubtask, useUpdateSubtask } from '../../hooks/queries'
import { useToast } from '../../hooks/toast'
import { errorMessage } from '../../lib/format'
import { Button } from '../ui/Button'
import { checkboxClass, controlClass } from '../ui/styles'

interface SubtaskItemProps {
  subtask: Subtask
  canMoveUp: boolean
  canMoveDown: boolean
  onMove: (offset: -1 | 1) => void
}

/** One checklist row: check off, rename inline, move up or down, or delete. */
export function SubtaskItem({ subtask, canMoveUp, canMoveDown, onMove }: SubtaskItemProps) {
  const updateSubtask = useUpdateSubtask()
  const deleteSubtask = useDeleteSubtask()
  const toast = useToast()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(subtask.title)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const editButtonRef = useRef<HTMLButtonElement>(null)
  const onError = (caught: unknown) => toast(errorMessage(caught), 'error')

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  function stopEditing() {
    setEditing(false)
    setError(null)
    // Return focus to the button that started editing (it re-renders on the next frame).
    window.requestAnimationFrame(() => editButtonRef.current?.focus())
  }

  function handleRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const parsed = updateSubtaskInputSchema.safeParse({ title: draft })
    if (!parsed.success) {
      setError(errorMessage(parsed.error))
      return
    }
    if (parsed.data.title !== subtask.title) {
      updateSubtask.mutate({ id: subtask.id, input: parsed.data }, { onError })
    }
    stopEditing()
  }

  if (editing) {
    return (
      <li>
        <form onSubmit={handleRename} noValidate className="flex flex-wrap gap-2 py-1">
          <label htmlFor={`${subtask.id}-title`} className="sr-only">
            Subtask title
          </label>
          <input
            ref={inputRef}
            id={`${subtask.id}-title`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // Escape cancels the rename only; preventDefault stops it from closing the dialog.
              if (event.key === 'Escape') {
                event.preventDefault()
                setDraft(subtask.title)
                stopEditing()
              }
            }}
            aria-invalid={error !== null}
            className={`${controlClass} min-w-0 flex-1 basis-48`}
          />
          <div className="flex gap-2">
            <Button type="submit" variant="primary">
              Save
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setDraft(subtask.title)
                stopEditing()
              }}
            >
              Cancel
            </Button>
          </div>
          {error && <p className="w-full text-sm text-danger">{error}</p>}
        </form>
      </li>
    )
  }

  return (
    // On narrow screens the buttons wrap onto their own row, so the title keeps enough width.
    <li className="flex flex-wrap items-center gap-x-1">
      <label className="flex min-h-11 min-w-0 flex-1 basis-40 cursor-pointer items-center gap-3 rounded-control px-2 hover:bg-raised/60">
        <input
          type="checkbox"
          className={checkboxClass}
          checked={subtask.done}
          onChange={(event) => updateSubtask.mutate({ id: subtask.id, input: { done: event.target.checked } }, { onError })}
        />
        <span className={`min-w-0 break-words text-sm ${subtask.done ? 'text-ink-subtle line-through' : 'text-ink'}`}>
          {subtask.title}
        </span>
      </label>
      <div className="ml-auto flex">
        <Button
          ref={editButtonRef}
          variant="ghost"
          iconOnly
          aria-label={`Rename “${subtask.title}”`}
          onClick={() => {
            setDraft(subtask.title)
            setEditing(true)
          }}
        >
          <Pencil aria-hidden="true" className="size-4" />
        </Button>
        <Button
          id={`${subtask.id}-up`}
          variant="ghost"
          iconOnly
          aria-label={`Move “${subtask.title}” up`}
          disabled={!canMoveUp}
          onClick={() => onMove(-1)}
        >
          <ArrowUp aria-hidden="true" className="size-4" />
        </Button>
        <Button
          id={`${subtask.id}-down`}
          variant="ghost"
          iconOnly
          aria-label={`Move “${subtask.title}” down`}
          disabled={!canMoveDown}
          onClick={() => onMove(1)}
        >
          <ArrowDown aria-hidden="true" className="size-4" />
        </Button>
        <Button
          variant="ghost"
          iconOnly
          aria-label={`Delete “${subtask.title}”`}
          // mutateAsync, not mutate callbacks: this row unmounts once the subtask is gone.
          onClick={() =>
            deleteSubtask.mutateAsync(subtask.id).then(() => toast(`Deleted subtask “${subtask.title}”`), onError)
          }
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </li>
  )
}
