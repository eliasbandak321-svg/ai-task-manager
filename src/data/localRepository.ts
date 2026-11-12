import { z } from 'zod'
import {
  addSubtask,
  createInboxProject,
  createProject,
  createProjectInputSchema,
  createSubtaskInputSchema,
  createTask,
  createTaskInputSchema,
  DomainError,
  findInbox,
  getTaskSubtasks,
  idSchema,
  LIMITS,
  planProjectDeletion,
  planTaskDeletion,
  projectSchema,
  renameProject,
  reorderSubtasks,
  sortProjects,
  subtaskSchema,
  taskSchema,
  updateProjectInputSchema,
  updateSubtask,
  updateSubtaskInputSchema,
  updateTask,
  updateTaskInputSchema,
  type Project,
  type Subtask,
  type Task,
} from '../domain'
import { RepositoryError } from './errors'
import type {
  CreateProjectRequest,
  CreateSubtaskRequest,
  CreateTaskRequest,
  TaskRepository,
  UpdateProjectRequest,
  UpdateSubtaskRequest,
  UpdateTaskRequest,
} from './repository'

/*
  LocalRepository: the M5 adapter. It keeps the user's data in the browser (localStorage)
  and behaves like the future API:
  - every input is validated with the shared Zod schemas;
  - every business rule comes from src/domain (no rules are re-implemented here);
  - every read and write is scoped to one user id, just as the API will scope by the session.

  It is replaced by an HTTP adapter in M6; the UI won't change, because both implement
  TaskRepository and pass the same contract tests (src/test/repositoryContract.ts).
*/

export const STORAGE_KEY = 'ai-task-manager:data'

/** The subset of the Web Storage API we use, so tests can pass an in-memory version. */
export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function createMemoryStorage(initial: Record<string, string> = {}): KeyValueStorage {
  const items = new Map(Object.entries(initial))
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value)
    },
  }
}

/** Saved data couldn't be read or written (corrupted, or the browser's storage is full). */
export class StorageError extends RepositoryError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'StorageError'
  }
}

/*
  Saved data is external input too: another tab, an older app version or a browser extension
  may have written it. It is validated on every read, and `version` allows future migrations.
*/
const storedDataSchema = z.object({
  version: z.literal(1),
  userId: idSchema,
  projects: z.array(projectSchema),
  // Tasks saved before M9 have no estimate: read them as "unknown" instead of rejecting them.
  tasks: z.array(
    z.preprocess(
      (task) => (task && typeof task === 'object' && !('estimatedMinutes' in task) ? { ...task, estimatedMinutes: null } : task),
      taskSchema,
    ),
  ),
  subtasks: z.array(subtaskSchema),
})
type StoredData = z.infer<typeof storedDataSchema>

const subtaskOrderSchema = z.array(z.string()).max(LIMITS.subtasksPerTask)

export interface LocalRepositoryOptions {
  storage: KeyValueStorage
  /** The clock; injected so tests control time. */
  now?: () => Date
  /** Id generator; injected so tests get predictable ids. */
  newId?: () => string
  /** Artificial delay per call in ms, so loading states are visible during development. */
  latencyMs?: number
}

function findOwn<T extends { id: string; userId: string }>(rows: readonly T[], id: string, userId: string, label: string) {
  const row = rows.find((candidate) => candidate.id === id && candidate.userId === userId)
  if (!row) throw new DomainError('NOT_FOUND', `${label} not found`)
  return row
}

function replaceById<T extends { id: string }>(rows: T[], updated: T): void {
  const index = rows.findIndex((row) => row.id === updated.id)
  rows[index] = updated
}

export class LocalRepository implements TaskRepository {
  private readonly storage: KeyValueStorage
  private readonly now: () => Date
  private readonly newId: () => string
  private readonly latencyMs: number

  constructor({ storage, now = () => new Date(), newId = () => crypto.randomUUID(), latencyMs = 0 }: LocalRepositoryOptions) {
    this.storage = storage
    this.now = now
    this.newId = newId
    this.latencyMs = latencyMs
  }

  // ---------- Projects ----------

  async listProjects(): Promise<Project[]> {
    return this.query((data, own) => sortProjects(own(data.projects)))
  }

  async createProject(input: CreateProjectRequest): Promise<Project> {
    const parsed = createProjectInputSchema.parse(input)
    return this.mutate((data, own) => {
      const project = createProject(parsed, own(data.projects), this.context(data))
      data.projects.push(project)
      return project
    })
  }

  async updateProject(id: string, input: UpdateProjectRequest): Promise<Project> {
    const parsed = updateProjectInputSchema.parse(input)
    return this.mutate((data, own) => {
      const project = findOwn(data.projects, id, data.userId, 'Project')
      const renamed = renameProject(project, parsed, own(data.projects), this.now())
      replaceById(data.projects, renamed)
      return renamed
    })
  }

  async deleteProject(id: string): Promise<void> {
    return this.mutate((data, own) => {
      const project = findOwn(data.projects, id, data.userId, 'Project')
      const plan = planProjectDeletion(project, own(data.tasks), own(data.subtasks))
      const taskIds = new Set(plan.taskIds)
      const subtaskIds = new Set(plan.subtaskIds)
      data.projects = data.projects.filter((candidate) => candidate.id !== plan.projectId)
      data.tasks = data.tasks.filter((task) => !taskIds.has(task.id))
      data.subtasks = data.subtasks.filter((subtask) => !subtaskIds.has(subtask.id))
    })
  }

