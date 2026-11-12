import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import {
  addDays,
  applyProposalInputSchema,
  createEventInputSchema,
  DomainError,
  EVENT_CATEGORY_LABELS,
  idSchema,
  isoDateSchema,
  LIMITS,
  planTaskDescription,
  scheduleTasks,
  computeTaskEffort,
  openPrerequisites,
  prerequisitesOf,
  zonedParts,
  zonedRange,
  type ChangesPayload,
  type Operation,
  type Preferences,
  type ProjectPlan,
  type Proposal,
  type ProposalBasis,
  type ProposalSource,
  type ScheduleItem,
  type SchedulePayload,
  type Task,
  type TaskEffort,
} from '../../src/domain'
import type { Database } from '../db/client'
import { DbRepository } from '../db/dbRepository'
import { CalendarStore } from './calendarStore'
import { DependencyStore } from './dependencyStore'
import { PreferencesStore } from './preferencesStore'
import { ProposalStore } from './proposalStore'

/*
  The workspace of one signed-in user: tasks, calendar, preferences and proposals, plus the
  two flows that change several of them at once — scheduling and approving proposals.
  Everything is scoped to the user id from the session.
*/

/** The longest period one schedule proposal may cover. */
export const MAX_SCHEDULE_DAYS = 31

export const scheduleRequestSchema = z
  .strictObject({
    mode: z.enum(['fill', 'replan']).default('fill'),
    from: isoDateSchema,
    to: isoDateSchema,
    /** Only these tasks; default: every open task. */
    taskIds: z.array(idSchema).max(100).nullable().default(null),
  })
  .refine(({ from, to }) => to >= from && to <= addDays(from, MAX_SCHEDULE_DAYS - 1), {
    message: `Choose a period of 1 to ${MAX_SCHEDULE_DAYS} days`,
    path: ['to'],
  })
export type ScheduleRequest = z.input<typeof scheduleRequestSchema>

const hours = (minutes: number) => `${Math.round((minutes / 60) * 10) / 10} h`
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const clock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

function localLabel(instant: string, timeZone: string): string {
  const parts = zonedParts(new Date(instant), timeZone)
  return `${DAY_NAMES[parts.weekday]} ${parts.date} ${clock(parts.minutes)}`
}

export interface WorkspaceOptions {
  now?: () => Date
  newId?: () => string
}

export class Workspace {
  readonly db: Database
  readonly userId: string
  readonly now: () => Date
  readonly newId: () => string
  readonly tasks: DbRepository
  readonly calendar: CalendarStore
  readonly preferences: PreferencesStore
  readonly proposals: ProposalStore
  readonly dependencies: DependencyStore

  constructor(db: Database, userId: string, { now = () => new Date(), newId = randomUUID }: WorkspaceOptions = {}) {
    this.db = db
    this.userId = userId
    this.now = now
    this.newId = newId
    this.tasks = new DbRepository(db, userId, { now, newId })
    this.calendar = new CalendarStore(db, userId, now, newId)
    this.preferences = new PreferencesStore(db, userId, now)
    this.proposals = new ProposalStore(db, userId, now, newId)
    this.dependencies = new DependencyStore(db, userId, now)
  }

  /** Effort of every open task (estimate, completed, planned, missed, remaining). */
  async efforts(): Promise<Record<string, TaskEffort>> {
    const now = this.now()
    const [tasks, sessions] = await Promise.all([
      this.tasks.listTasks(),
      this.calendar.linkedSessions(now, new Date(now.getTime() + MAX_SCHEDULE_DAYS * 2 * 86_400_000)),
    ])
    return Object.fromEntries(tasks.map((task) => [task.id, computeTaskEffort(task, sessions, now)]))
  }

  async prefs(): Promise<Preferences> {
    return (await this.preferences.get()).preferences
  }

  // ---------- Scheduling ----------

