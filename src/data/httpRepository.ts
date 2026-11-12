import { z } from 'zod'
import {
  createProjectInputSchema,
  createSubtaskInputSchema,
  createTaskInputSchema,
  projectSchema,
  subtaskSchema,
  taskSchema,
  updateProjectInputSchema,
  updateSubtaskInputSchema,
  updateTaskInputSchema,
  type Project,
  type Subtask,
  type Task,
} from '../domain'
import { createTransport, type HttpTransportOptions, type Request } from './httpTransport'
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

export type HttpRepositoryOptions = HttpTransportOptions

export class HttpRepository implements TaskRepository {
  private readonly request: Request

  constructor(options: HttpRepositoryOptions = {}) {
    this.request = createTransport(options)
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
}
