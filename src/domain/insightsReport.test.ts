import { describe, expect, it } from 'vitest'
import { makeProject, makeTask } from '../test/factories'
import type { Occurrence, SessionStatus } from './calendar'
import { computeInsightsReport } from './insightsReport'
import { defaultPreferences } from './scheduling'
import { zonedToUtc } from './zonedTime'

const TZ = 'Europe/Berlin'
const prefs = defaultPreferences(TZ)
// Friday 2026-11-20, 09:35 in Berlin.
const NOW = zonedToUtc('2026-11-20', 9 * 60 + 35, TZ)
const at = (date: string, hour: number) => zonedToUtc(date, hour * 60, TZ).toISOString()

function session(taskId: string | null, date: string, startHour: number, hours: number, sessionStatus: SessionStatus = 'planned', category: Occurrence['category'] = 'focus'): Occurrence {
  const start = at(date, startHour)
  return { eventId: `${date}-${startHour}`, occurrenceStart: start, start, end: at(date, startHour + hours), title: 'Session', category, taskId, isRecurring: false, seriesId: null, sessionStatus }
}

const thesis = makeProject({ name: 'Thesis' })
const stats = makeProject({ name: 'Statistics' })
const doneThisWeek = makeTask({ projectId: thesis.id, status: 'done', dueDate: '2026-11-20', completedAt: at('2026-11-18', 10) })
const doneLastMonth = makeTask({ projectId: thesis.id, status: 'done', dueDate: '2026-10-20', completedAt: at('2026-10-24', 10) })
// Completed late in the evening in Berlin: belongs to 15 Nov in the user's zone, not 16 Nov UTC.
const doneLateEvening = makeTask({ projectId: stats.id, status: 'done', completedAt: '2026-11-15T22:30:00.000Z' })
const inProgress = makeTask({ projectId: thesis.id, status: 'in_progress', dueDate: '2026-11-24', estimatedMinutes: 120 })
const overdueInProgress = makeTask({ projectId: stats.id, status: 'in_progress', dueDate: '2026-11-19', estimatedMinutes: 30 })
const todo = makeTask({ projectId: stats.id, dueDate: '2026-12-01' })
const tasks = [doneThisWeek, doneLastMonth, doneLateEvening, inProgress, overdueInProgress, todo]

const occurrences = [
  session(inProgress.id, '2026-11-16', 13, 2, 'completed'),
  session(overdueInProgress.id, '2026-11-18', 14, 1), // past, never marked
  session(todo.id, '2026-11-19', 13, 1, 'skipped'),
  session(inProgress.id, '2026-11-20', 10, 1.5), // upcoming today
  session(inProgress.id, '2026-11-25', 10, 2), // upcoming next week
  session(null, '2026-11-20', 12, 1, 'planned', 'meeting'), // meetings are not work time
]

const base = { tasks, projects: [thesis, stats], occurrences, prefs, now: NOW, projectId: null, granularity: 'day' as const }

