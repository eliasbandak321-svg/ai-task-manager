import { WORK_CATEGORIES, type Occurrence } from './calendar'
import { addDays, daysBetween, type IsoDate } from './dates'
import { getDeadlineStatus } from './deadlines'
import { computeInsights, type DayWorkload, type Suggestion } from './insights'
import type { Preferences } from './scheduling'
import type { Project, Task } from './schemas'
import { toPercent } from './stats'
import { eachDate, minutesBetween, weekdayOfDate, zonedParts } from './zonedTime'

/*
  Insights for a chosen period and project (M10). Builds on computeInsights (workload and the
  rule-based suggestions) and adds what the Insights page filters by. Everything is derived from
  stored data only:
  - completion trends use task.completedAt (set when a task becomes Done, cleared if reopened),
    so they count tasks that are currently done;
  - focus time uses the session status the user sets on calendar sessions: "completed" counts as
    focus done, past sessions without a status are reported as "not marked", planned sessions are
    never counted as done. There is no timer, so this is self-reported time, not measured time.
*/

export type InsightsGranularity = 'day' | 'week' | 'month'

export interface InsightsBucket {
  from: IsoDate
  to: IsoDate
}

export interface InsightsReport {
  range: { from: IsoDate; to: IsoDate; days: number }
  completed: { inRange: number; previousRange: number; series: (InsightsBucket & { count: number })[] }
  /** Current snapshot. Each task is counted once: open tasks past their due date only as overdue. */
  status: { total: number; done: number; inProgress: number; todo: number; overdue: number; completionPercent: number }
  projects: {
    projectId: string
    name: string
    total: number
    done: number
    percent: number
    openEstimateMinutes: number
    unestimatedOpen: number
    lastCompletedOn: IsoDate | null
  }[]
  focus: {
    completedMinutes: number
    completedSessions: number
    unmarkedMinutes: number
    unmarkedSessions: number
    skippedSessions: number
    series: (InsightsBucket & { completedMinutes: number; unmarkedMinutes: number })[]
    /** Planned (not skipped) work sessions from now until the end of the 7th day. */
    plannedNext7Minutes: number
    upcomingSessions: number
    openWithSession: number
    openWithoutSession: number
  }
  /** The next 7 days, from computeInsights. */
  workload: DayWorkload[]
  suggestions: Suggestion[]
}

export interface InsightsReportInput {
  tasks: readonly Task[]
  projects: readonly Project[]
  /** Calendar occurrences covering the period and the next 7 days. */
  occurrences: readonly Occurrence[]
  prefs: Preferences
  now: Date
  from: IsoDate
  to: IsoDate
  /** null for all projects. */
  projectId: string | null
  granularity: InsightsGranularity
}

/** How long without a completed task before a project with open work is flagged. */
export const STALE_PROJECT_DAYS = 14

export function buildBuckets(from: IsoDate, to: IsoDate, granularity: InsightsGranularity): InsightsBucket[] {
  if (granularity === 'day') return eachDate(from, to).map((date) => ({ from: date, to: date }))
  const buckets: InsightsBucket[] = []
  let start = from
  while (start <= to) {
    let end: IsoDate
    if (granularity === 'week') {
      const weekday = weekdayOfDate(start) // 0 = Sunday
      end = addDays(start, (7 - weekday) % 7)
    } else {
      const [year, month] = start.split('-').map(Number)
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
      end = `${start.slice(0, 8)}${String(lastDay).padStart(2, '0')}`
    }
    if (end > to) end = to
    buckets.push({ from: start, to: end })
    start = addDays(end, 1)
  }
  return buckets
}

type SessionKind = 'done' | 'unmarked' | 'skipped' | 'planned'

function classify(occurrence: Occurrence, now: Date): SessionKind {
  if (occurrence.sessionStatus === 'completed') return 'done'
  if (occurrence.sessionStatus === 'skipped') return 'skipped'
  return new Date(occurrence.end) > now ? 'planned' : 'unmarked'
}

