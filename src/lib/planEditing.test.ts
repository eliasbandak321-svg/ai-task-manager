import { describe, expect, it } from 'vitest'
import { projectPlanSchema, type ProjectPlan } from '../domain'
import { addPhase, addTask, movePhase, moveTask, removeTask, totalMinutes, updateTask } from './planEditing'

const task = (key: string, dependsOn: string[] = []) => ({ key, title: key.toUpperCase(), description: '', priority: 'medium' as const, estimatedMinutes: 30, dueDate: null, dependsOn, subtasks: [] })
const plan: ProjectPlan = {
  projectName: 'P',
  summary: '',
  clarifyingQuestions: [],
  phases: [
    { name: 'One', tasks: [task('t1'), task('t2', ['t1'])] },
    { name: 'Two', tasks: [task('t3', ['t2'])] },
  ],
}
const valid = (value: ProjectPlan) => projectPlanSchema.safeParse(value).success

describe('plan editing', () => {
  it('drops dependencies that would point forward after a move', () => {
    const moved = moveTask(plan, 0, 1, -1)
    expect(moved.phases[0].tasks.map((t) => [t.key, t.dependsOn])).toEqual([['t2', []], ['t1', []]])
    expect(valid(moved)).toBe(true)
    const phases = movePhase(plan, 1, -1)
    expect(phases.phases[0].tasks[0].dependsOn).toEqual([])
    expect(valid(phases)).toBe(true)
  })

  it('removes a task, its references and empty phases', () => {
    const removed = removeTask(plan, 1, 0)
    expect(removed.phases).toHaveLength(1)
    const withoutFirst = removeTask(plan, 0, 0)
    expect(withoutFirst.phases[0].tasks[0].dependsOn).toEqual([])
    expect(valid(withoutFirst)).toBe(true)
  })

  it('adds tasks and phases with unique keys, and updates fields', () => {
    const added = addPhase(addTask(plan, 0))
    const keys = added.phases.flatMap((p) => p.tasks.map((t) => t.key))
    expect(new Set(keys).size).toBe(keys.length)
    expect(valid(added)).toBe(true)
    expect(updateTask(plan, 0, 0, { title: 'Renamed' }).phases[0].tasks[0].title).toBe('Renamed')
    expect(totalMinutes(plan)).toBe(90)
  })
})