  async proposeSchedule(input: unknown): Promise<Proposal> {
    const request = scheduleRequestSchema.parse(input)
    const prefs = await this.prefs()
    // Sessions start at a clean time with a little lead: the next quarter hour at least 10
    // minutes away. (Starting right "now" would make the preview stale seconds later.)
    const now = earliestSessionStart(this.now())
    const tz = prefs.timeZone
    const today = zonedParts(now, tz).date
    const from = request.from < today ? today : request.from
    const to = request.to < from ? from : request.to

    const [allTasks, edges] = await Promise.all([this.tasks.listTasks(), this.dependencies.list()])
    if (request.taskIds) {
      const known = new Set(allTasks.map((task) => task.id))
      if (request.taskIds.some((id) => !known.has(id))) throw new DomainError('NOT_FOUND', 'Task not found')
    }
    const openIds = new Set(allTasks.filter((task) => task.status !== 'done').map((task) => task.id))
    const wanted = request.taskIds ? new Set(request.taskIds) : null
    // Open prerequisites of the chosen tasks are scheduled too: the chosen ones can't start without them.
    const added = wanted ? [...openPrerequisites(wanted, edges, (id) => openIds.has(id))].filter((id) => !wanted.has(id)) : []
    const selected = allTasks.filter((task) => openIds.has(task.id) && (wanted === null || wanted.has(task.id) || added.includes(task.id)))
    const selectedIds = new Set(selected.map((task) => task.id))
    const prerequisites = prerequisitesOf(edges)

    const range = zonedRange(from, to, tz)
    const occurrences = await this.calendar.occurrences(now < range.start ? now : range.start, range.end)
    // Replanning may move future, single, task-linked work sessions of the selected tasks.
    // Past sessions, recurring events, meetings and personal time are never touched.
    const replaceable =
      request.mode === 'replan'
        ? occurrences.filter(
            (o) =>
              !o.isRecurring &&
              o.category === 'work_session' &&
              o.sessionStatus === 'planned' &&
              o.taskId !== null &&
              selectedIds.has(o.taskId) &&
              new Date(o.start) >= now,
          )
        : []
    const replaceableIds = new Set(replaceable.map((o) => o.eventId))
    const busy = occurrences
      .filter((o) => !replaceableIds.has(o.eventId))
      .map((o) => ({ start: new Date(o.start), end: new Date(o.end), category: o.category }))

    // Effort per task: completed sessions count as done; kept upcoming sessions as planned
    // (sessions that may be replanned don't count, they're being placed again).
    const sessions = (await this.calendar.linkedSessions(now, range.end)).filter((o) => !replaceableIds.has(o.eventId))
    const realNow = this.now()

    const result = scheduleTasks({
      tasks: selected.map((task) => {
        const effort = computeTaskEffort(task, sessions, realNow)
        return {
          ...task,
          completedMinutes: effort.completedMinutes,
          plannedMinutes: effort.plannedMinutes,
          plannedUntil: effort.plannedUntil ? new Date(effort.plannedUntil) : null,
          dependsOn: (prerequisites.get(task.id) ?? []).filter((id) => openIds.has(id)),
        }
      }),
      busy,
      prefs,
      from,
      to,
      now,
    })

    const titles = new Map(allTasks.map((task) => [task.id, task.title]))
    const items: ScheduleItem[] = []
    const newByTask = groupBy(result.sessions, (session) => session.taskId)
    const oldByTask = groupBy(replaceable, (o) => o.taskId as string)
    for (const taskId of new Set([...newByTask.keys(), ...oldByTask.keys()])) {
      const fresh = newByTask.get(taskId) ?? []
      const old = oldByTask.get(taskId) ?? []
      const title = titles.get(taskId) ?? 'Task'
      fresh.forEach((session, index) => {
        const startAt = session.start.toISOString()
        const endAt = session.end.toISOString()
        const previous = old[index]
        if (!previous) items.push({ type: 'create', taskId, title, startAt, endAt })
        else if (previous.start !== startAt || previous.end !== endAt) {
          items.push({ type: 'move', eventId: previous.eventId, taskId, title, fromStartAt: previous.start, fromEndAt: previous.end, startAt, endAt })
        }
      })
      for (const previous of old.slice(fresh.length)) {
        items.push({ type: 'remove', eventId: previous.eventId, taskId, title, fromStartAt: previous.start, fromEndAt: previous.end })
      }
    }
    const sortKey = (item: ScheduleItem) => ('startAt' in item ? item.startAt : item.fromStartAt)
    items.sort((a, b) => sortKey(a).localeCompare(sortKey(b)))

    const plannedMinutes = result.sessions.reduce((sum, s) => sum + (s.end.getTime() - s.start.getTime()) / 60_000, 0)
    const explanation = [
      `Free working time from ${from} to ${to}: ${hours(result.freeMinutes)} (${prefs.workDays.map((d) => DAY_NAMES[d]).join(', ')}, ${clock(prefs.dayStartMinutes)}–${clock(prefs.dayEndMinutes)}, at most ${hours(prefs.maxDailyMinutes)} of work per day). Existing events are kept free.`,
      result.sessions.length > 0
        ? `Planned ${result.sessions.length} session${result.sessions.length === 1 ? '' : 's'} (${hours(plannedMinutes)}) for ${newByTask.size} task${newByTask.size === 1 ? '' : 's'}, earliest deadline first, then by priority.`
        : 'No new sessions are needed or possible in this period.',
    ]
    if (request.mode === 'replan') {
      const count = (type: ScheduleItem['type']) => items.filter((item) => item.type === type).length
      explanation.push(`Replanning: ${count('move')} session(s) move, ${count('create')} are new, ${count('remove')} are removed. Past sessions, recurring events and meetings stay as they are.`)
    }
    if (result.assumedEstimates.length > 0) {
      explanation.push(`${result.assumedEstimates.length} task(s) have no time estimate, so 1 h was assumed for each. Add estimates for a more accurate plan.`)
    }
    if (added.length > 0) {
      explanation.push(`Also scheduled, because the chosen tasks depend on them: ${added.map((id) => `"${titles.get(id)}"`).join(', ')}.`)
    }
    if (edges.some((edge) => selectedIds.has(edge.taskId))) {
      explanation.push('Tasks with prerequisites start only after their prerequisites are finished.')
    }
    for (const missing of result.unscheduled) {
      const task = selected.find((t) => t.id === missing.taskId) as Task
      explanation.push(
        missing.reason === 'deadline_passed'
          ? `"${task.title}" is overdue (due ${task.dueDate}). Set a new deadline to schedule it.`
          : missing.reason === 'blocked_by_dependency'
            ? `"${task.title}" waits for "${titles.get(missing.blockedBy ?? '') ?? 'a prerequisite'}", which doesn't fit in this period, so it can't be scheduled yet.`
            : missing.reason === 'dependency_cycle'
              ? `"${task.title}" is part of a circular dependency. Remove one of the dependencies to schedule it.`
              : `Not enough free time for "${task.title}"${task.dueDate ? ` before its deadline (${task.dueDate})` : ' in this period'}: ${hours(missing.missingMinutes)} could not be placed. Options: move the deadline, extend your working hours, or reduce other work.`,
      )
    }

    const basis: ProposalBasis = {
      tasks: Object.fromEntries(selected.map((task) => [task.id, task.updatedAt])),
      events: Object.fromEntries((await this.calendar.getMany([...replaceableIds])).map((event) => [event.id, event.updatedAt])),
    }
    const payload: SchedulePayload = {
      kind: 'schedule',
      mode: request.mode,
      timeZone: tz,
      from,
      to,
      items,
      unscheduled: result.unscheduled.map((u) => ({ ...u, title: titles.get(u.taskId) ?? 'Task' })),
      explanation,
      basis,
    }
    return this.proposals.create(payload, 'engine')
  }

