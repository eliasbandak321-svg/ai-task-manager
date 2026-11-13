import { z } from 'zod'
import { WORK_CATEGORIES, timeZoneSchema, type EventCategory } from './calendar'
import { addDays, type IsoDate } from './dates'
import type { TaskPriority } from './schemas'
import { addMinutes, eachDate, MINUTES_PER_DAY, minutesBetween, weekdayOfDate, zonedParts, zonedToUtc } from './zonedTime'

/*
  The scheduling engine (M9): places work sessions for tasks into the user's free time.
  It is deterministic — the AI may *ask* for a schedule, but every time slot is computed here,
  so results are explainable, testable and never overbook the user.

  Rules:
  1. Free time = working hours on working days, minus existing commitments, after `now`.
  2. Tasks are placed by deadline (earliest first), then priority, then age.
  3. Sessions are at most `sessionMinutes` long, separated by `breakMinutes`, and a day never
     exceeds `maxDailyMinutes` of work (existing work events count too).
  4. Within a day, the preferred focus period is used first.
  5. A task is only scheduled before the end of its due date. What doesn't fit is reported with
     the reason and the missing minutes — never silently dropped or squeezed in.
*/

export const USE_CASES = ['student', 'developer', 'professional', 'freelancer', 'personal', 'general'] as const
export type UseCase = (typeof USE_CASES)[number]
export const USE_CASE_LABELS: Record<UseCase, string> = {
  student: 'Student',
  developer: 'Developer',
  professional: 'Professional',
  freelancer: 'Freelancer',
  personal: 'Personal productivity',
  general: 'General',
}

export const FOCUS_PERIODS = ['morning', 'afternoon', 'evening', 'none'] as const
export type FocusPeriod = (typeof FOCUS_PERIODS)[number]
const FOCUS_WINDOWS: Record<Exclude<FocusPeriod, 'none'>, [number, number]> = {
  morning: [5 * 60, 12 * 60],
  afternoon: [12 * 60, 17 * 60],
  evening: [17 * 60, 23 * 60],
}

export const preferencesSchema = z
  .strictObject({
    timeZone: timeZoneSchema,
    useCase: z.enum(USE_CASES),
    /** 0 = Sunday … 6 = Saturday. */
    workDays: z.array(z.int().min(0).max(6)).min(1, 'Choose at least one working day').max(7),
    dayStartMinutes: z.int().min(0).max(MINUTES_PER_DAY - 30),
    dayEndMinutes: z.int().min(30).max(MINUTES_PER_DAY),
    focusPeriod: z.enum(FOCUS_PERIODS),
    sessionMinutes: z.int().min(15).max(240),
    breakMinutes: z.int().min(0).max(60),
    maxDailyMinutes: z.int().min(30).max(16 * 60),
  })
  .refine((prefs) => prefs.dayEndMinutes - prefs.dayStartMinutes >= 30, {
    message: 'The day must end at least 30 minutes after it starts',
    path: ['dayEndMinutes'],
  })
export type Preferences = z.output<typeof preferencesSchema>

export function defaultPreferences(timeZone: string): Preferences {
  return {
    timeZone,
    useCase: 'general',
    workDays: [1, 2, 3, 4, 5],
    dayStartMinutes: 9 * 60,
    dayEndMinutes: 17 * 60,
    focusPeriod: 'morning',
    sessionMinutes: 60,
    breakMinutes: 10,
    maxDailyMinutes: 6 * 60,
  }
}

/** Assumed effort for a task without an estimate; the proposal says so. */
export const DEFAULT_ESTIMATE_MINUTES = 60
const MIN_SESSION_MINUTES = 15
const PRIORITY_RANK: Record<TaskPriority, number> = { high: 0, medium: 1, low: 2 }

