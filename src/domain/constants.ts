/** The three task statuses, in workflow order. */
export const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const

/** Task priorities, from lowest to highest. */
export const TASK_PRIORITIES = ['low', 'medium', 'high'] as const

/**
 * Input size limits. They protect the database and UI from oversized input, and the same
 * numbers are enforced in the browser (forms) and on the server (API), because both use the
 * Zod schemas built from them.
 */
export const LIMITS = {
  projectName: 80,
  taskTitle: 200,
  taskDescription: 5000,
  subtaskTitle: 200,
  subtasksPerTask: 50,
  searchQuery: 200,
} as const

/** Name of the default project every user gets. Reserved: users can't create another one. */
export const INBOX_NAME = 'Inbox'

/** A deadline within this many days after today (excluding today) counts as "due soon". */
export const DUE_SOON_DAYS = 3
