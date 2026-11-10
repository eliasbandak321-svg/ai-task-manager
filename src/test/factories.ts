import type { Project, Subtask, Task } from '../domain'

/*
  Test data builders. Each returns a valid entity with sensible defaults; tests override
  only the fields they care about, which keeps every test focused on one idea.
  IDs are deterministic (a counter), so failures are reproducible.
*/

export const USER_A = '00000000-0000-4000-8000-00000000000a'
export const USER_B = '00000000-0000-4000-8000-00000000000b'
export const T0 = '2026-01-01T09:00:00.000Z'

let counter = 0

/** A valid, unique UUID v4-shaped id. */
export function nextId(): string {
  counter += 1
  return `00000000-0000-4000-8000-${counter.toString(16).padStart(12, '0')}`
}

export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: nextId(),
    userId: USER_A,
    name: `Project ${counter}`,
    isInbox: false,
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
  }
}

export function makeTask(overrides: Partial<Task> = {}): Task {
  const status = overrides.status ?? 'todo'
  return {
    id: nextId(),
    userId: USER_A,
    projectId: nextId(),
    title: `Task ${counter}`,
    description: '',
    priority: 'medium',
    dueDate: null,
    createdAt: T0,
    updatedAt: T0,
    ...overrides,
    status,
    // Keep the "completedAt is set exactly when done" invariant unless a test overrides it.
    completedAt: overrides.completedAt !== undefined ? overrides.completedAt : status === 'done' ? T0 : null,
  }
}

export function makeSubtask(overrides: Partial<Subtask> = {}): Subtask {
  return {
    id: nextId(),
    userId: USER_A,
    taskId: nextId(),
    title: `Subtask ${counter}`,
    done: false,
    position: 0,
    ...overrides,
  }
}