export interface SchedulableTask {
  id: string
  title: string
  priority: TaskPriority
  dueDate: IsoDate | null
  createdAt: string
  /** Total estimate, or null when unknown. */
  estimatedMinutes: number | null
  /** Work already done: sessions marked completed. */
  completedMinutes: number
  /** Upcoming sessions that are kept (not replanned). */
  plannedMinutes: number
  /** End of the last kept upcoming session, if any. */
  plannedUntil: Date | null
  /** Prerequisites (open tasks that must finish first). Done or unknown ids are ignored. */
  dependsOn: readonly string[]
}

export interface BusyInterval {
  start: Date
  end: Date
  category: EventCategory
}

export interface ProposedSession {
  taskId: string
  start: Date
  end: Date
}

export type UnscheduledReason = 'not_enough_time' | 'deadline_passed' | 'blocked_by_dependency' | 'dependency_cycle'

export interface ScheduleResult {
  sessions: ProposedSession[]
  /** Tasks (or parts of them) that couldn't be placed, and why. */
  unscheduled: { taskId: string; reason: UnscheduledReason; missingMinutes: number; blockedBy?: string }[]
  /** Tasks scheduled with DEFAULT_ESTIMATE_MINUTES because they had no estimate. */
  assumedEstimates: string[]
  freeMinutes: number
  requestedMinutes: number
}

interface Slot {
  date: IsoDate
  start: Date
  end: Date
  inFocus: boolean
}

/** Subtracts busy intervals from [start, end). */
function subtract(start: Date, end: Date, busy: readonly BusyInterval[]): { start: Date; end: Date }[] {
  let pieces = [{ start, end }]
  for (const interval of busy) {
    pieces = pieces.flatMap((piece) => {
      if (interval.end <= piece.start || interval.start >= piece.end) return [piece]
      const parts = []
      if (interval.start > piece.start) parts.push({ start: piece.start, end: interval.start })
      if (interval.end < piece.end) parts.push({ start: interval.end, end: piece.end })
      return parts
    })
  }
  return pieces.filter((piece) => minutesBetween(piece.start, piece.end) >= MIN_SESSION_MINUTES)
}

/** Free working-time slots between local dates `from` and `to` (inclusive), after `now`. */
export function freeSlots(prefs: Preferences, busy: readonly BusyInterval[], from: IsoDate, to: IsoDate, now: Date): Slot[] {
  const slots: Slot[] = []
  for (const date of eachDate(from, to)) {
    if (!prefs.workDays.includes(weekdayOfDate(date))) continue
    const dayStart = zonedToUtc(date, prefs.dayStartMinutes, prefs.timeZone)
    const dayEnd = zonedToUtc(date, prefs.dayEndMinutes, prefs.timeZone)
    const start = dayStart < now ? now : dayStart
    if (start >= dayEnd) continue

    // Split the working day at the focus window's edges, so focus time can be preferred.
    const edges = [start, dayEnd]
    if (prefs.focusPeriod !== 'none') {
      for (const minutes of FOCUS_WINDOWS[prefs.focusPeriod]) {
        const edge = zonedToUtc(date, minutes, prefs.timeZone)
        if (edge > start && edge < dayEnd) edges.push(edge)
      }
    }
    edges.sort((a, b) => a.getTime() - b.getTime())
    for (let i = 0; i < edges.length - 1; i += 1) {
      const middle = zonedParts(addMinutes(edges[i], 1), prefs.timeZone).minutes
      const inFocus =
        prefs.focusPeriod !== 'none' &&
        middle >= FOCUS_WINDOWS[prefs.focusPeriod][0] &&
        middle < FOCUS_WINDOWS[prefs.focusPeriod][1]
      for (const piece of subtract(edges[i], edges[i + 1], busy)) slots.push({ date, ...piece, inFocus })
    }
  }
  return slots
}