describe('computeInsightsReport', () => {
  it('counts tasks completed in the period by their completion date in the user zone, and the previous period', () => {
    const report = computeInsightsReport({ ...base, from: '2026-11-14', to: '2026-11-20' })
    expect(report.range).toEqual({ from: '2026-11-14', to: '2026-11-20', days: 7 })
    expect(report.completed.inRange).toBe(2) // 18 Nov and 15 Nov (Berlin)
    expect(report.completed.previousRange).toBe(0) // 7–13 Nov
    expect(report.completed.series.map((bucket) => bucket.count)).toEqual([0, 1, 0, 0, 1, 0, 0])
    expect(report.completed.series[1]).toMatchObject({ from: '2026-11-15', to: '2026-11-15' })
  })

  it('groups the completion trend by Monday-based week or by month, clipped to the period', () => {
    const weekly = computeInsightsReport({ ...base, from: '2026-10-22', to: '2026-11-20', granularity: 'week' })
    expect(weekly.completed.series[0]).toMatchObject({ from: '2026-10-22', to: '2026-10-25', count: 1 })
    expect(weekly.completed.series.at(-1)).toMatchObject({ from: '2026-11-16', to: '2026-11-20', count: 1 })
    expect(weekly.completed.series.reduce((sum, bucket) => sum + bucket.count, 0)).toBe(3)
    const monthly = computeInsightsReport({ ...base, from: '2026-10-22', to: '2026-11-20', granularity: 'month' })
    expect(monthly.completed.series).toEqual([
      { from: '2026-10-22', to: '2026-10-31', count: 1 },
      { from: '2026-11-01', to: '2026-11-20', count: 2 },
    ])
  })

  it('splits the current status so every task is counted exactly once (overdue tasks only as overdue)', () => {
    const { status } = computeInsightsReport({ ...base, from: '2026-11-14', to: '2026-11-20' })
    expect(status).toEqual({ total: 6, done: 3, inProgress: 1, todo: 1, overdue: 1, completionPercent: 50 })
    expect(status.done + status.inProgress + status.todo + status.overdue).toBe(status.total)
  })

  it('reports per-project progress with open estimates and the last completion date', () => {
    const { projects } = computeInsightsReport({ ...base, from: '2026-11-14', to: '2026-11-20' })
    expect(projects.find((project) => project.projectId === thesis.id)).toEqual({
      projectId: thesis.id, name: 'Thesis', total: 3, done: 2, percent: 66, /* toPercent rounds down, like everywhere else */ openEstimateMinutes: 120, unestimatedOpen: 0, lastCompletedOn: '2026-11-18',
    })
  })

  it('separates focus marked done, sessions never marked, skipped and planned; planning never counts as done', () => {
    const { focus } = computeInsightsReport({ ...base, from: '2026-11-14', to: '2026-11-20' })
    expect(focus.completedMinutes).toBe(120)
    expect(focus.completedSessions).toBe(1)
    expect(focus.unmarkedMinutes).toBe(60)
    expect(focus.unmarkedSessions).toBe(1)
    expect(focus.skippedSessions).toBe(1)
    expect(focus.plannedNext7Minutes).toBe(90 + 120)
    expect(focus.upcomingSessions).toBe(2)
    expect(focus.series.find((bucket) => bucket.from === '2026-11-16')).toMatchObject({ completedMinutes: 120, unmarkedMinutes: 0 })
    expect(focus.openWithSession).toBe(1) // inProgress has upcoming sessions
    expect(focus.openWithoutSession).toBe(2)
  })

  it('limits every figure to the selected project, including its linked sessions', () => {
    const report = computeInsightsReport({ ...base, from: '2026-11-14', to: '2026-11-20', projectId: stats.id })
    expect(report.status.total).toBe(3)
    expect(report.projects.map((project) => project.name)).toEqual(['Statistics'])
    expect(report.completed.inRange).toBe(1)
    expect(report.focus.completedMinutes).toBe(0)
    expect(report.focus.unmarkedSessions).toBe(1)
    expect(report.focus.plannedNext7Minutes).toBe(0)
  })

  it('adds explainable suggestions: stale projects and sessions never marked', () => {
    const report = computeInsightsReport({ ...base, from: '2026-11-14', to: '2026-11-20' })
    const kinds = report.suggestions.map((suggestion) => suggestion.kind)
    expect(kinds).toContain('overdue')
    expect(kinds).toContain('unmarked_sessions')
    const stale = computeInsightsReport({ ...base, from: '2026-11-14', to: '2026-11-20', now: zonedToUtc('2026-12-10', 9 * 60, TZ) })
    expect(stale.suggestions.filter((suggestion) => suggestion.kind === 'stale_project').map((suggestion) => suggestion.projectId).sort()).toEqual([stats.id, thesis.id].sort())
  })

  it('handles an empty project without dividing by zero', () => {
    const empty = makeProject({ name: 'Personal' })
    const report = computeInsightsReport({ ...base, projects: [empty], from: '2026-11-14', to: '2026-11-20', projectId: empty.id })
    expect(report.status).toEqual({ total: 0, done: 0, inProgress: 0, todo: 0, overdue: 0, completionPercent: 0 })
    expect(report.projects[0].percent).toBe(0)
    expect(report.suggestions).toEqual([])
  })
})
