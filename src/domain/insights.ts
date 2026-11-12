import { WORK_CATEGORIES, type Occurrence } from './calendar'
import { addDays, type IsoDate } from './dates'
import { getDeadlineStatus } from './deadlines'
import type { Preferences } from './scheduling'
import type { Project, Task } from './schemas'
import { computeTaskStats, toPercent } from './stats'
import { eachDate, minutesBetween, weekdayOfDate, zonedParts } from './zonedTime'

/*
  Progress intelligence (M9): numbers and suggestions derived *only* from the user's real
  tasks and calendar. Nothing here is estimated by AI; the assistant may explain these
  numbers, but it never invents them.
*/

/** How many days ahead "upcoming" and the workload chart look. */
export const INSIGHT_DAYS = 7

export interface DayWorkload {
  date: IsoDate
  /** Minutes of work sessions, study and focus time on the calendar. */
  scheduledMinutes: number
  /** The daily maximum from the preferences, or 0 on a non-working day. */
  capacityMinutes: number
  /** Open tasks due that day. */
  dueTasks: number
}

export type SuggestionKind = 'overdue' | 'overloaded_day' | 'unscheduled_urgent' | 'missing_estimate' | 'nothing_planned'

export interface Suggestion {
  kind: SuggestionKind
  message: string
  taskIds: string[]
  date?: IsoDate
}

export interface Insights {
  today: IsoDate
  counts: { total: number; completed: number; pending: number; overdue: number; dueToday: number; upcoming: number; completedLast7Days: number }
  completionPercent: number
  projects: { projectId: string; name: string; total: number; done: number; percent: number }[]
  workload: DayWorkload[]
  /** Open tasks with or without at least one upcoming linked calendar session. */
  scheduling: { scheduled: number; unscheduled: number; unscheduledTaskIds: string[] }
  suggestions: Suggestion[]
}

export function computeInsights(input: {
  tasks: readonly Task[]
  projects: readonly Project[]
  /** Occurrences from now until at least INSIGHT_DAYS ahead. */
  upcoming: readonly Occurrence[]
  prefs: Preferences
  now: Date
}): Insights {
  const { tasks, prefs, now } = input
  const today = zonedParts(now, prefs.timeZone).date
  const lastDay = addDays(today, INSIGHT_DAYS - 1)
  const stats = computeTaskStats(tasks, today)
  const open = tasks.filter((task) => task.status !== 'done')
  const weekAgo = now.getTime() - INSIGHT_DAYS * 86_400_000

  const upcomingDue = open.filter((task) => task.dueDate !== null && task.dueDate > today && task.dueDate <= lastDay)
  const counts = {
    total: stats.total,
    completed: stats.byStatus.done,
    pending: open.length,
    overdue: stats.overdue,
    dueToday: stats.dueToday,
    upcoming: upcomingDue.length,
    completedLast7Days: tasks.filter((task) => task.completedAt !== null && new Date(task.completedAt).getTime() >= weekAgo).length,
  }

  const projects = input.projects.map((project) => {
    const own = tasks.filter((task) => task.projectId === project.id)
    const done = own.filter((task) => task.status === 'done').length
    return { projectId: project.id, name: project.name, total: own.length, done, percent: toPercent(done, own.length) }
  })

  const workload: DayWorkload[] = eachDate(today, lastDay).map((date) => ({
    date,
    scheduledMinutes: 0,
    capacityMinutes: prefs.workDays.includes(weekdayOfDate(date)) ? prefs.maxDailyMinutes : 0,
    dueTasks: open.filter((task) => task.dueDate === date).length,
  }))
  const byDate = new Map(workload.map((day) => [day.date, day]))
  for (const occurrence of input.upcoming) {
    if (!WORK_CATEGORIES.includes(occurrence.category)) continue
    const day = byDate.get(zonedParts(new Date(occurrence.start), prefs.timeZone).date)
    if (day) day.scheduledMinutes += minutesBetween(new Date(occurrence.start), new Date(occurrence.end))
  }

  const sessionTaskIds = new Set(
    input.upcoming.filter((occurrence) => occurrence.taskId !== null && new Date(occurrence.end) > now).map((occurrence) => occurrence.taskId),
  )
  const unscheduledTasks = open.filter((task) => !sessionTaskIds.has(task.id))

  return {
    today,
    counts,
    completionPercent: stats.completionPercent,
    projects,
    workload,
    scheduling: {
      scheduled: open.length - unscheduledTasks.length,
      unscheduled: unscheduledTasks.length,
      unscheduledTaskIds: unscheduledTasks.map((task) => task.id),
    },
    suggestions: suggest(open, unscheduledTasks, workload, today),
  }
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`

/** Rule-based suggestions; each one points at the tasks or day it's about. */
function suggest(open: readonly Task[], unscheduled: readonly Task[], workload: readonly DayWorkload[], today: IsoDate): Suggestion[] {
  const suggestions: Suggestion[] = []

  const overdue = open.filter((task) => getDeadlineStatus(task, today) === 'overdue')
  if (overdue.length > 0) {
    suggestions.push({
      kind: 'overdue',
      message: `${plural(overdue.length, 'task')} ${overdue.length === 1 ? 'is' : 'are'} overdue. Finish ${overdue.length === 1 ? 'it' : 'them'}, or move the deadline to a realistic date.`,
      taskIds: overdue.map((task) => task.id),
    })
  }

  for (const day of workload) {
    if (day.capacityMinutes > 0 && day.scheduledMinutes > day.capacityMinutes) {
      suggestions.push({
        kind: 'overloaded_day',
        message: `${day.date} has ${Math.round((day.scheduledMinutes / 60) * 10) / 10} h of work planned, more than your daily maximum of ${day.capacityMinutes / 60} h. Consider moving a session.`,
        taskIds: [],
        date: day.date,
      })
    }
  }

  const soon = addDays(today, 3)
  const urgent = unscheduled.filter((task) => task.dueDate !== null && task.dueDate >= today && task.dueDate <= soon)
  if (urgent.length > 0) {
    suggestions.push({
      kind: 'unscheduled_urgent',
      message: `${plural(urgent.length, 'task')} due within 3 days ${urgent.length === 1 ? 'has' : 'have'} no time reserved. Schedule ${urgent.length === 1 ? 'it' : 'them'} on the calendar.`,
      taskIds: urgent.map((task) => task.id),
    })
  }

  const noEstimate = open.filter((task) => task.estimatedMinutes === null)
  if (noEstimate.length > 0) {
    suggestions.push({
      kind: 'missing_estimate',
      message: `${plural(noEstimate.length, 'open task')} ${noEstimate.length === 1 ? 'has' : 'have'} no time estimate. Estimates make automatic scheduling more accurate.`,
      taskIds: noEstimate.map((task) => task.id),
    })
  }

  if (open.length > 0 && workload.every((day) => day.scheduledMinutes === 0)) {
    suggestions.push({
      kind: 'nothing_planned',
      message: 'No work sessions are planned for the next 7 days. Let the scheduler propose a plan for your open tasks.',
      taskIds: [],
    })
  }
  return suggestions
}
