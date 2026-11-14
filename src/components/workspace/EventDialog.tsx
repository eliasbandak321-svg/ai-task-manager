import { useState, type FormEvent } from 'react'
import {
  createEventInputSchema,
  EVENT_CATEGORIES,
  EVENT_CATEGORY_LABELS,
  type CalendarEvent,
  type EditScope,
  type EventCategory,
  type Recurrence,
  type Task,
  zonedParts,
} from '../../domain'
import { useToast } from '../../hooks/toast'
import { useCreateEvent, useDeleteEvent, useUpdateEvent, useUserTimeZone } from '../../hooks/workspaceQueries'
import { errorMessage } from '../../lib/format'
import { fromLocalInput, toLocalInput } from '../../lib/time'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { Field } from '../ui/Field'
import { checkboxClass, controlClass } from '../ui/styles'

export type EventDialogState =
  | { mode: 'create'; start: string; end: string; taskId?: string | null; category?: EventCategory; title?: string }
  | { mode: 'edit'; event: CalendarEvent; occurrenceStart: string; occurrenceEnd: string }

interface EventDialogProps {
  state: EventDialogState
  tasks: readonly Task[]
  onClose: () => void
}

type Repeat = 'none' | Recurrence['freq']
type Ends = 'never' | 'until' | 'count'
const WEEKDAY_SHORT = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
]
const SCOPE_LABELS: Record<EditScope, string> = {
  occurrence: 'Only this event',
  following: 'This and following events',
  series: 'All events in the series',
}

/**
 * Create or edit a calendar event. For a recurring event, the user chooses whether the change
 * applies to this occurrence, this and the following ones, or the whole series.
 */
