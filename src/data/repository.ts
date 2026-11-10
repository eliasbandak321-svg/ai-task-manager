import type { z } from 'zod'
import type {
  createProjectInputSchema,
  createSubtaskInputSchema,
  createTaskInputSchema,
  Project,
  Subtask,
  Task,
  updateProjectInputSchema,
  updateSubtaskInputSchema,
  updateTaskInputSchema,
} from '../domain'

/*
  The one door between the UI and stored data (docs/architecture.md §5).

  - Async from day one: the local adapter (M5) and the HTTP adapter (M6) look the same to the UI.
  - Shaped like the future REST API: one method per endpoint, scoped to the current user.
    There is deliberately no `userId` parameter anywhere: the adapter knows who the user is
    (locally from its own storage, later from the server session).
  - Inputs are *requests*, not trusted values: every adapter validates them with the shared
    Zod schemas, exactly as the API will.
  - Errors: a rule violation rejects with a DomainError (stable `code`), invalid input with a
    ZodError, and a storage or network failure with any other Error.
*/

export type CreateProjectRequest = z.input<typeof createProjectInputSchema>
export type UpdateProjectRequest = z.input<typeof updateProjectInputSchema>
export type CreateTaskRequest = z.input<typeof createTaskInputSchema>
export type UpdateTaskRequest = z.input<typeof updateTaskInputSchema>
export type CreateSubtaskRequest = z.input<typeof createSubtaskInputSchema>
export type UpdateSubtaskRequest = z.input<typeof updateSubtaskInputSchema>

export interface TaskRepository {
  /** The user's projects, Inbox first (GET /api/projects). */
  listProjects(): Promise<Project[]>
  createProject(input: CreateProjectRequest): Promise<Project>
  updateProject(id: string, input: UpdateProjectRequest): Promise<Project>
  /** Deletes the project with its tasks and their subtasks. The Inbox can't be deleted. */
  deleteProject(id: string): Promise<void>

  /** All of the user's tasks, oldest first. Search, filters and sorting run on top (src/domain/taskQuery). */
  listTasks(): Promise<Task[]>
  createTask(input: CreateTaskRequest): Promise<Task>
  updateTask(id: string, input: UpdateTaskRequest): Promise<Task>
  /** Deletes the task and its subtasks. */
  deleteTask(id: string): Promise<void>

  /** All of the user's subtasks; group them per task with getTaskSubtasks. */
  listSubtasks(): Promise<Subtask[]>
  createSubtask(taskId: string, input: CreateSubtaskRequest): Promise<Subtask>
  updateSubtask(id: string, input: UpdateSubtaskRequest): Promise<Subtask>
  deleteSubtask(id: string): Promise<void>
  /** `orderedIds` must list each of the task's subtasks exactly once. Returns them in the new order. */
  reorderSubtasks(taskId: string, orderedIds: string[]): Promise<Subtask[]>
}