  // ---------- Tasks ----------

  async listTasks(): Promise<Task[]> {
    return this.query((data, own) =>
      own(data.tasks).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)),
    )
  }

  async createTask(input: CreateTaskRequest): Promise<Task> {
    const parsed = createTaskInputSchema.parse(input)
    return this.mutate((data, own) => {
      const task = createTask(parsed, own(data.projects), this.context(data))
      data.tasks.push(task)
      return task
    })
  }

  async updateTask(id: string, input: UpdateTaskRequest): Promise<Task> {
    const parsed = updateTaskInputSchema.parse(input)
    return this.mutate((data, own) => {
      const task = findOwn(data.tasks, id, data.userId, 'Task')
      const updated = updateTask(task, parsed, own(data.projects), this.now())
      replaceById(data.tasks, updated)
      return updated
    })
  }

  async deleteTask(id: string): Promise<void> {
    return this.mutate((data, own) => {
      const task = findOwn(data.tasks, id, data.userId, 'Task')
      const plan = planTaskDeletion(task, own(data.subtasks))
      const subtaskIds = new Set(plan.subtaskIds)
      data.tasks = data.tasks.filter((candidate) => candidate.id !== plan.taskId)
      data.subtasks = data.subtasks.filter((subtask) => !subtaskIds.has(subtask.id))
    })
  }

  // ---------- Subtasks ----------

  async listSubtasks(): Promise<Subtask[]> {
    return this.query((data, own) =>
      own(data.subtasks).sort(
        (a, b) => a.taskId.localeCompare(b.taskId) || a.position - b.position || a.id.localeCompare(b.id),
      ),
    )
  }

  async createSubtask(taskId: string, input: CreateSubtaskRequest): Promise<Subtask> {
    const parsed = createSubtaskInputSchema.parse(input)
    return this.mutate((data, own) => {
      const task = findOwn(data.tasks, taskId, data.userId, 'Task')
      const subtask = addSubtask(task, own(data.subtasks), parsed, { id: this.newId(), userId: data.userId })
      data.subtasks.push(subtask)
      return subtask
    })
  }

  async updateSubtask(id: string, input: UpdateSubtaskRequest): Promise<Subtask> {
    const parsed = updateSubtaskInputSchema.parse(input)
    return this.mutate((data) => {
      const subtask = findOwn(data.subtasks, id, data.userId, 'Subtask')
      const updated = updateSubtask(subtask, parsed)
      replaceById(data.subtasks, updated)
      return updated
    })
  }

  async deleteSubtask(id: string): Promise<void> {
    return this.mutate((data) => {
      const subtask = findOwn(data.subtasks, id, data.userId, 'Subtask')
      data.subtasks = data.subtasks.filter((candidate) => candidate.id !== subtask.id)
    })
  }

  async reorderSubtasks(taskId: string, orderedIds: string[]): Promise<Subtask[]> {
    const parsed = subtaskOrderSchema.parse(orderedIds)
    return this.mutate((data, own) => {
      const task = findOwn(data.tasks, taskId, data.userId, 'Task')
      const reordered = reorderSubtasks(task, own(data.subtasks), parsed)
      for (const subtask of reordered) replaceById(data.subtasks, subtask)
      return getTaskSubtasks(own(data.subtasks), task)
    })
  }

  // ---------- Storage plumbing ----------

  private context(data: StoredData) {
    return { id: this.newId(), userId: data.userId, now: this.now() }
  }

  /** Runs a read. Results are deep copies, so callers can't change stored data by accident. */
  private async query<T>(read: (data: StoredData, own: <R extends { userId: string }>(rows: R[]) => R[]) => T) {
    await this.simulateLatency()
    const data = this.load()
    return structuredClone(read(data, (rows) => rows.filter((row) => row.userId === data.userId)))
  }

  /**
   * Runs a read-modify-write. It is synchronous after the delay, so two calls can't interleave,
   * and a write that throws (a rule violation) saves nothing.
   */
  private async mutate<T>(change: (data: StoredData, own: <R extends { userId: string }>(rows: R[]) => R[]) => T) {
    await this.simulateLatency()
    const data = this.load()
    const result = change(data, (rows) => rows.filter((row) => row.userId === data.userId))
    this.save(data)
    return structuredClone(result)
  }

  private async simulateLatency(): Promise<void> {
    if (this.latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.latencyMs))
    }
  }

  /** Reads and validates saved data. The first visit sets up a local user with an Inbox, like a sign-up. */
  private load(): StoredData {
    const raw = this.storage.getItem(STORAGE_KEY)
    let data: StoredData
    if (raw === null) {
      data = { version: 1, userId: this.newId(), projects: [], tasks: [], subtasks: [] }
    } else {
      let json: unknown
      try {
        json = JSON.parse(raw)
      } catch (error) {
        throw new StorageError('Your saved data could not be read.', { cause: error })
      }
      const parsed = storedDataSchema.safeParse(json)
      if (!parsed.success) {
        throw new StorageError('Your saved data is invalid and could not be loaded.', { cause: parsed.error })
      }
      data = parsed.data
    }

    if (!findInbox(data.projects, data.userId)) {
      data.projects.push(createInboxProject({ id: this.newId(), userId: data.userId, now: this.now() }))
      this.save(data)
    }
    return data
  }

  private save(data: StoredData): void {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (error) {
      throw new StorageError("Your changes couldn't be saved. The browser's storage may be full.", { cause: error })
    }
  }
}