export function EventDialog({ state, tasks, onClose }: EventDialogProps) {
  // Times are entered and shown in the user's time zone (settings), not the device's.
  const timeZone = useUserTimeZone()
  const existing = state.mode === 'edit' ? state.event : null
  const recurring = existing?.recurrence ?? null
  const [title, setTitle] = useState(existing?.title ?? (state.mode === 'create' ? (state.title ?? '') : ''))
  const [description, setDescription] = useState(existing?.description ?? '')
  const [category, setCategory] = useState<EventCategory>(existing?.category ?? (state.mode === 'create' ? (state.category ?? 'work_session') : 'other'))
  const [start, setStart] = useState(toLocalInput(state.mode === 'edit' ? state.occurrenceStart : state.start, timeZone))
  const [end, setEnd] = useState(toLocalInput(state.mode === 'edit' ? state.occurrenceEnd : state.end, timeZone))
  const [taskId, setTaskId] = useState<string>(existing ? (existing.taskId ?? '') : state.mode === 'create' ? (state.taskId ?? '') : '')
  const [repeat, setRepeat] = useState<Repeat>(recurring?.freq ?? 'none')
  const [interval, setRepeatInterval] = useState(recurring?.interval ?? 1)
  const [weekdays, setWeekdays] = useState<number[]>(recurring?.byWeekday ?? [zonedParts(new Date(state.mode === 'edit' ? state.occurrenceStart : state.start), timeZone).weekday])
  const [ends, setEnds] = useState<Ends>(recurring?.until ? 'until' : recurring?.count ? 'count' : 'never')
  const [until, setUntil] = useState(recurring?.until ?? '')
  const [count, setCount] = useState(recurring?.count ?? 10)
  const [scope, setScope] = useState<EditScope>('occurrence')
  const [error, setError] = useState<string | null>(null)
  const createEvent = useCreateEvent()
  const updateEvent = useUpdateEvent()
  const deleteEvent = useDeleteEvent()
  const showToast = useToast()
  const busy = createEvent.isPending || updateEvent.isPending || deleteEvent.isPending
  const canRepeat = !recurring || scope !== 'occurrence'
  const openTasks = tasks.filter((task) => task.status !== 'done' || task.id === taskId)

  function recurrence(): Recurrence | null {
    if (repeat === 'none') return null
    return {
      freq: repeat,
      interval,
      byWeekday: repeat === 'weekly' ? weekdays : null,
      until: ends === 'until' && until ? until : null,
      count: ends === 'count' ? count : null,
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const startAt = fromLocalInput(start, timeZone)
    const endAt = fromLocalInput(end, timeZone)
    if (!startAt || !endAt) {
      setError('Enter a valid start and end.')
      return
    }
    const input = {
      title,
      description,
      category,
      startAt,
      endAt,
      // A repeating event keeps the zone it repeats in; new events use the user's zone.
      timeZone: existing?.timeZone ?? timeZone,
      taskId: taskId || null,
      recurrence: canRepeat ? recurrence() : null,
    }
    const parsed = createEventInputSchema.safeParse(input)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the event details.')
      return
    }
    setError(null)
    try {
      if (state.mode === 'create') {
        await createEvent.mutateAsync(parsed.data)
        showToast('Event added.')
      } else {
        const { timeZone: _timeZone, ...changes } = parsed.data
        const change = recurring ? { scope, occurrenceStart: state.occurrenceStart, changes: scope === 'occurrence' ? { ...changes, recurrence: undefined } : changes } : { changes }
        await updateEvent.mutateAsync({ id: state.event.id, change })
        showToast('Event updated.')
      }
      onClose()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  async function remove() {
    if (state.mode !== 'edit') return
    try {
      await deleteEvent.mutateAsync({ id: state.event.id, scope: recurring ? scope : 'series', occurrenceStart: state.occurrenceStart })
      showToast('Event deleted.')
      onClose()
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <Dialog title={state.mode === 'create' ? 'New event' : 'Edit event'} onClose={onClose}>
      <form onSubmit={submit} noValidate className="mt-4 space-y-4">
        {recurring && (
          <fieldset>
            <legend className="text-sm font-medium text-ink">This is a repeating event. Apply changes to:</legend>
            <div className="mt-2 space-y-1">
              {(['occurrence', 'following', 'series'] as const).map((value) => (
                <label key={value} className="flex min-h-11 items-center gap-3 text-sm text-ink">
                  <input type="radio" name="scope" className={checkboxClass} checked={scope === value} onChange={() => setScope(value)} />
                  {SCOPE_LABELS[value]}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <Field label="Title">
          {(control) => <input {...control} data-autofocus className={controlClass} value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} />}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts">
            {(control) => <input {...control} type="datetime-local" className={controlClass} value={start} onChange={(e) => setStart(e.target.value)} />}
          </Field>
          <Field label="Ends">
            {(control) => <input {...control} type="datetime-local" className={controlClass} value={end} onChange={(e) => setEnd(e.target.value)} />}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category">
            {(control) => (
              <select {...control} className={controlClass} value={category} onChange={(e) => setCategory(e.target.value as EventCategory)}>
                {EVENT_CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {EVENT_CATEGORY_LABELS[value]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Linked task" hint="Optional: time reserved for a task">
            {(control) => (
              <select {...control} className={controlClass} value={taskId} onChange={(e) => setTaskId(e.target.value)}>
                <option value="">No task</option>
                {openTasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>

        <Field label="Notes">
          {(control) => <textarea {...control} rows={2} className={`${controlClass} py-2`} value={description} maxLength={2000} onChange={(e) => setDescription(e.target.value)} />}
        </Field>

        {canRepeat && (
          <fieldset className="space-y-3 rounded-control border border-line p-3">
            <legend className="px-1 text-sm font-medium text-ink">Repeat</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Repeats">
                {(control) => (
                  <select {...control} className={controlClass} value={repeat} onChange={(e) => setRepeat(e.target.value as Repeat)}>
                    <option value="none">Does not repeat</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly (same day)</option>
                  </select>
                )}
              </Field>
              {repeat !== 'none' && (
                <Field label="Every">
                  {(control) => (
                    <input {...control} type="number" min={1} max={52} className={controlClass} value={interval} onChange={(e) => setRepeatInterval(Math.max(1, Number(e.target.value)))} />
                  )}
                </Field>
              )}
            </div>
            {repeat === 'weekly' && (
              <fieldset>
                <legend className="text-sm text-ink">On</legend>
                <div className="mt-1 flex flex-wrap gap-2">
                  {WEEKDAY_SHORT.map((day) => (
                    <label key={day.value} className="flex min-h-11 items-center gap-2 rounded-control border border-line px-3 text-sm text-ink">
                      <input
                        type="checkbox"
                        className={checkboxClass}
                        checked={weekdays.includes(day.value)}
                        onChange={(e) => setWeekdays((current) => (e.target.checked ? [...current, day.value] : current.filter((d) => d !== day.value)))}
                      />
                      {day.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {repeat !== 'none' && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Ends">
                  {(control) => (
                    <select {...control} className={controlClass} value={ends} onChange={(e) => setEnds(e.target.value as Ends)}>
                      <option value="never">Never</option>
                      <option value="until">On a date</option>
                      <option value="count">After a number of times</option>
                    </select>
                  )}
                </Field>
                {ends === 'until' && (
                  <Field label="Last date">
                    {(control) => <input {...control} type="date" className={controlClass} value={until} onChange={(e) => setUntil(e.target.value)} />}
                  </Field>
                )}
                {ends === 'count' && (
                  <Field label="Times">
                    {(control) => <input {...control} type="number" min={1} max={1000} className={controlClass} value={count} onChange={(e) => setCount(Math.max(1, Number(e.target.value)))} />}
                  </Field>
                )}
              </div>
            )}
          </fieldset>
        )}

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex flex-wrap justify-between gap-2">
          {state.mode === 'edit' ? (
            <Button variant="danger" onClick={remove} disabled={busy}>
              {recurring ? `Delete (${SCOPE_LABELS[scope].toLowerCase()})` : 'Delete'}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  )
}
