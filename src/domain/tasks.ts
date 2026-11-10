import type { CreateContext } from './context'
import { toTimestamp } from './dates'
import { DomainError } from './errors'
import type { CreateTaskInput, Project, Subtask, Task, TaskStatus, UpdateTaskInput } from './schemas'

/*
  Task rules (docs/architecture.md §4):
  - A task always belongs to one of its owner's projects.
  - Any status can change to any other (To do ⇄ In progress ⇄ Done).
  - completedAt is set when a task becomes Done, cleared when it leaves Done,
    and kept unchanged while it stays Done. Users never set it directly.
  - Completing all subtasks does not complete the task automatically; that stays the user's choice.
*/

/** Finds a project owned by `userId`. Another user's project is reported as not found, like a missing one. */
function findOwnedProject(projects: readonly Project[], projectId: string, userId: string): Project {
  const project = projects.find((candidate) => candidate.id === projectId && candidate.userId === userId)
  if (!project) {
    throw new DomainError('NOT_FOUND', 'Project not found')
  }
  return project
}

function completedAtFor(previous: Task | null, status: TaskStatus, timestamp: string): string | null {
  if (status !== 'done') return null
  return previous?.status === 'done' ? previous.completedAt : timestamp
}

/** Creates a task in one of the user's projects. */
export function createTask(input: CreateTaskInput, projects: readonly Project[], ctx: CreateContext): Task {
  findOwnedProject(projects, input.projectId, ctx.userId)
  const timestamp = toTimestamp(ctx.now)
  return {
    id: ctx.id,
    userId: ctx.userId,
    projectId: input.projectId,
    title: input.title,
    description: input.description,
    status: input.status,
    priority: input.priority,
    dueDate: input.dueDate,
    completedAt: completedAtFor(null, input.status, timestamp),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

const UPDATABLE_FIELDS = ['projectId', 'title', 'description', 'status', 'priority', 'dueDate'] as const

/**
 * Applies a partial update. Returns the *same object* when no field actually changes, so callers
 * (and React) can cheaply detect a no-op and skip saving.
 */
export function updateTask(task: Task, patch: UpdateTaskInput, projects: readonly Project[], now: Date): Task {
  const changed = UPDATABLE_FIELDS.filter((field) => patch[field] !== undefined && patch[field] !== task[field])
  if (changed.length === 0) return task

  if (patch.projectId !== undefined && patch.projectId !== task.projectId) {
    findOwnedProject(projects, patch.projectId, task.userId)
  }

  const timestamp = toTimestamp(now)
  const next: Task = { ...task, updatedAt: timestamp }
  for (const field of changed) {
    Object.assign(next, { [field]: patch[field] })
  }
  next.completedAt = completedAtFor(task, next.status, timestamp)
  return next
}

/** Shortcut for the most common update: changing the status. */
export function setTaskStatus(task: Task, status: TaskStatus, now: Date): Task {
  if (status === task.status) return task
  // Moving between projects isn't involved, so no project list is needed.
  return updateTask(task, { status }, [], now)
}

/** What deleting a task removes: the task and its own subtasks. */
export interface TaskDeletionPlan {
  taskId: string
  subtaskIds: string[]
}

export function planTaskDeletion(task: Task, subtasks: readonly Subtask[]): TaskDeletionPlan {
  const subtaskIds = subtasks
    .filter((subtask) => subtask.taskId === task.id && subtask.userId === task.userId)
    .map((subtask) => subtask.id)
  return { taskId: task.id, subtaskIds }
}
