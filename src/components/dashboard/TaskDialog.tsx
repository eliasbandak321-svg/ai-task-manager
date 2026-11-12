import { Trash2 } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import {
  createTaskInputSchema,
  isDomainError,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  updateTaskInputSchema,
  type Project,
  type Subtask,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type UpdateTaskInput,
} from '../../domain'
import { useCreateTask, useDeleteTask, useUpdateTask } from '../../hooks/queries'
import { useToast } from '../../hooks/toast'
import { errorMessage, fieldErrors, pluralize } from '../../lib/format'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Dialog } from '../ui/Dialog'
import { Field } from '../ui/Field'
import { controlClass } from '../ui/styles'
import { TaskAiHelp } from '../workspace/TaskAiHelp'
import { TaskPlanning } from '../workspace/TaskPlanning'
import { SubtaskList } from './SubtaskList'

type TaskDialogProps =
  | { mode: 'create'; defaultProjectId: string; projects: readonly Project[]; onClose: () => void }
  | { mode: 'edit'; task: Task; subtasks: readonly Subtask[]; allTasks: readonly Task[]; projects: readonly Project[]; onClose: () => void }

interface FormValues {
  title: string
  description: string
  projectId: string
  status: TaskStatus
  priority: TaskPriority
  /** '' means "no deadline" (that's what an empty date input gives). */
  dueDate: string
  /** Effort estimate in minutes; '' means unknown. */
  estimatedMinutes: string
}

const EDITABLE_FIELDS = ['title', 'description', 'projectId', 'status', 'priority', 'dueDate', 'estimatedMinutes'] as const

/**
 * Create a task with all its details, or view and edit an existing one. In edit mode the
 * dialog also holds the subtask checklist (saved immediately) and the delete action.
 */
export function TaskDialog(props: TaskDialogProps) {
  const { projects, onClose } = props
  const task = props.mode === 'edit' ? props.task : null
  const formId = useId()
  const [values, setValues] = useState<FormValues>(() => ({
    title: task?.title ?? '',
    description: task?.description ?? '',
    projectId: task?.projectId ?? (props.mode === 'create' ? props.defaultProjectId : ''),
    status: task?.status ?? 'todo',
    priority: task?.priority ?? 'medium',
    dueDate: task?.dueDate ?? '',
    estimatedMinutes: task?.estimatedMinutes ? String(task.estimatedMinutes) : '',
  }))
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const toast = useToast()
  const saving = createTask.isPending || updateTask.isPending

  const set = <K extends keyof FormValues>(field: K, value: FormValues[K]) =>
    setValues((current) => ({ ...current, [field]: value }))

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)
    const input = {
      ...values,
      dueDate: values.dueDate === '' ? null : values.dueDate,
      estimatedMinutes: values.estimatedMinutes.trim() === '' ? null : Number(values.estimatedMinutes),
    }

    try {
      if (!task) {
        const parsed = createTaskInputSchema.safeParse(input)
        if (!parsed.success) return setErrors(fieldErrors(parsed.error))
        setErrors({})
        const created = await createTask.mutateAsync(parsed.data)
        toast(`Created “${created.title}”`)
      } else {
        const parsed = updateTaskInputSchema.safeParse(input)
        if (!parsed.success) return setErrors(fieldErrors(parsed.error))
        setErrors({})
        // Send only what changed: smaller requests, and no accidental overwrites.
        const changes: UpdateTaskInput = {}
        for (const field of EDITABLE_FIELDS) {
          if (parsed.data[field] !== task[field]) Object.assign(changes, { [field]: parsed.data[field] })
        }
        if (Object.keys(changes).length > 0) {
          await updateTask.mutateAsync({ id: task.id, input: changes })
          toast('Task saved')
        }
      }
      onClose()
    } catch (caught) {
      setFormError(isDomainError(caught) ? caught.message : errorMessage(caught))
    }
  }

  return (
    <Dialog title={task ? 'Task details' : 'New task'} onClose={onClose}>
      <form id={formId} onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
        <Field label="Title" error={errors.title}>
          {(control) => (
            <input
              {...control}
              data-autofocus
              value={values.title}
              onChange={(event) => set('title', event.target.value)}
              autoComplete="off"
              className={controlClass}
            />
          )}
        </Field>
        <Field label="Description" hint="Optional" error={errors.description}>
          {(control) => (
            <textarea
              {...control}
              rows={3}
              value={values.description}
              onChange={(event) => set('description', event.target.value)}
              className={`${controlClass} py-2`}
            />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Project" error={errors.projectId}>
            {(control) => (
              <select
                {...control}
                value={values.projectId}
                onChange={(event) => set('projectId', event.target.value)}
                className={controlClass}
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Status" error={errors.status}>
            {(control) => (
              <select
                {...control}
                value={values.status}
                onChange={(event) => set('status', event.target.value as TaskStatus)}
                className={controlClass}
              >
                {TASK_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Priority" error={errors.priority}>
            {(control) => (
              <select
                {...control}
                value={values.priority}
                onChange={(event) => set('priority', event.target.value as TaskPriority)}
                className={controlClass}
              >
                {[...TASK_PRIORITIES].reverse().map((priority) => (
                  <option key={priority} value={priority}>
                    {PRIORITY_LABELS[priority]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Deadline" hint="Optional" error={errors.dueDate}>
            {(control) => (
              <input
                {...control}
                type="date"
                value={values.dueDate}
                onChange={(event) => set('dueDate', event.target.value)}
                className={controlClass}
              />
            )}
          </Field>
          <Field label="Estimate (minutes)" hint="Optional; used by the scheduler" error={errors.estimatedMinutes}>
            {(control) => (
              <input
                {...control}
                type="number"
                inputMode="numeric"
                min={5}
                max={6000}
                step={5}
                value={values.estimatedMinutes}
                onChange={(event) => set('estimatedMinutes', event.target.value)}
                className={controlClass}
              />
            )}
          </Field>
        </div>
      </form>

      {props.mode === 'edit' && task && <SubtaskList task={task} subtasks={props.subtasks} />}
      {props.mode === 'edit' && task && <TaskPlanning task={task} tasks={props.allTasks} />}
      {props.mode === 'edit' && task && <TaskAiHelp task={task} />}

      {formError && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {formError}
        </p>
      )}

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        {task && (
          <Button variant="ghost" onClick={() => setConfirmingDelete(true)} className="sm:mr-auto">
            <Trash2 aria-hidden="true" className="size-4" />
            Delete task
          </Button>
        )}
        <Button variant="secondary" onClick={onClose} className={task ? '' : 'sm:ml-auto'}>
          Cancel
        </Button>
        <Button type="submit" form={formId} variant="primary" disabled={saving}>
          {saving ? 'Saving…' : task ? 'Save changes' : 'Create task'}
        </Button>
      </div>

      {task && confirmingDelete && (
        <ConfirmDialog
          title={`Delete “${task.title}”?`}
          description={
            <p>
              This permanently deletes the task
              {props.mode === 'edit' && props.subtasks.length > 0
                ? ` and its ${pluralize(props.subtasks.length, 'subtask')}`
                : ''}
              . This can't be undone. Calendar sessions linked to it stay on your calendar.
            </p>
          }
          confirmLabel="Delete task"
          pending={deleteTask.isPending}
          error={deleteTask.isError ? errorMessage(deleteTask.error) : null}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={async () => {
            try {
              await deleteTask.mutateAsync(task.id)
              toast(`Deleted “${task.title}”`)
              onClose()
            } catch {
              // Shown in the confirmation dialog through deleteTask.error.
            }
          }}
        />
      )}
    </Dialog>
  )
}
