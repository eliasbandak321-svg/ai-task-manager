import { z } from 'zod'
import {
  createProjectInputSchema,
  createSubtaskInputSchema,
  createTaskInputSchema,
  DomainError,
  projectSchema,
  subtaskSchema,
  taskSchema,
  updateProjectInputSchema,
  updateSubtaskInputSchema,
  updateTaskInputSchema,
  type DomainErrorCode,
  type Project,
  type Subtask,
  type Task,
} from '../domain'
import { AuthRequiredError, RepositoryError } from './errors'
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
  HttpRepository: the M6 adapter. It talks to the Hono API on the same origin (/api), so
  the browser sends the session cookie automatically from M7 on — no tokens in JavaScript.

  It behaves exactly like LocalRepository (both pass src/test/repositoryContract.ts):
  - inputs are validated with the shared Zod schemas *before* sending, for instant feedback;
    the API validates them again, because a server must never trust the client;
  - responses are validated too, so a mismatch between client and server fails loudly
    here instead of as broken UI later;
  - API rule errors become DomainErrors with the same code; every other failure becomes a
    RepositoryError with a message that is safe to show.
*/

const DOMAIN_ERROR_CODES = new Set<string>([
  'NOT_FOUND',
  'INBOX_PROTECTED',
  'DUPLICATE_PROJECT_NAME',
  'RESERVED_PROJECT_NAME',
  'OWNERSHIP_MISMATCH',
  'SUBTASK_LIMIT_REACHED',
  'INVALID_SUBTASK_ORDER',
] satisfies DomainErrorCode[])

const apiErrorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) })

const MESSAGES = {
  offline: "Couldn't reach the server. Check your connection and try again.",
  server: 'Something went wrong on the server. Please try again.',
  unexpected: 'The server sent an unexpected response. Please reload the page.',
  unauthenticated: 'Please sign in to continue.',
} as const

export interface HttpRepositoryOptions {
  /** Where the API lives. Same origin by default. */
  baseUrl?: string
  /** Injected for tests (e.g. the Hono app's own request handler). */
  fetch?: typeof globalThis.fetch
}

export class HttpRepository implements TaskRepository {
  private readonly baseUrl: string
  private readonly fetchImpl: typeof globalThis.fetch

  constructor({ baseUrl = '/api', fetch = (...args) => globalThis.fetch(...args) }: HttpRepositoryOptions = {}) {
    this.baseUrl = baseUrl
    this.fetchImpl = fetch
  }

  // ---------- Projects ----------

  listProjects(): Promise<Project[]> {
    return this.request('GET', '/projects', z.array(projectSchema))
  }

  async createProject(input: CreateProjectRequest): Promise<Project> {
    return this.request('POST', '/projects', projectSchema, createProjectInputSchema.parse(input))
  }

  async updateProject(id: string, input: UpdateProjectRequest): Promise<Project> {
    return this.request('PATCH', `/projects/${encodeURIComponent(id)}`, projectSchema, updateProjectInputSchema.parse(input))
  }

  deleteProject(id: string): Promise<void> {
    return this.request('DELETE', `/projects/${encodeURIComponent(id)}`, null)
  }

  // ---------- Tasks ----------

  listTasks(): Promise<Task[]> {
    return this.request('GET', '/tasks', z.array(taskSchema))
  }

  async createTask(input: CreateTaskRequest): Promise<Task> {
    return this.request('POST', '/tasks', taskSchema, createTaskInputSchema.parse(input))
  }

  async updateTask(id: string, input: UpdateTaskRequest): Promise<Task> {
    return this.request('PATCH', `/tasks/${encodeURIComponent(id)}`, taskSchema, updateTaskInputSchema.parse(input))
  }

  deleteTask(id: string): Promise<void> {
    return this.request('DELETE', `/tasks/${encodeURIComponent(id)}`, null)
  }

  // ---------- Subtasks ----------

  listSubtasks(): Promise<Subtask[]> {
    return this.request('GET', '/subtasks', z.array(subtaskSchema))
  }

  async createSubtask(taskId: string, input: CreateSubtaskRequest): Promise<Subtask> {
    return this.request(
      'POST',
      `/tasks/${encodeURIComponent(taskId)}/subtasks`,
      subtaskSchema,
      createSubtaskInputSchema.parse(input),
    )
  }

  async updateSubtask(id: string, input: UpdateSubtaskRequest): Promise<Subtask> {
    return this.request('PATCH', `/subtasks/${encodeURIComponent(id)}`, subtaskSchema, updateSubtaskInputSchema.parse(input))
  }

  deleteSubtask(id: string): Promise<void> {
    return this.request('DELETE', `/subtasks/${encodeURIComponent(id)}`, null)
  }

  reorderSubtasks(taskId: string, orderedIds: string[]): Promise<Subtask[]> {
    return this.request('PUT', `/tasks/${encodeURIComponent(taskId)}/subtasks/order`, z.array(subtaskSchema), {
      orderedIds,
    })
  }

  // ---------- Transport ----------

  private async request(method: string, path: string, schema: null, body?: unknown): Promise<void>
  private async request<T>(method: string, path: string, schema: z.ZodType<T>, body?: unknown): Promise<T>
  private async request<T>(method: string, path: string, schema: z.ZodType<T> | null, body?: unknown) {
    let response: Response
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: 'same-origin',
      })
    } catch (error) {
      throw new RepositoryError(MESSAGES.offline, { cause: error })
    }

    if (!response.ok) throw await this.toError(response)
    if (schema === null) return undefined

    let json: unknown
    try {
      json = await response.json()
    } catch (error) {
      throw new RepositoryError(MESSAGES.unexpected, { cause: error })
    }
    const parsed = schema.safeParse(json)
    if (!parsed.success) throw new RepositoryError(MESSAGES.unexpected, { cause: parsed.error })
    return parsed.data
  }

  private async toError(response: Response): Promise<Error> {
    const json: unknown = await response.json().catch(() => null)
    const parsed = apiErrorSchema.safeParse(json)
    const apiError = parsed.success ? parsed.data.error : null

    if (apiError && DOMAIN_ERROR_CODES.has(apiError.code)) {
      return new DomainError(apiError.code as DomainErrorCode, apiError.message)
    }
    if (response.status === 401) return new AuthRequiredError(MESSAGES.unauthenticated)
    // A 4xx message from our own API is written for people (e.g. a validation message).
    if (apiError && response.status < 500) return new RepositoryError(apiError.message)
    return new RepositoryError(MESSAGES.server, { cause: apiError ?? response.status })
  }
}