  // ---------- Proposals from operations ----------

  /** Creates a 'changes' proposal, describing each operation from the user's real data. */
  async proposeChanges(operations: readonly Operation[], source: ProposalSource): Promise<Proposal | null> {
    const prefs = await this.prefs()
    const tasks = new Map((await this.tasks.listTasks()).map((task) => [task.id, task]))
    const events = new Map(
      (await this.calendar.getMany(operations.flatMap((op) => (op.op === 'move_event' ? [op.eventId] : [])))).map((e) => [e.id, e]),
    )
    const kept: Operation[] = []
    const labels: string[] = []
    const basis: ProposalBasis = { tasks: {}, events: {} }
    for (const op of operations) {
      if (op.op === 'update_task' || op.op === 'add_subtasks') {
        const task = tasks.get(op.taskId)
        if (!task) continue
        basis.tasks[task.id] = task.updatedAt
        if (op.op === 'update_task') {
          const changes = Object.entries(op.changes).map(([field, value]) => `${field === 'estimatedMinutes' ? 'estimate' : field === 'dueDate' ? 'due date' : field} → ${value ?? 'none'}`)
          labels.push(`Update "${task.title}": ${changes.join(', ')}`)
        } else {
          labels.push(`Add ${op.titles.length} subtask(s) to "${task.title}": ${op.titles.join('; ')}`)
        }
      } else if (op.op === 'create_event') {
        if (!createEventInputSchema.safeParse({ ...op, timeZone: prefs.timeZone }).success) continue
        if (op.taskId !== null) {
          const task = tasks.get(op.taskId)
          if (!task) continue
          basis.tasks[task.id] = task.updatedAt
        }
        labels.push(`New ${EVENT_CATEGORY_LABELS[op.category].toLowerCase()} "${op.title}" on ${localLabel(op.startAt, prefs.timeZone)}–${clock(zonedParts(new Date(op.endAt), prefs.timeZone).minutes)}`)
      } else {
        const event = events.get(op.eventId)
        if (!event || event.recurrence !== null) continue
        if (!createEventInputSchema.safeParse({ title: event.title, startAt: op.startAt, endAt: op.endAt, timeZone: event.timeZone }).success) continue
        basis.events[event.id] = event.updatedAt
        labels.push(`Move "${event.title}" from ${localLabel(event.startAt, prefs.timeZone)} to ${localLabel(op.startAt, prefs.timeZone)}`)
      }
      kept.push(op)
    }
    if (kept.length === 0) return null
    const payload: ChangesPayload = { kind: 'changes', labels, operations: kept, basis }
    return this.proposals.create(payload, source)
  }

