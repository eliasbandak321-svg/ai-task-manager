import { WORK_CATEGORIES, type EventCategory, type SessionStatus } from './calendar'
import { minutesBetween } from './zonedTime'

/*
  Effort tracking (M9). A task's estimate is compared with its work sessions on the calendar:
  - completed: sessions the user marked as done — the only work counted as done;
  - planned:   upcoming (or ongoing) sessions not marked skipped;
  - missed:    past sessions never marked — neither done nor planned, so they're rescheduled;
  - skipped:   ignored.
  Only work categories (work session, study, focus) count.
*/

export interface EffortSession {
  taskId: string | null
  start: string
  end: string
  category: EventCategory
  sessionStatus: SessionStatus
}

export interface TaskEffort {
  estimatedMinutes: number | null
  completedMinutes: number
  plannedMinutes: number
  missedMinutes: number
  /** Estimate minus completed work; null without an estimate. */
  remainingMinutes: number | null
  /** End of the last planned session (when the task is expected to be finished), or null. */
  plannedUntil: string | null
}

export function computeTaskEffort(
  task: { id: string; estimatedMinutes: number | null },
  sessions: readonly EffortSession[],
  now: Date,
): TaskEffort {
  const effort: TaskEffort = {
    estimatedMinutes: task.estimatedMinutes,
    completedMinutes: 0,
    plannedMinutes: 0,
    missedMinutes: 0,
    remainingMinutes: null,
    plannedUntil: null,
  }
  const nowIso = now.toISOString()
  for (const session of sessions) {
    if (session.taskId !== task.id || !WORK_CATEGORIES.includes(session.category)) continue
    const minutes = minutesBetween(new Date(session.start), new Date(session.end))
    if (session.sessionStatus === 'completed') effort.completedMinutes += minutes
    else if (session.sessionStatus === 'skipped') continue
    else if (session.end > nowIso) {
      effort.plannedMinutes += minutes
      if (effort.plannedUntil === null || session.end > effort.plannedUntil) effort.plannedUntil = session.end
    } else effort.missedMinutes += minutes
  }
  effort.remainingMinutes = task.estimatedMinutes === null ? null : Math.max(0, task.estimatedMinutes - effort.completedMinutes)
  return effort
}
