import type { PlanTask, ProjectPlan } from '../domain'

/*
  Editing a generated plan before it's saved. Every helper returns a new plan and keeps
  dependencies valid: a task may only depend on tasks *before* it, so after a move or a
  removal, references that are no longer earlier (or no longer exist) are dropped.
*/

type Phase = ProjectPlan['phases'][number]

/** Removes dependencies that don't point to an earlier task. */
export function fixDependencies(plan: ProjectPlan): ProjectPlan {
  const seen = new Set<string>()
  return {
    ...plan,
    phases: plan.phases.map((phase) => ({
      ...phase,
      tasks: phase.tasks.map((task) => {
        const dependsOn = task.dependsOn.filter((key) => seen.has(key))
        seen.add(task.key)
        return dependsOn.length === task.dependsOn.length ? task : { ...task, dependsOn }
      }),
    })),
  }
}

function mapPhase(plan: ProjectPlan, phaseIndex: number, change: (phase: Phase) => Phase): ProjectPlan {
  return fixDependencies({ ...plan, phases: plan.phases.map((phase, index) => (index === phaseIndex ? change(phase) : phase)) })
}

export function updateTask(plan: ProjectPlan, phaseIndex: number, taskIndex: number, changes: Partial<PlanTask>): ProjectPlan {
  return mapPhase(plan, phaseIndex, (phase) => ({
    ...phase,
    tasks: phase.tasks.map((task, index) => (index === taskIndex ? { ...task, ...changes } : task)),
  }))
}

export function removeTask(plan: ProjectPlan, phaseIndex: number, taskIndex: number): ProjectPlan {
  const removed = plan.phases[phaseIndex]?.tasks[taskIndex]
  const next = {
    ...plan,
    phases: plan.phases
      .map((phase, index) => (index === phaseIndex ? { ...phase, tasks: phase.tasks.filter((_, i) => i !== taskIndex) } : phase))
      .filter((phase) => phase.tasks.length > 0),
  }
  if (!removed) return next
  return fixDependencies({
    ...next,
    phases: next.phases.map((phase) => ({
      ...phase,
      tasks: phase.tasks.map((task) => ({ ...task, dependsOn: task.dependsOn.filter((key) => key !== removed.key) })),
    })),
  })
}

/** Moves a task up (-1) or down (+1) within its phase. */
export function moveTask(plan: ProjectPlan, phaseIndex: number, taskIndex: number, direction: -1 | 1): ProjectPlan {
  const target = taskIndex + direction
  return mapPhase(plan, phaseIndex, (phase) => {
    if (target < 0 || target >= phase.tasks.length) return phase
    const tasks = [...phase.tasks]
    ;[tasks[taskIndex], tasks[target]] = [tasks[target], tasks[taskIndex]]
    return { ...phase, tasks }
  })
}

export function movePhase(plan: ProjectPlan, phaseIndex: number, direction: -1 | 1): ProjectPlan {
  const target = phaseIndex + direction
  if (target < 0 || target >= plan.phases.length) return plan
  const phases = [...plan.phases]
  ;[phases[phaseIndex], phases[target]] = [phases[target], phases[phaseIndex]]
  return fixDependencies({ ...plan, phases })
}

function nextKey(plan: ProjectPlan): string {
  const used = new Set(plan.phases.flatMap((phase) => phase.tasks.map((task) => task.key)))
  let index = used.size + 1
  while (used.has(`t${index}`)) index += 1
  return `t${index}`
}

export function addTask(plan: ProjectPlan, phaseIndex: number): ProjectPlan {
  const task: PlanTask = { key: nextKey(plan), title: 'New task', description: '', priority: 'medium', estimatedMinutes: 60, dueDate: null, dependsOn: [], subtasks: [] }
  return mapPhase(plan, phaseIndex, (phase) => ({ ...phase, tasks: [...phase.tasks, task] }))
}

export function addPhase(plan: ProjectPlan): ProjectPlan {
  const task: PlanTask = { key: nextKey(plan), title: 'New task', description: '', priority: 'medium', estimatedMinutes: 60, dueDate: null, dependsOn: [], subtasks: [] }
  return { ...plan, phases: [...plan.phases, { name: `Phase ${plan.phases.length + 1}`, tasks: [task] }] }
}

export function renamePhase(plan: ProjectPlan, phaseIndex: number, name: string): ProjectPlan {
  return { ...plan, phases: plan.phases.map((phase, index) => (index === phaseIndex ? { ...phase, name } : phase)) }
}

export function totalMinutes(plan: ProjectPlan): number {
  return plan.phases.flatMap((phase) => phase.tasks).reduce((sum, task) => sum + (task.estimatedMinutes ?? 0), 0)
}