  // ---------- Deciding ----------

  async reject(id: string): Promise<Proposal> {
    return this.db.transaction(async (tx) => this.proposals.claim(tx, id, 'rejected'))
  }

  /**
   * Applies an approved proposal in one transaction: the claim, the stale checks and every
   * change succeed together or not at all. Everything is re-validated here; the stored
   * proposal is never trusted as authorization on its own.
   */
  async apply(id: string, input: unknown): Promise<Proposal> {
    const { plan, include } = applyProposalInputSchema.parse(input ?? {})
    // Read before the transaction: inside it, every query must use `tx`.
    const prefs = await this.prefs()
    return this.db.transaction(async (tx) => {
      const proposal = await this.proposals.claim(tx, id, 'applied')
      const tasks = new DbRepository(tx as unknown as Database, this.userId, { now: this.now, newId: this.newId })
      const calendar = this.calendar.within(tx)
      const payload = proposal.payload
      let result: unknown
      if (payload.kind === 'plan') {
        if (include !== undefined) throw new z.ZodError([{ code: 'custom', path: ['include'], message: 'Not supported for plans', input: include }])
        result = await this.applyPlan(tasks, this.dependencies.within(tx), plan ?? payload.plan)
      } else if (plan !== undefined) {
        throw new z.ZodError([{ code: 'custom', path: ['plan'], message: 'Only plan proposals take a plan', input: plan }])
      } else if (payload.kind === 'schedule') {
        result = await this.applySchedule(tasks, calendar, payload, pick(payload.items, include))
      } else {
        result = await this.applyChanges(tasks, calendar, prefs, payload, pick(payload.operations, include))
      }
      await this.proposals.setResult(tx, id, result)
      return { ...proposal, result }
    })
  }

