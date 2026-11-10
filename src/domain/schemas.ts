import { z } from 'zod'
import { LIMITS, TASK_PRIORITIES, TASK_STATUSES } from './constants'

/*
  Zod schemas: one definition gives both runtime validation and TypeScript types
  (via z.infer), and the same schemas are shared by the browser and the API.

  Two families:
  - Entity schemas describe stored data (Project, Task, Subtask).
  - Input schemas describe what a user may send. They are *strict*: unknown keys are
    rejected, so a request can't sneak in server-owned fields like `userId` or `completedAt`
    (a "mass assignment" attack).
*/

// ---------- Building blocks ----------

export const idSchema = z.uuid()
export const isoDateSchema = z.iso.date() // YYYY-MM-DD, and a real calendar date
export const timestampSchema = z.iso.datetime() // ISO 8601 in UTC (ending in "Z")

export const taskStatusSchema = z.enum(TASK_STATUSES)
export const taskPrioritySchema = z.enum(TASK_PRIORITIES)

/** Trimmed, non-empty text with a maximum length. */
function requiredText(label: string, max: number) {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`)
}

const projectName = requiredText('Project name', LIMITS.projectName)
const taskTitle = requiredText('Title', LIMITS.taskTitle)
const taskDescription = z
  .string()
  .trim()
  .max(LIMITS.taskDescription, `Description must be at most ${LIMITS.taskDescription} characters`)
const subtaskTitle = requiredText('Subtask title', LIMITS.subtaskTitle)

/** Rejects `{}` for update inputs, so "nothing to update" is a validation error, not a silent no-op. */
function hasAtLeastOneField(value: object): boolean {
  return Object.values(value).some((field) => field !== undefined)
}
const AT_LEAST_ONE_FIELD = { message: 'Provide at least one field to update' }

// ---------- Entities ----------

export const projectSchema = z.object({
  id: idSchema,
  userId: idSchema,
  name: projectName,
  isInbox: z.boolean(),
  createdAt: timestampSchema,
  updatedAt: timestampSchema,
})

export const taskSchema = z
  .object({
    id: idSchema,
    userId: idSchema,
    projectId: idSchema,
    title: taskTitle,
    description: taskDescription,
    status: taskStatusSchema,
    priority: taskPrioritySchema,
    dueDate: isoDateSchema.nullable(),
    completedAt: timestampSchema.nullable(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .refine((task) => (task.status === 'done') === (task.completedAt !== null), {
    message: 'completedAt must be set exactly when the task is done',
    path: ['completedAt'],
  })

export const subtaskSchema = z.object({
  id: idSchema,
  userId: idSchema,
  taskId: idSchema,
  title: subtaskTitle,
  done: z.boolean(),
  position: z.int().nonnegative(),
})

// ---------- Inputs ----------

export const createProjectInputSchema = z.strictObject({ name: projectName })
export const updateProjectInputSchema = z.strictObject({ name: projectName })

export const createTaskInputSchema = z.strictObject({
  projectId: idSchema,
  title: taskTitle,
  description: taskDescription.default(''),
  status: taskStatusSchema.default('todo'),
  priority: taskPrioritySchema.default('medium'),
  dueDate: isoDateSchema.nullable().default(null),
})

export const updateTaskInputSchema = z
  .strictObject({
    projectId: idSchema,
    title: taskTitle,
    description: taskDescription,
    status: taskStatusSchema,
    priority: taskPrioritySchema,
    dueDate: isoDateSchema.nullable(), // null clears the deadline
  })
  .partial()
  .refine(hasAtLeastOneField, AT_LEAST_ONE_FIELD)

export const createSubtaskInputSchema = z.strictObject({ title: subtaskTitle })

export const updateSubtaskInputSchema = z
  .strictObject({ title: subtaskTitle, done: z.boolean() })
  .partial()
  .refine(hasAtLeastOneField, AT_LEAST_ONE_FIELD)

// ---------- Types ----------

export type TaskStatus = z.infer<typeof taskStatusSchema>
export type TaskPriority = z.infer<typeof taskPrioritySchema>
export type Project = z.infer<typeof projectSchema>
export type Task = z.infer<typeof taskSchema>
export type Subtask = z.infer<typeof subtaskSchema>

/*
  z.output is the type *after* parsing (defaults applied, strings trimmed): what domain
  functions receive. z.input is the type a form may send before parsing (defaults optional).
*/
export type CreateProjectInput = z.output<typeof createProjectInputSchema>
export type UpdateProjectInput = z.output<typeof updateProjectInputSchema>
export type CreateTaskInput = z.output<typeof createTaskInputSchema>
export type CreateTaskFormValues = z.input<typeof createTaskInputSchema>
export type UpdateTaskInput = z.output<typeof updateTaskInputSchema>
export type CreateSubtaskInput = z.output<typeof createSubtaskInputSchema>
export type UpdateSubtaskInput = z.output<typeof updateSubtaskInputSchema>
