import { describe, expect, it } from 'vitest'
import { makeProject, makeTask } from '../test/factories'
import type { Occurrence } from './calendar'
import { computeInsights } from './insights'
import { defaultPreferences } from './scheduling'
import { zonedToUtc } from './zonedTime'

const TZ = 'Europe/Berlin'
const prefs = defaultPreferences(TZ)
// Monday 2026-03-02, 08:00 in Berlin.
const NOW = zonedToUtc('2026-03-02', 8 * 60, TZ)

function session(taskId: string | null, date: string, startHour: number, hours: number, category: Occurrence['category'] = 'work_session'): Occurrence {
  const start = zonedToUtc(date, startHour * 60, TZ).toISOString()
  const end = zonedToUtc(date, (startHour + hours) * 60, TZ).toISOString()
  return { eventId: 'e', occurrenceStart: start, start, end, title: 'Session', category, taskId, isRecurring: false, seriesId: null }
}

describe('computeInsights', () => {
  const project = makeProject({ name: 'Thesis' })
  const done = makeTask({ projectId: project.id, status: 'done', completedAt: '2026-03-01T10:00:00.000Z', estimatedMinutes: 30 })
  const overdue = makeTask({ projectId: project.id, dueDate: '2026-02-27', estimatedMinutes: 60 })
  const urgent = makeTask({ projectId: project.id, dueDate: '2026-03-04', estimatedMinutes: 120 })
  const planned = makeTask({ projectId: project.id, dueDate: '2026-03-06', estimatedMinutes: 90 })
  const vague = makeTask({ projectId: project.id })
  const tasks = [done, overdue, urgent, planned, vague]

  it('counts progress, deadlines and per-project completion from real data', () => {
    const insights = computeInsights({ tasks, projects: [project], upcoming: [], prefs, now: NOW })
    expect(insights.today).toBe('2026-03-02')
    expect(insights.counts).toEqual({ total: 5, completed: 1, pending: 4, overdue: 1, dueToday: 0, upcoming: 2, completedLast7Days: 1 })
    expect(insights.completionPercent).toBe(20)
    expect(insights.projects).toEqual([{ projectId: project.id, name: 'Thesis', total: 5, done: 1, percent: 20 }])
  })

  it('sums planned work per day against capacity and flags overloaded days', () => {
    const upcoming = [
      session(planned.id, '2026-03-02', 9, 4),
      session(null, '2026-03-02', 14, 3, 'focus'),
      session(null, '2026-03-02', 18, 1, 'meeting'), // meetings aren't counted as work time
      session(planned.id, '2026-03-03', 9, 2),
    ]
    const insights = computeInsights({ tasks, projects: [project], upcoming, prefs, now: NOW })
    expect(insights.workload.slice(0, 2)).toEqual([
      { date: '2026-03-02', scheduledMinutes: 420, capacityMinutes: 360, dueTasks: 0 },
      { date: '2026-03-03', scheduledMinutes: 120, capacityMinutes: 360, dueTasks: 0 },
    ])
    expect(insights.workload[5]).toMatchObject({ date: '2026-03-07', capacityMinutes: 0 }) // Saturday
    expect(insights.suggestions.find((s) => s.kind === 'overloaded_day')?.date).toBe('2026-03-02')
  })

  it('separates scheduled from unscheduled open tasks and suggests next steps', () => {
    const insights = computeInsights({ tasks, projects: [project], upcoming: [session(planned.id, '2026-03-03', 9, 2)], prefs, now: NOW })
    expect(insights.scheduling).toEqual({ scheduled: 1, unscheduled: 3, unscheduledTaskIds: [overdue.id, urgent.id, vague.id] })
    const byKind = Object.fromEntries(insights.suggestions.map((s) => [s.kind, s.taskIds]))
    expect(byKind.overdue).toEqual([overdue.id])
    expect(byKind.unscheduled_urgent).toEqual([urgent.id])
    expect(byKind.missing_estimate).toEqual([vague.id])
    expect(byKind.nothing_planned).toBeUndefined()
  })

  it('suggests planning when nothing is on the calendar, and stays quiet with no tasks', () => {
    expect(computeInsights({ tasks, projects: [project], upcoming: [], prefs, now: NOW }).suggestions.map((s) => s.kind)).toContain('nothing_planned')
    expect(computeInsights({ tasks: [], projects: [], upcoming: [], prefs, now: NOW }).suggestions).toEqual([])
  })
})