  private async applyPlan(tasks: DbRepository, dependencies: DependencyStore, plan: ProjectPlan) {
    // Never merges into (or duplicates the name of) an existing project.
    const names = new Set((await tasks.listProjects()).map((project) => project.name.toLowerCase()))
    let name = plan.projectName
    for (let n = 2; names.has(name.toLowerCase()) || name.toLowerCase() === 'inbox'; n += 1) {
      const suffix = ` (${n})`
      name = `${plan.projectName.slice(0, LIMITS.projectName - suffix.length)}${suffix}`
    }
    const project = await tasks.createProject({ name })
    const titles = new Map(plan.phases.flatMap((phase) => phase.tasks.map((task) => [task.key, task.title] as const)))
    const idsByKey = new Map<string, string>()
    const taskIds: string[] = []
    for (const phase of plan.phases) {
      for (const planned of phase.tasks) {
        const task = await tasks.createTask({
          projectId: project.id,
          title: planned.title,
          description: planTaskDescription(planned, phase.name, titles),
          priority: planned.priority,
          dueDate: planned.dueDate,
          estimatedMinutes: planned.estimatedMinutes,
        })
        for (const title of planned.subtasks) await tasks.createSubtask(task.id, { title })
        idsByKey.set(planned.key, task.id)
        taskIds.push(task.id)
      }
    }
    // Dependencies only point to earlier tasks of the plan, so they can't form a cycle.
    const edges = plan.phases.flatMap((phase) =>
      phase.tasks.flatMap((planned) =>
        planned.dependsOn.flatMap((key) => {
          const taskId = idsByKey.get(planned.key)
          const dependsOnId = idsByKey.get(key)
          return taskId && dependsOnId ? [{ taskId, dependsOnId }] : []
        }),
      ),
    )
    await dependencies.addValidated(edges)
    return { projectId: project.id, taskIds }
  }

  private async applySchedule(tasks: DbRepository, calendar: CalendarStore, payload: SchedulePayload, items: readonly ScheduleItem[]) {
    const now = this.now()
    const current = new Map((await tasks.listTasks()).map((task) => [task.id, task]))
    const eventIds = items.flatMap((item) => (item.type === 'create' ? [] : [item.eventId]))
    const events = new Map((await calendar.getMany(eventIds)).map((event) => [event.id, event]))

    for (const item of items) {
      const task = current.get(item.taskId)
      if (!task || task.status === 'done' || task.updatedAt !== payload.basis.tasks[item.taskId]) throw stale()
      if (item.type !== 'create' && events.get(item.eventId)?.updatedAt !== payload.basis.events[item.eventId]) throw stale()
      if (item.type !== 'remove' && new Date(item.startAt) < now) throw stale()
    }

    // Nothing new may have appeared in the proposed time slots since the preview.
    const placed = items.filter((item) => item.type !== 'remove')
    if (placed.length > 0) {
      const from = new Date(Math.min(...placed.map((item) => new Date(item.startAt).getTime())))
      const to = new Date(Math.max(...placed.map((item) => new Date(item.endAt).getTime())))
      const moving = new Set(eventIds)
      const existing = (await calendar.occurrences(from, to)).filter((o) => !moving.has(o.eventId) && o.category !== 'break')
      for (const item of placed) {
        if (existing.some((o) => o.start < item.endAt && o.end > item.startAt)) {
          throw new DomainError('SCHEDULE_CONFLICT', `"${item.title}" now overlaps another event. Create a new schedule preview.`)
        }
      }
    }

    const result = { created: [] as string[], moved: [] as string[], removed: [] as string[] }
    for (const item of items) {
      if (item.type === 'create') {
        const event = await calendar.create({
          title: item.title,
          category: 'work_session',
          startAt: item.startAt,
          endAt: item.endAt,
          timeZone: payload.timeZone,
          taskId: item.taskId,
        })
        result.created.push(event.id)
      } else if (item.type === 'move') {
        await calendar.reschedule(events.get(item.eventId)!, item.startAt, item.endAt)
        result.moved.push(item.eventId)
      } else {
        await calendar.remove(events.get(item.eventId)!)
        result.removed.push(item.eventId)
      }
    }
    return result
  }

