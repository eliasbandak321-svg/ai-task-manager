import { randomUUID } from 'node:crypto'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import type {
  CreateProjectRequest,
  CreateSubtaskRequest,
  CreateTaskRequest,
  TaskRepository,
  UpdateProjectRequest,
  UpdateSubtaskRequest,
  UpdateTaskRequest,
} from '../../src/data/repository'
import {
  addSubtask,
  createProject,
  createProjectInputSchema,
  createSubtaskInputSchema,
  createTask,
  createTaskInputSchema,
  DomainError,
  getTaskSubtasks,
  idSchema,
  LIMITS,
  planProjectDeletion,
  planTaskDeletion,
  renameProject,
  reorderSubtasks,
  sortProjects,
  updateProjectInputSchema,
  updateSubtask,
  updateSubtaskInputSchema,
  updateTask,
  updateTaskInputSchema,
  type Project,
  type Subtask,
  type Task,
} from '../../src/domain'
import type { Database, Transaction } from './client'
import { calendarEvents, projects, subtasks, tasks } from './schema'
import { createInboxFor } from './users'

/*
  The server-side TaskRepository: the same interface and the same contract tests as the
  browser's LocalRepository, backed by PostgreSQL.

  - Scoped to one user, fixed when it's created. The user id comes from the session cookie
    (server/auth.ts), never from the request body or URL. Every query filters by it.
  - Every input is validated with the shared Zod schemas, and every rule comes from
    src/domain: this file only loads rows, calls the domain, and saves the result.
  - Each write runs in a transaction, so a rule check and the write that depends on it see
    the same data.
*/

type ProjectRow = typeof projects.$inferSelect
type TaskRow = typeof tasks.$inferSelect

const iso = (date: Date) => date.toISOString()
const toDate = (timestamp: string) => new Date(timestamp)

function toProject(row: ProjectRow): Project {
  return { ...row, createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt) }
}

function toTask(row: TaskRow): Task {
  return {
    ...row,
    completedAt: row.completedAt ? iso(row.completedAt) : null,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
  }
}

function projectValues(project: Project) {
  return { ...project, createdAt: toDate(project.createdAt), updatedAt: toDate(project.updatedAt) }
}

function taskValues(task: Task) {
  return {
    ...task,
    completedAt: task.completedAt ? toDate(task.completedAt) : null,
    createdAt: toDate(task.createdAt),
    updatedAt: toDate(task.updatedAt),
  }
}

/** PostgreSQL's error code for a unique constraint violation. */
const UNIQUE_VIOLATION = '23505'

export function isUniqueViolation(error: unknown): boolean {
  // Drivers wrap the database error differently; look for the code on the error or its cause.
  for (let current = error; current instanceof Error || (current && typeof current === 'object'); ) {
    if ((current as { code?: unknown }).code === UNIQUE_VIOLATION) return true
    const cause = (current as { cause?: unknown }).cause
    if (cause === undefined || cause === current) return false
    current = cause
  }
  return false
}

/** An id that isn't a UUID can't exist, so it's "not found" (and never reaches SQL). */
function assertId(id: string, label: string): void {
  if (!idSchema.safeParse(id).success) throw new DomainError('NOT_FOUND', `${label} not found`)
}

const subtaskOrderSchema = z.array(z.string()).max(LIMITS.subtasksPerTask)

export interface DbRepositoryOptions {
  now?: () => Date
  newId?: () => string
}

export class DbRepository implements TaskRepository {
  private readonly db: Database
  private readonly userId: string
  private readonly now: () => Date
  private readonly newId: () => string

  constructor(db: Database, userId: string, { now = () => new Date(), newId = randomUUID }: DbRepositoryOptions = {}) {
    this.db = db
    this.userId = userId
    this.now = now
    this.newId = newId
  }

  // ---------- Projects ----------

  async listProjects(): Promise<Project[]> {
    let rows = await this.db.select().from(projects).where(eq(projects.userId, this.userId))
    if (!rows.some((row) => row.isInbox)) {
      // Every user has an Inbox (created at sign-up). Self-heal if it's missing, like the
      // browser adapter does, so the dashboard always has a home for new tasks.
      await createInboxFor(this.db, this.userId, { now: this.now, newId: this.newId })
      rows = await this.db.select().from(projects).where(eq(projects.userId, this.userId))
    }
    return sortProjects(rows.map(toProject))
  }

  async createProject(input: CreateProjectRequest): Promise<Project> {
    const parsed = createProjectInputSchema.parse(input)
    return this.withDuplicateNameCheck(parsed.name, () =>
      this.db.transaction(async (tx) => {
        const existing = await tx.select().from(projects).where(eq(projects.userId, this.userId))
        const project = createProject(parsed, existing.map(toProject), this.context())
        await tx.insert(projects).values(projectValues(project))
        return project
      }),
    )
  }

