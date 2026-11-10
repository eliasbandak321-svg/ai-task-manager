import { LIMITS } from './constants'
import type { CreateContext } from './context'
import { DomainError } from './errors'
import type { CreateSubtaskInput, Subtask, Task, UpdateSubtaskInput } from './schemas'

/*
  Subtasks are a simple one-level checklist inside a task (docs/architecture.md §4).
  `position` only defines the order; gaps are fine (deleting doesn't renumber the rest),
  which means a delete never has to rewrite the other rows.
*/

/** The task's own subtasks, in display order. Ignores rows owned by another user. */
export function getTaskSubtasks(subtasks: readonly Subtask[], task: Task): Subtask[] {
  return subtasks
    .filter((subtask) => subtask.taskId === task.id && subtask.userId === task.userId)
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id))
}

/** Adds a subtask at the end of the task's checklist. */
export function addSubtask(
  task: Task,
  subtasks: readonly Subtask[],
  input: CreateSubtaskInput,
  ctx: Omit<CreateContext, 'now'>,
): Subtask {
  if (task.userId !== ctx.userId) {
    throw new DomainError('NOT_FOUND', 'Task not found')
  }
  const siblings = getTaskSubtasks(subtasks, task)
  if (siblings.length >= LIMITS.subtasksPerTask) {
    throw new DomainError('SUBTASK_LIMIT_REACHED', `A task can have at most ${LIMITS.subtasksPerTask} subtasks`)
  }
  const lastPosition = siblings.at(-1)?.position ?? -1
  return { id: ctx.id, userId: ctx.userId, taskId: task.id, title: input.title, done: false, position: lastPosition + 1 }
}

/** Renames and/or checks off a subtask. Returns the same object if nothing changes. */
export function updateSubtask(subtask: Subtask, patch: UpdateSubtaskInput): Subtask {
  const title = patch.title ?? subtask.title
  const done = patch.done ?? subtask.done
  if (title === subtask.title && done === subtask.done) return subtask
  return { ...subtask, title, done }
}

/**
 * Reorders a task's subtasks. `orderedIds` must contain each of the task's subtask ids
 * exactly once; positions become 0, 1, 2, ...
 */
export function reorderSubtasks(task: Task, subtasks: readonly Subtask[], orderedIds: readonly string[]): Subtask[] {
  const own = getTaskSubtasks(subtasks, task)
  const byId = new Map(own.map((subtask) => [subtask.id, subtask]))
  const isPermutation =
    orderedIds.length === own.length &&
    new Set(orderedIds).size === orderedIds.length &&
    orderedIds.every((id) => byId.has(id))

  if (!isPermutation) {
    throw new DomainError('INVALID_SUBTASK_ORDER', "The new order must list each of the task's subtasks exactly once")
  }
  return orderedIds.map((id, position) => ({ ...(byId.get(id) as Subtask), position }))
}

/** Checklist progress, e.g. { done: 2, total: 5 }. */
export function subtaskProgress(subtasks: readonly Subtask[]): { done: number; total: number } {
  return { done: subtasks.filter((subtask) => subtask.done).length, total: subtasks.length }
}