  private async applyChanges(tasks: DbRepository, calendar: CalendarStore, prefs: Preferences, payload: ChangesPayload, operations: readonly Operation[]) {
    const current = new Map((await tasks.listTasks()).map((task) => [task.id, task]))
    const events = new Map(
      (await calendar.getMany(operations.flatMap((op) => (op.op === 'move_event' ? [op.eventId] : [])))).map((e) => [e.id, e]),
    )
    // Check everything first: an earlier operation would change updatedAt for a later one.
    for (const op of operations) {
      const taskId = op.op === 'move_event' ? null : op.taskId
      if (taskId !== null) {
        const task = current.get(taskId)
        if (!task) throw new DomainError('NOT_FOUND', 'Task not found')
        if (task.updatedAt !== payload.basis.tasks[taskId]) throw stale()
      }
      if (op.op === 'move_event') {
        const event = events.get(op.eventId)
        if (!event) throw new DomainError('NOT_FOUND', 'Event not found')
        if (event.recurrence !== null || event.updatedAt !== payload.basis.events[op.eventId]) throw stale()
      }
    }
    let applied = 0
    for (const op of operations) {
      if (op.op === 'update_task') await tasks.updateTask(op.taskId, op.changes)
      else if (op.op === 'add_subtasks') {
        for (const title of op.titles) await tasks.createSubtask(op.taskId, { title })
      } else if (op.op === 'create_event') {
        await calendar.create({ title: op.title, category: op.category, startAt: op.startAt, endAt: op.endAt, timeZone: prefs.timeZone, taskId: op.taskId })
      } else {
        await calendar.reschedule(events.get(op.eventId)!, op.startAt, op.endAt)
      }
      applied += 1
    }
    return { applied }
  }
}

/** The next quarter hour that is at least LEAD_MINUTES after `now`. */
const LEAD_MINUTES = 10
export function earliestSessionStart(now: Date): Date {
  const quarter = 15 * 60_000
  return new Date(Math.ceil((now.getTime() + LEAD_MINUTES * 60_000) / quarter) * quarter)
}

function groupBy<T>(list: readonly T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const item of list) groups.set(key(item), [...(groups.get(key(item)) ?? []), item])
  return groups
}

function stale(): DomainError {
  return new DomainError('PROPOSAL_STALE', 'Your tasks or calendar changed after this preview was made. Create a new one.')
}

function pick<T>(list: readonly T[], include: readonly number[] | undefined): T[] {
  if (include === undefined) return [...list]
  const indexes = [...new Set(include)]
  if (indexes.some((index) => index >= list.length)) {
    throw new z.ZodError([{ code: 'custom', path: ['include'], message: 'Unknown item', input: include }])
  }
  if (indexes.length === 0) throw new z.ZodError([{ code: 'custom', path: ['include'], message: 'Choose at least one item', input: include }])
  return indexes.sort((a, b) => a - b).map((index) => list[index])
}
