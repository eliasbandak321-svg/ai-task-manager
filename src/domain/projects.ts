import { INBOX_NAME } from './constants'
import type { CreateContext } from './context'
import { toTimestamp } from './dates'
import { DomainError } from './errors'
import type { CreateProjectInput, Project, Subtask, Task, UpdateProjectInput } from './schemas'

/*
  Project rules (docs/architecture.md §4):
  - Every user has exactly one Inbox, created at sign-up. It can't be renamed or deleted.
  - Project names are unique per user, ignoring case and surrounding whitespace.
  - "Inbox" is reserved, so a regular project can't impersonate it.
  - Deleting a project deletes its tasks and their subtasks (the UI asks for confirmation first).
*/

const nameCollator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })

// Plain toLowerCase, not toLocaleLowerCase: the result must be identical in every
// browser and on the server, whatever their locale (e.g. Turkish dotless "ı").
function normalizeName(name: string): string {
  return name.trim().toLowerCase()
}

function assertNameAllowed(name: string, userProjects: readonly Project[], exceptId?: string): void {
  if (normalizeName(name) === normalizeName(INBOX_NAME)) {
    throw new DomainError('RESERVED_PROJECT_NAME', `"${INBOX_NAME}" is reserved for your default project`)
  }
  const taken = userProjects.some(
    (project) => project.id !== exceptId && normalizeName(project.name) === normalizeName(name),
  )
  if (taken) {
    throw new DomainError('DUPLICATE_PROJECT_NAME', `You already have a project called "${name}"`)
  }
}

/** The default project created for every new user. */
export function createInboxProject({ id, userId, now }: CreateContext): Project {
  const timestamp = toTimestamp(now)
  return { id, userId, name: INBOX_NAME, isInbox: true, createdAt: timestamp, updatedAt: timestamp }
}

/**
 * Creates a regular project. `existing` may contain other users' projects; only the
 * current user's are considered for the uniqueness check.
 */
export function createProject(input: CreateProjectInput, existing: readonly Project[], ctx: CreateContext): Project {
  const userProjects = existing.filter((project) => project.userId === ctx.userId)
  assertNameAllowed(input.name, userProjects)
  const timestamp = toTimestamp(ctx.now)
  return {
    id: ctx.id,
    userId: ctx.userId,
    name: input.name,
    isInbox: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

/** Renames a project. Returns the same object if the name doesn't change. */
export function renameProject(
  project: Project,
  input: UpdateProjectInput,
  existing: readonly Project[],
  now: Date,
): Project {
  if (project.isInbox) {
    throw new DomainError('INBOX_PROTECTED', 'The Inbox cannot be renamed')
  }
  if (input.name === project.name) return project

  const userProjects = existing.filter((other) => other.userId === project.userId)
  assertNameAllowed(input.name, userProjects, project.id)
  return { ...project, name: input.name, updatedAt: toTimestamp(now) }
}

/** What deleting a project removes. The UI uses the counts for its confirmation message. */
export interface ProjectDeletionPlan {
  projectId: string
  taskIds: string[]
  subtaskIds: string[]
}

/**
 * Works out everything a project deletion removes, without deleting anything.
 * Only items owned by the project's user are included, even if foreign data
 * references the same ids.
 */
export function planProjectDeletion(
  project: Project,
  tasks: readonly Task[],
  subtasks: readonly Subtask[],
): ProjectDeletionPlan {
  if (project.isInbox) {
    throw new DomainError('INBOX_PROTECTED', 'The Inbox cannot be deleted')
  }
  const ownedBySameUser = (item: { userId: string }) => item.userId === project.userId

  const taskIds = tasks.filter((task) => ownedBySameUser(task) && task.projectId === project.id).map((task) => task.id)
  const taskIdSet = new Set(taskIds)
  const subtaskIds = subtasks
    .filter((subtask) => ownedBySameUser(subtask) && taskIdSet.has(subtask.taskId))
    .map((subtask) => subtask.id)

  return { projectId: project.id, taskIds, subtaskIds }
}

/** The user's Inbox, if it exists. */
export function findInbox(projects: readonly Project[], userId: string): Project | undefined {
  return projects.find((project) => project.isInbox && project.userId === userId)
}

/** Inbox first, then alphabetical with natural number order ("Project 2" before "Project 10"). */
export function sortProjects(projects: readonly Project[]): Project[] {
  return [...projects].sort((a, b) => {
    if (a.isInbox !== b.isInbox) return a.isInbox ? -1 : 1
    return nameCollator.compare(a.name, b.name) || a.id.localeCompare(b.id)
  })
}
