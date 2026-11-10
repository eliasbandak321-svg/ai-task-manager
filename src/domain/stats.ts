import { TASK_PRIORITIES, TASK_STATUSES } from './constants'
import type { IsoDate } from './dates'
import { getDeadlineStatus } from './deadlines'
import type { Project, Task, TaskPriority, TaskStatus } from './schemas'

export interface TaskStats {
  total: number
  byStatus: Record<TaskStatus, number>
  /** Priorities of tasks that aren't done yet: what still needs attention. */
  openByPriority: Record<TaskPriority, number>
  /** Share of tasks that are done, 0–100. */
  completionPercent: number
  overdue: number
  dueToday: number
  dueSoon: number
}

/**
 * `part` as a whole percentage of `total`, rounded *down*, so a progress bar
 * never shows 100% while something is still unfinished. 0 when total is 0.
 */
export function toPercent(part: number, total: number): number {
  return total === 0 ? 0 : Math.floor((part / total) * 100)
}

function zeroCounts<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>
}

/** Dashboard statistics for a list of tasks, in a single pass. */
export function computeTaskStats(tasks: readonly Task[], today: IsoDate): TaskStats {
  const stats: TaskStats = {
    total: tasks.length,
    byStatus: zeroCounts(TASK_STATUSES),
    openByPriority: zeroCounts(TASK_PRIORITIES),
    completionPercent: 0,
    overdue: 0,
    dueToday: 0,
    dueSoon: 0,
  }

  for (const task of tasks) {
    stats.byStatus[task.status] += 1
    if (task.status !== 'done') stats.openByPriority[task.priority] += 1

    const deadline = getDeadlineStatus(task, today)
    if (deadline === 'overdue') stats.overdue += 1
    else if (deadline === 'due_today') stats.dueToday += 1
    else if (deadline === 'due_soon') stats.dueSoon += 1
  }

  stats.completionPercent = toPercent(stats.byStatus.done, stats.total)
  return stats
}

/** Statistics per project, keyed by project id. Projects without tasks get zeroed stats. */
export function computeProjectProgress(
  projects: readonly Project[],
  tasks: readonly Task[],
  today: IsoDate,
): Map<string, TaskStats> {
  const tasksByProject = new Map<string, Task[]>(projects.map((project) => [project.id, []]))
  const ownerByProject = new Map(projects.map((project) => [project.id, project.userId]))

  for (const task of tasks) {
    // Only count a task if it belongs to the same user as its project.
    if (ownerByProject.get(task.projectId) === task.userId) {
      tasksByProject.get(task.projectId)?.push(task)
    }
  }

  return new Map(
    [...tasksByProject].map(([projectId, projectTasks]) => [projectId, computeTaskStats(projectTasks, today)]),
  )
}