/** Minutes of existing work per local date (they count towards the daily maximum). */
function existingWorkByDate(busy: readonly BusyInterval[], timeZone: string): Map<IsoDate, number> {
  const totals = new Map<IsoDate, number>()
  for (const interval of busy) {
    if (!WORK_CATEGORIES.includes(interval.category)) continue
    const date = zonedParts(interval.start, timeZone).date
    totals.set(date, (totals.get(date) ?? 0) + minutesBetween(interval.start, interval.end))
  }
  return totals
}

/**
 * Orders tasks so prerequisites come first; among ready tasks, the most urgent first.
 * Urgency is inherited: a prerequisite is as urgent as its most urgent dependent.
 * Tasks on a cycle are returned separately.
 */
function dependencyOrder(tasks: readonly SchedulableTask[]): { ordered: SchedulableTask[]; cyclic: SchedulableTask[] } {
  const byId = new Map(tasks.map((task) => [task.id, task]))
  const prerequisites = new Map(tasks.map((task) => [task.id, task.dependsOn.filter((id) => byId.has(id) && id !== task.id)]))
  const dependents = new Map<string, string[]>()
  for (const [id, prereqs] of prerequisites) for (const prereq of prereqs) dependents.set(prereq, [...(dependents.get(prereq) ?? []), id])

  // Effective deadline: the earliest due date among the task and everything that depends on it.
  const effectiveDue = new Map<string, string>()
  function due(id: string, seen: Set<string>): string {
    const known = effectiveDue.get(id)
    if (known !== undefined) return known
    if (seen.has(id)) return '9999-12-31'
    seen.add(id)
    const own = byId.get(id)?.dueDate ?? '9999-12-31'
    const value = (dependents.get(id) ?? []).reduce((min, dependent) => {
      const other = due(dependent, seen)
      return other < min ? other : min
    }, own)
    effectiveDue.set(id, value)
    return value
  }
  for (const task of tasks) due(task.id, new Set())

  const rank = (a: SchedulableTask, b: SchedulableTask) =>
    (effectiveDue.get(a.id) as string).localeCompare(effectiveDue.get(b.id) as string) ||
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
    a.createdAt.localeCompare(b.createdAt) ||
    a.id.localeCompare(b.id)

  const waiting = new Map(tasks.map((task) => [task.id, (prerequisites.get(task.id) ?? []).length]))
  const ready = tasks.filter((task) => waiting.get(task.id) === 0)
  const ordered: SchedulableTask[] = []
  while (ready.length > 0) {
    ready.sort(rank)
    const next = ready.shift() as SchedulableTask
    ordered.push(next)
    for (const dependent of dependents.get(next.id) ?? []) {
      const left = (waiting.get(dependent) ?? 0) - 1
      waiting.set(dependent, left)
      if (left === 0) ready.push(byId.get(dependent) as SchedulableTask)
    }
  }
  const placed = new Set(ordered.map((task) => task.id))
  return { ordered, cyclic: tasks.filter((task) => !placed.has(task.id)) }
}

