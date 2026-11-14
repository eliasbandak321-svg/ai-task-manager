import { z } from 'zod'
import { DomainError } from './errors'
import { idSchema } from './schemas'

/*
  Task dependencies (M9): "B can only start after A is finished". Stored as edges
  (taskId → dependsOnId) in the task_dependency table. The graph must stay acyclic: a cycle
  would make both tasks wait for each other forever, so it is refused when it's created.
*/

export const MAX_DEPENDENCIES_PER_TASK = 20

export interface TaskDependency {
  taskId: string
  dependsOnId: string
}

export const setDependenciesInputSchema = z.strictObject({
  dependsOn: z.array(idSchema).max(MAX_DEPENDENCIES_PER_TASK, `A task can depend on at most ${MAX_DEPENDENCIES_PER_TASK} tasks`),
})

/** Prerequisites of each task. */
export function prerequisitesOf(edges: readonly TaskDependency[]): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const edge of edges) map.set(edge.taskId, [...(map.get(edge.taskId) ?? []), edge.dependsOnId])
  return map
}

/** A cycle in the graph as a list of task ids (first = last), or null if there is none. */
export function findCycle(edges: readonly TaskDependency[]): string[] | null {
  const graph = prerequisitesOf(edges)
  const state = new Map<string, 'visiting' | 'done'>()
  const path: string[] = []

  function visit(node: string): string[] | null {
    if (state.get(node) === 'done') return null
    if (state.get(node) === 'visiting') return [...path.slice(path.indexOf(node)), node]
    state.set(node, 'visiting')
    path.push(node)
    for (const next of graph.get(node) ?? []) {
      const cycle = visit(next)
      if (cycle) return cycle
    }
    path.pop()
    state.set(node, 'done')
    return null
  }

  for (const node of graph.keys()) {
    const cycle = visit(node)
    if (cycle) return cycle
  }
  return null
}

/**
 * Validates replacing the prerequisites of `taskId` with `dependsOn`: no self-reference, only
 * known tasks, and no cycle in the resulting graph. Returns the new edges of that task.
 */
export function planDependencies(
  taskId: string,
  dependsOn: readonly string[],
  existing: readonly TaskDependency[],
  knownTaskIds: ReadonlySet<string>,
): TaskDependency[] {
  const unique = [...new Set(dependsOn)]
  if (unique.includes(taskId)) throw new DomainError('DEPENDENCY_CYCLE', 'A task cannot depend on itself')
  if (unique.some((id) => !knownTaskIds.has(id))) throw new DomainError('NOT_FOUND', 'Task not found')
  const next = unique.map((dependsOnId) => ({ taskId, dependsOnId }))
  const graph = [...existing.filter((edge) => edge.taskId !== taskId), ...next]
  if (findCycle(graph)) {
    throw new DomainError('DEPENDENCY_CYCLE', 'This would create a circular dependency: the tasks would wait for each other forever')
  }
  return next
}

/** Every open prerequisite of the given tasks, transitively (for scheduling them too). */
export function openPrerequisites(taskIds: Iterable<string>, edges: readonly TaskDependency[], isOpen: (id: string) => boolean): Set<string> {
  const graph = prerequisitesOf(edges)
  const result = new Set<string>()
  const stack = [...taskIds]
  while (stack.length > 0) {
    for (const prerequisite of graph.get(stack.pop() as string) ?? []) {
      if (isOpen(prerequisite) && !result.has(prerequisite)) {
        result.add(prerequisite)
        stack.push(prerequisite)
      }
    }
  }
  return result
}
