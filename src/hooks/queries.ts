import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import type {
  CreateProjectRequest,
  CreateSubtaskRequest,
  CreateTaskRequest,
  UpdateProjectRequest,
  UpdateSubtaskRequest,
  UpdateTaskRequest,
} from '../data/repository'
import { useRepository } from '../data/repositoryContext'
import type { Subtask, Task } from '../domain'

/*
  TanStack Query hooks over the repository: the only way components read or change data.

  - Queries cache each list under a key. Any component using the same key shares the data
    and the loading/error state, and there is exactly one request.
  - After a mutation succeeds, the affected keys are *invalidated*: TanStack Query refetches
    them, so the UI always shows what the repository actually stored (including values the
    domain computed, like completedAt).
  - Frequent small edits (status, checking off a subtask, reordering) are *optimistic*: the
    cache is updated immediately so the UI feels instant, rolled back if the save fails,
    and refetched either way.

  Components await `mutateAsync` instead of passing callbacks to `mutate(…, { onSuccess })`:
  TanStack Query skips those per-call callbacks when the component unmounts first, which is
  exactly what happens when the item being changed disappears (a deleted task closes its dialog).
*/

export const queryKeys = {
  projects: ['projects'],
  tasks: ['tasks'],
  subtasks: ['subtasks'],
} as const satisfies Record<string, QueryKey>

export function useProjectsQuery() {
  const repository = useRepository()
  return useQuery({ queryKey: queryKeys.projects, queryFn: () => repository.listProjects() })
}

export function useTasksQuery() {
  const repository = useRepository()
  return useQuery({ queryKey: queryKeys.tasks, queryFn: () => repository.listTasks() })
}

export function useSubtasksQuery() {
  const repository = useRepository()
  return useQuery({ queryKey: queryKeys.subtasks, queryFn: () => repository.listSubtasks() })
}

/** Returns a function that refetches the given lists and resolves when they're fresh. */
function useInvalidate() {
  const queryClient = useQueryClient()
  return (...keys: QueryKey[]) => Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
}

/**
 * Optimistically applies `apply` to a cached list, returning a rollback for onError.
 * Pending refetches are cancelled first so they can't overwrite the optimistic value.
 */
function useOptimisticList() {
  const queryClient = useQueryClient()
  return async <T>(queryKey: QueryKey, apply: (rows: T[]) => T[]) => {
    await queryClient.cancelQueries({ queryKey })
    const previous = queryClient.getQueryData<T[]>(queryKey)
    if (previous) queryClient.setQueryData<T[]>(queryKey, apply(previous))
    return () => queryClient.setQueryData(queryKey, previous)
  }
}

/** Only the fields a request actually sets (an `undefined` field means "leave unchanged"). */
function definedFields<T extends object>(input: T): Partial<T> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<T>
}

// ---------- Projects ----------

export function useCreateProject() {
  const repository = useRepository()
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: CreateProjectRequest) => repository.createProject(input),
    onSuccess: () => invalidate(queryKeys.projects),
  })
}

export function useUpdateProject() {
  const repository = useRepository()
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProjectRequest }) => repository.updateProject(id, input),
    onSuccess: () => invalidate(queryKeys.projects),
  })
}

/**
 * `onDeleted` runs before the lists are refetched, so the page can leave the deleted
 * project first instead of briefly showing "Project not found".
 */
export function useDeleteProject({ onDeleted }: { onDeleted?: () => void } = {}) {
  const repository = useRepository()
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: string) => repository.deleteProject(id),
    onSuccess: () => {
      onDeleted?.()
      // Deleting a project also deletes its tasks and subtasks.
      return invalidate(queryKeys.projects, queryKeys.tasks, queryKeys.subtasks)
    },
  })
}

// ---------- Tasks ----------

export function useCreateTask() {
  const repository = useRepository()
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (input: CreateTaskRequest) => repository.createTask(input),
    onSuccess: () => invalidate(queryKeys.tasks),
  })
}

export function useUpdateTask() {
  const repository = useRepository()
  const invalidate = useInvalidate()
  const optimistic = useOptimisticList()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTaskRequest }) => repository.updateTask(id, input),
    onMutate: ({ id, input }) =>
      optimistic<Task>(queryKeys.tasks, (tasks) =>
        tasks.map((task) => (task.id === id ? { ...task, ...definedFields(input) } : task)),
      ),
    onError: (_error, _variables, rollback) => rollback?.(),
    onSettled: () => invalidate(queryKeys.tasks),
  })
}

export function useDeleteTask() {
  const repository = useRepository()
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: string) => repository.deleteTask(id),
    onSuccess: () => invalidate(queryKeys.tasks, queryKeys.subtasks),
  })
}

// ---------- Subtasks ----------

export function useCreateSubtask() {
  const repository = useRepository()
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: CreateSubtaskRequest }) =>
      repository.createSubtask(taskId, input),
    onSuccess: () => invalidate(queryKeys.subtasks),
  })
}

export function useUpdateSubtask() {
  const repository = useRepository()
  const invalidate = useInvalidate()
  const optimistic = useOptimisticList()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateSubtaskRequest }) => repository.updateSubtask(id, input),
    onMutate: ({ id, input }) =>
      optimistic<Subtask>(queryKeys.subtasks, (subtasks) =>
        subtasks.map((subtask) => (subtask.id === id ? { ...subtask, ...definedFields(input) } : subtask)),
      ),
    onError: (_error, _variables, rollback) => rollback?.(),
    onSettled: () => invalidate(queryKeys.subtasks),
  })
}

export function useDeleteSubtask() {
  const repository = useRepository()
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: (id: string) => repository.deleteSubtask(id),
    onSuccess: () => invalidate(queryKeys.subtasks),
  })
}

export function useReorderSubtasks() {
  const repository = useRepository()
  const invalidate = useInvalidate()
  const optimistic = useOptimisticList()
  return useMutation({
    mutationFn: ({ taskId, orderedIds }: { taskId: string; orderedIds: string[] }) =>
      repository.reorderSubtasks(taskId, orderedIds),
    onMutate: ({ orderedIds }) => {
      const positions = new Map(orderedIds.map((id, position) => [id, position]))
      return optimistic<Subtask>(queryKeys.subtasks, (subtasks) =>
        subtasks.map((subtask) => {
          const position = positions.get(subtask.id)
          return position === undefined ? subtask : { ...subtask, position }
        }),
      )
    },
    onError: (_error, _variables, rollback) => rollback?.(),
    onSettled: () => invalidate(queryKeys.subtasks),
  })
}