export function scheduleTasks(input: {
  tasks: readonly SchedulableTask[]
  busy: readonly BusyInterval[]
  prefs: Preferences
  from: IsoDate
  to: IsoDate
  now: Date
}): ScheduleResult {
  const { prefs, now } = input
  const today = zonedParts(now, prefs.timeZone).date
  const from = input.from < today ? today : input.from
  const slots = from <= input.to ? freeSlots(prefs, input.busy, from, input.to, now) : []
  const dailyUsed = existingWorkByDate(input.busy, prefs.timeZone)
  const freeMinutes = slots.reduce((sum, slot) => sum + minutesBetween(slot.start, slot.end), 0)
  const { ordered, cyclic } = dependencyOrder(input.tasks)

  const result: ScheduleResult = { sessions: [], unscheduled: [], assumedEstimates: [], freeMinutes, requestedMinutes: 0 }
  /** When each task is expected to be finished (null: already done/ready now); absent = not finished in time. */
  const finishedAt = new Map<string, Date | null>()
  const inSet = new Set(input.tasks.map((task) => task.id))

  for (const task of cyclic) {
    const needed = Math.max(0, (task.estimatedMinutes ?? DEFAULT_ESTIMATE_MINUTES) - task.completedMinutes - task.plannedMinutes)
    result.unscheduled.push({ taskId: task.id, reason: 'dependency_cycle', missingMinutes: needed })
  }

  for (const task of ordered) {
    if (task.estimatedMinutes === null) result.assumedEstimates.push(task.id)
    let remaining = Math.max(0, (task.estimatedMinutes ?? DEFAULT_ESTIMATE_MINUTES) - task.completedMinutes - task.plannedMinutes)
    result.requestedMinutes += remaining

    // Not before every prerequisite is finished.
    let earliest: Date | null = null
    const blocker = task.dependsOn.find((id) => inSet.has(id) && !finishedAt.has(id))
    if (blocker) {
      result.unscheduled.push({ taskId: task.id, reason: 'blocked_by_dependency', missingMinutes: remaining, blockedBy: blocker })
      continue
    }
    for (const id of task.dependsOn) {
      const end = finishedAt.get(id)
      if (end && (earliest === null || end > earliest)) earliest = end
    }

    if (remaining === 0) {
      finishedAt.set(task.id, task.plannedUntil && earliest && task.plannedUntil < earliest ? earliest : (task.plannedUntil ?? earliest))
      continue
    }
    if (task.dueDate !== null && task.dueDate < today) {
      result.unscheduled.push({ taskId: task.id, reason: 'deadline_passed', missingMinutes: remaining })
      continue
    }
    // Work must end by the end of the due date (local).
    const deadline = task.dueDate === null ? null : zonedToUtc(addDays(task.dueDate, 1), 0, prefs.timeZone)
    let lastEnd: Date | null = task.plannedUntil

    // Days in order; within a day, focus slots first.
    const candidates = [...slots].sort(
      (a, b) => a.date.localeCompare(b.date) || Number(b.inFocus) - Number(a.inFocus) || a.start.getTime() - b.start.getTime(),
    )
    for (const slot of candidates) {
      // Fill the slot with sessions until the task, the slot or the day's budget runs out.
      while (remaining > 0) {
        const start = earliest !== null && earliest > slot.start ? earliest : slot.start
        if (deadline !== null && start >= deadline) break
        const dayLeft = prefs.maxDailyMinutes - (dailyUsed.get(slot.date) ?? 0)
        const slotEnd = deadline !== null && slot.end > deadline ? deadline : slot.end
        const length = Math.min(remaining, prefs.sessionMinutes, minutesBetween(start, slotEnd), dayLeft)
        // Avoid tiny fragments, unless it's exactly what's left of the task.
        if (length <= 0 || length < Math.min(MIN_SESSION_MINUTES, remaining)) break

        // Time skipped before a dependency-constrained start stays free for other tasks.
        if (start > slot.start && minutesBetween(slot.start, start) >= MIN_SESSION_MINUTES) {
          slots.push({ date: slot.date, start: slot.start, end: start, inFocus: slot.inFocus })
        }
        const end = addMinutes(start, length)
        result.sessions.push({ taskId: task.id, start, end })
        remaining -= length
        if (lastEnd === null || end > lastEnd) lastEnd = end
        dailyUsed.set(slot.date, (dailyUsed.get(slot.date) ?? 0) + length)
        // The rest of the slot starts after a break.
        slot.start = addMinutes(end, prefs.breakMinutes)
        if (slot.start >= slot.end) slot.end = slot.start
      }
      if (remaining === 0) break
    }
    if (remaining > 0) result.unscheduled.push({ taskId: task.id, reason: 'not_enough_time', missingMinutes: remaining })
    else finishedAt.set(task.id, lastEnd)
  }
  result.sessions.sort((a, b) => a.start.getTime() - b.start.getTime())
  return result
}