  async updateProject(id: string, input: UpdateProjectRequest): Promise<Project> {
    const parsed = updateProjectInputSchema.parse(input)
    assertId(id, 'Project')
    return this.withDuplicateNameCheck(parsed.name, () =>
      this.db.transaction(async (tx) => {
        const existing = (await tx.select().from(projects).where(eq(projects.userId, this.userId))).map(toProject)
        const project = existing.find((candidate) => candidate.id === id)
        if (!project) throw new DomainError('NOT_FOUND', 'Project not found')
        const renamed = renameProject(project, parsed, existing, this.now())
        if (renamed !== project) {
          await tx
            .update(projects)
            .set({ name: renamed.name, updatedAt: toDate(renamed.updatedAt) })
            .where(and(eq(projects.id, id), eq(projects.userId, this.userId)))
        }
        return renamed
      }),
    )
  }

  async deleteProject(id: string): Promise<void> {
    assertId(id, 'Project')
    await this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(projects)
        .where(and(eq(projects.id, id), eq(projects.userId, this.userId)))
      if (!row) throw new DomainError('NOT_FOUND', 'Project not found')

      const projectTasks = await tx
        .select()
        .from(tasks)
        .where(and(eq(tasks.projectId, id), eq(tasks.userId, this.userId)))
      const taskIds = projectTasks.map((task) => task.id)
      const projectSubtasks =
        taskIds.length === 0
          ? []
          : await tx
              .select()
              .from(subtasks)
              .where(and(inArray(subtasks.taskId, taskIds), eq(subtasks.userId, this.userId)))

      // The domain decides what goes (and refuses the Inbox); the foreign keys would cascade
      // anyway, but deleting exactly the plan keeps both adapters' behaviour identical.
      const plan = planProjectDeletion(toProject(row), projectTasks.map(toTask), projectSubtasks)
      if (plan.subtaskIds.length > 0) {
        await tx.delete(subtasks).where(and(inArray(subtasks.id, plan.subtaskIds), eq(subtasks.userId, this.userId)))
      }
      if (plan.taskIds.length > 0) {
        await this.unlinkEvents(tx, plan.taskIds)
        await tx.delete(tasks).where(and(inArray(tasks.id, plan.taskIds), eq(tasks.userId, this.userId)))
      }
      await tx.delete(projects).where(and(eq(projects.id, plan.projectId), eq(projects.userId, this.userId)))
    })
  }

  // ---------- Tasks ----------

  async listTasks(): Promise<Task[]> {
    const rows = await this.db
      .select()
      .from(tasks)
      .where(eq(tasks.userId, this.userId))
      .orderBy(asc(tasks.createdAt), asc(tasks.id))
    return rows.map(toTask)
  }

  async createTask(input: CreateTaskRequest): Promise<Task> {
    const parsed = createTaskInputSchema.parse(input)
    return this.db.transaction(async (tx) => {
      const target = await tx
        .select()
        .from(projects)
        .where(and(eq(projects.id, parsed.projectId), eq(projects.userId, this.userId)))
      const task = createTask(parsed, target.map(toProject), this.context())
      await tx.insert(tasks).values(taskValues(task))
      return task
    })
  }

  async updateTask(id: string, input: UpdateTaskRequest): Promise<Task> {
    const parsed = updateTaskInputSchema.parse(input)
    assertId(id, 'Task')
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, id), eq(tasks.userId, this.userId)))
      if (!row) throw new DomainError('NOT_FOUND', 'Task not found')
      const task = toTask(row)

      const moving = parsed.projectId !== undefined && parsed.projectId !== task.projectId
      const target = moving
        ? await tx
            .select()
            .from(projects)
            .where(and(eq(projects.id, parsed.projectId as string), eq(projects.userId, this.userId)))
        : []

      const updated = updateTask(task, parsed, target.map(toProject), this.now())
      if (updated !== task) {
        const { id: _id, userId: _userId, createdAt: _createdAt, ...changes } = taskValues(updated)
        await tx
          .update(tasks)
          .set(changes)
          .where(and(eq(tasks.id, id), eq(tasks.userId, this.userId)))
      }
      return updated
    })
  }

  async deleteTask(id: string): Promise<void> {
    assertId(id, 'Task')
    await this.db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, id), eq(tasks.userId, this.userId)))
      if (!row) throw new DomainError('NOT_FOUND', 'Task not found')
      const own = await tx
        .select()
        .from(subtasks)
        .where(and(eq(subtasks.taskId, id), eq(subtasks.userId, this.userId)))

      const plan = planTaskDeletion(toTask(row), own)
      if (plan.subtaskIds.length > 0) {
        await tx.delete(subtasks).where(and(inArray(subtasks.id, plan.subtaskIds), eq(subtasks.userId, this.userId)))
      }
      await this.unlinkEvents(tx, [plan.taskId])
      await tx.delete(tasks).where(and(eq(tasks.id, plan.taskId), eq(tasks.userId, this.userId)))
    })
  }

  /** Calendar events outlive a deleted task: they stay on the calendar, just unlinked. */
  private async unlinkEvents(tx: Transaction, taskIds: readonly string[]): Promise<void> {
    await tx
      .update(calendarEvents)
      .set({ taskId: null, updatedAt: this.now() })
      .where(and(inArray(calendarEvents.taskId, [...taskIds]), eq(calendarEvents.userId, this.userId)))
  }

  // ---------- Subtasks ----------

  async listSubtasks(): Promise<Subtask[]> {
    return this.db
      .select()
      .from(subtasks)
      .where(eq(subtasks.userId, this.userId))
      .orderBy(asc(subtasks.taskId), asc(subtasks.position), asc(subtasks.id))
  }

  async createSubtask(taskId: string, input: CreateSubtaskRequest): Promise<Subtask> {
    const parsed = createSubtaskInputSchema.parse(input)
    assertId(taskId, 'Task')
    return this.db.transaction(async (tx) => {
      const task = await this.findOwnTask(tx, taskId)
      const siblings = await this.subtasksOf(tx, taskId)
      const subtask = addSubtask(task, siblings, parsed, { id: this.newId(), userId: this.userId })
      await tx.insert(subtasks).values(subtask)
      return subtask
    })
  }

  async updateSubtask(id: string, input: UpdateSubtaskRequest): Promise<Subtask> {
    const parsed = updateSubtaskInputSchema.parse(input)
    assertId(id, 'Subtask')
    return this.db.transaction(async (tx) => {
      const [subtask] = await tx
        .select()
        .from(subtasks)
        .where(and(eq(subtasks.id, id), eq(subtasks.userId, this.userId)))
      if (!subtask) throw new DomainError('NOT_FOUND', 'Subtask not found')
      const updated = updateSubtask(subtask, parsed)
      if (updated !== subtask) {
        await tx
          .update(subtasks)
          .set({ title: updated.title, done: updated.done })
          .where(and(eq(subtasks.id, id), eq(subtasks.userId, this.userId)))
      }
      return updated
    })
  }

  async deleteSubtask(id: string): Promise<void> {
    assertId(id, 'Subtask')
    const deleted = await this.db
      .delete(subtasks)
      .where(and(eq(subtasks.id, id), eq(subtasks.userId, this.userId)))
      .returning({ id: subtasks.id })
    if (deleted.length === 0) throw new DomainError('NOT_FOUND', 'Subtask not found')
  }

  async reorderSubtasks(taskId: string, orderedIds: string[]): Promise<Subtask[]> {
    const parsed = subtaskOrderSchema.parse(orderedIds)
    assertId(taskId, 'Task')
    return this.db.transaction(async (tx) => {
      const task = await this.findOwnTask(tx, taskId)
      const siblings = await this.subtasksOf(tx, taskId)
      const reordered = reorderSubtasks(task, siblings, parsed)
      for (const subtask of reordered) {
        await tx
          .update(subtasks)
          .set({ position: subtask.position })
          .where(and(eq(subtasks.id, subtask.id), eq(subtasks.userId, this.userId)))
      }
      return getTaskSubtasks(reordered, task)
    })
  }

  // ---------- Helpers ----------

  private context() {
    return { id: this.newId(), userId: this.userId, now: this.now() }
  }

  private async findOwnTask(tx: Pick<Database, 'select'>, taskId: string): Promise<Task> {
    const [row] = await tx
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, this.userId)))
    if (!row) throw new DomainError('NOT_FOUND', 'Task not found')
    return toTask(row)
  }

  private subtasksOf(tx: Pick<Database, 'select'>, taskId: string): Promise<Subtask[]> {
    return tx
      .select()
      .from(subtasks)
      .where(and(eq(subtasks.taskId, taskId), eq(subtasks.userId, this.userId)))
  }

  /**
   * Two requests creating the same name at the same moment can both pass the domain check;
   * the database's unique index then rejects the second. Report that as the same rule error.
   */
  private async withDuplicateNameCheck<T>(name: string, write: () => Promise<T>): Promise<T> {
    try {
      return await write()
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DomainError('DUPLICATE_PROJECT_NAME', `You already have a project called "${name}"`)
      }
      throw error
    }
  }
}