export function computeInsightsReport(input: InsightsReportInput): InsightsReport {
  const { prefs, now, from, to, projectId, granularity } = input
  const zone = prefs.timeZone
  const today = zonedParts(now, zone).date
  const dateOf = (instant: string) => zonedParts(new Date(instant), zone).date

  const projects = projectId === null ? input.projects : input.projects.filter((project) => project.id === projectId)
  const tasks = projectId === null ? input.tasks : input.tasks.filter((task) => task.projectId === projectId)
  const taskIds = new Set(tasks.map((task) => task.id))
  const occurrences = input.occurrences.filter(
    (occurrence) => WORK_CATEGORIES.includes(occurrence.category) && (projectId === null || (occurrence.taskId !== null && taskIds.has(occurrence.taskId))),
  )

  // Completions
  const completedOn = new Map(tasks.filter((task) => task.completedAt !== null).map((task) => [task.id, dateOf(task.completedAt!)]))
  const days = daysBetween(from, to) + 1
  const countBetween = (a: IsoDate, b: IsoDate) => [...completedOn.values()].filter((date) => date >= a && date <= b).length
  const buckets = buildBuckets(from, to, granularity)

  // Current status (each task once)
  const open = tasks.filter((task) => task.status !== 'done')
  const overdue = open.filter((task) => getDeadlineStatus(task, today) === 'overdue')
  const overdueIds = new Set(overdue.map((task) => task.id))
  const done = tasks.length - open.length
  const status = {
    total: tasks.length,
    done,
    inProgress: open.filter((task) => task.status === 'in_progress' && !overdueIds.has(task.id)).length,
    todo: open.filter((task) => task.status === 'todo' && !overdueIds.has(task.id)).length,
    overdue: overdue.length,
    completionPercent: toPercent(done, tasks.length),
  }

  const projectRows = projects.map((project) => {
    const own = tasks.filter((task) => task.projectId === project.id)
    const ownOpen = own.filter((task) => task.status !== 'done')
    const completions = own.map((task) => completedOn.get(task.id)).filter((date): date is IsoDate => date !== undefined).sort()
    const ownDone = own.length - ownOpen.length
    return {
      projectId: project.id,
      name: project.name,
      total: own.length,
      done: ownDone,
      percent: toPercent(ownDone, own.length),
      openEstimateMinutes: ownOpen.reduce((sum, task) => sum + (task.estimatedMinutes ?? 0), 0),
      unestimatedOpen: ownOpen.filter((task) => task.estimatedMinutes === null).length,
      lastCompletedOn: completions.at(-1) ?? null,
    }
  })

  // Focus
  const withKind = occurrences.map((occurrence) => ({ occurrence, kind: classify(occurrence, now), date: dateOf(occurrence.start), minutes: minutesBetween(new Date(occurrence.start), new Date(occurrence.end)) }))
  const inPeriod = withKind.filter((item) => item.date >= from && item.date <= to)
  const sum = (items: typeof withKind, kind: SessionKind) => items.filter((item) => item.kind === kind).reduce((total, item) => total + item.minutes, 0)
  const lastPlanningDay = addDays(today, 6)
  const upcoming = withKind.filter((item) => item.kind === 'planned' && item.date <= lastPlanningDay)
  const scheduledTaskIds = new Set(withKind.filter((item) => item.kind === 'planned').map((item) => item.occurrence.taskId))
  const focus = {
    completedMinutes: sum(inPeriod, 'done'),
    completedSessions: inPeriod.filter((item) => item.kind === 'done').length,
    unmarkedMinutes: sum(inPeriod, 'unmarked'),
    unmarkedSessions: inPeriod.filter((item) => item.kind === 'unmarked').length,
    skippedSessions: inPeriod.filter((item) => item.kind === 'skipped').length,
    series: buckets.map((bucket) => {
      const items = inPeriod.filter((item) => item.date >= bucket.from && item.date <= bucket.to)
      return { ...bucket, completedMinutes: sum(items, 'done'), unmarkedMinutes: sum(items, 'unmarked') }
    }),
    plannedNext7Minutes: upcoming.reduce((total, item) => total + item.minutes, 0),
    upcomingSessions: upcoming.length,
    openWithSession: open.filter((task) => scheduledTaskIds.has(task.id)).length,
    openWithoutSession: open.filter((task) => !scheduledTaskIds.has(task.id)).length,
  }

  // Workload and the existing suggestions, for the same scope.
  const base = computeInsights({
    tasks,
    projects,
    upcoming: occurrences.filter((occurrence) => new Date(occurrence.end) > now),
    prefs,
    now,
  })
  const suggestions: Suggestion[] = [...base.suggestions]
  if (focus.unmarkedSessions > 0) {
    suggestions.push({
      kind: 'unmarked_sessions',
      message: `${focus.unmarkedSessions} past work session${focus.unmarkedSessions === 1 ? ' was' : 's were'} never marked done or skipped. Mark ${focus.unmarkedSessions === 1 ? 'it' : 'them'} on the calendar so your focus figures stay accurate.`,
      taskIds: [],
    })
  }
  for (const row of projectRows) {
    const openCount = row.total - row.done
    if (openCount === 0) continue
    const idle = row.lastCompletedOn === null ? null : daysBetween(row.lastCompletedOn, today)
    if (idle !== null && idle < STALE_PROJECT_DAYS) continue
    suggestions.push({
      kind: 'stale_project',
      message:
        idle === null
          ? `${row.name}: no task finished yet, ${openCount} still open.`
          : `${row.name}: no task finished in ${idle} days, ${openCount} still open.`,
      taskIds: [],
      projectId: row.projectId,
    })
  }

  return {
    range: { from, to, days },
    completed: {
      inRange: countBetween(from, to),
      previousRange: countBetween(addDays(from, -days), addDays(from, -1)),
      series: buckets.map((bucket) => ({ ...bucket, count: countBetween(bucket.from, bucket.to) })),
    },
    status,
    projects: projectRows,
    focus,
    workload: base.workload,
    suggestions,
  }
}
