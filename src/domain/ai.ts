import { z } from 'zod'
import { EVENT_CATEGORIES, type Occurrence } from './calendar'
import type { TaskDependency } from './dependencies'
import { LIMITS } from './constants'
import type { IsoDate } from './dates'
import type { Preferences } from './scheduling'
import { estimatedMinutesSchema, idSchema, isoDateSchema, taskPrioritySchema, taskStatusSchema, timestampSchema, type Project, type Task } from './schemas'
import { zonedParts } from './zonedTime'

/*
  AI contracts (M9). The model never touches data directly:
  1. Everything it returns is parsed with these schemas; anything else is rejected.
  2. It can only *propose* operations from a short allowlist (no SQL, no code, no deletes).
  3. A proposal is stored, shown to the user, and applied only after approval — by the server,
     which re-checks ownership and staleness of every referenced task and event.
  Text the model produces is untrusted: the UI renders it as plain text, never as HTML.
*/

export const AI_LIMITS = {
  /** Characters of one user message. */
  message: 2000,
  /** Characters of an assistant reply. */
  reply: 4000,
  /** How much of the user's data goes into one request. */
  contextProjects: 20,
  contextTasks: 40,
  contextEvents: 40,
  /** Messages of earlier conversation sent along. */
  historyMessages: 10,
  operations: 10,
  planPhases: 8,
  planTasks: 40,
  subtasksPerTask: 10,
} as const

const text = (max: number) => z.string().trim().min(1).max(max)

// ---------- Project & goal builder ----------

export const planTaskSchema = z.strictObject({
  /** Short local reference ("t1"), used only for dependencies within the plan. */
  key: z.string().trim().min(1).max(20),
  title: text(LIMITS.taskTitle),
  description: z.string().trim().max(1000),
  priority: taskPrioritySchema,
  estimatedMinutes: estimatedMinutesSchema.nullable(),
  dueDate: isoDateSchema.nullable(),
  /** Keys of tasks (earlier in the plan) that must be finished first. */
  dependsOn: z.array(z.string().max(20)).max(10),
  subtasks: z.array(text(LIMITS.subtaskTitle)).max(AI_LIMITS.subtasksPerTask),
})

export const planPhaseSchema = z.strictObject({
  name: text(80),
  tasks: z.array(planTaskSchema).min(1).max(20),
})

export const projectPlanSchema = z
  .strictObject({
    projectName: text(LIMITS.projectName),
    summary: z.string().trim().max(600),
    /** Questions that would improve the plan; the user may answer and regenerate. */
    clarifyingQuestions: z.array(text(300)).max(5),
    phases: z.array(planPhaseSchema).min(1).max(AI_LIMITS.planPhases),
  })
  .superRefine((plan, ctx) => {
    const tasks = plan.phases.flatMap((phase) => phase.tasks)
    if (tasks.length > AI_LIMITS.planTasks) {
      ctx.addIssue({ code: 'custom', message: `A plan may have at most ${AI_LIMITS.planTasks} tasks`, path: ['phases'] })
    }
    const seen = new Set<string>()
    for (const task of tasks) {
      if (seen.has(task.key)) ctx.addIssue({ code: 'custom', message: `Duplicate task key "${task.key}"`, path: ['phases'] })
      // Only earlier tasks may be dependencies, which also rules out cycles.
      for (const dependency of task.dependsOn) {
        if (!seen.has(dependency)) {
          ctx.addIssue({ code: 'custom', message: `"${task.title}" depends on an unknown or later task`, path: ['phases'] })
        }
      }
      seen.add(task.key)
    }
  })
export type ProjectPlan = z.output<typeof projectPlanSchema>
export type PlanTask = z.output<typeof planTaskSchema>

/** What the user tells the plan builder. */
export const planRequestSchema = z.strictObject({
  goal: text(AI_LIMITS.message),
  /** Optional answers to earlier clarifying questions, or extra constraints. */
  details: z.string().trim().max(AI_LIMITS.message).default(''),
  deadline: isoDateSchema.nullable().default(null),
  hoursPerWeek: z.int().min(1).max(80).nullable().default(null),
})
export type PlanRequest = z.output<typeof planRequestSchema>

/** The description a saved task gets, so phases and dependencies stay visible without new tables. */
export function planTaskDescription(task: PlanTask, phase: string, titlesByKey: ReadonlyMap<string, string>): string {
  const lines = [task.description, '', `Phase: ${phase}`]
  if (task.dependsOn.length > 0) {
    lines.push(`After: ${task.dependsOn.map((key) => titlesByKey.get(key) ?? key).join('; ')}`)
  }
  return lines.join('\n').trim().slice(0, LIMITS.taskDescription)
}

// ---------- Allowlisted operations ----------

export const taskChangesSchema = z
  .strictObject({
    title: text(LIMITS.taskTitle),
    status: taskStatusSchema,
    priority: taskPrioritySchema,
    dueDate: isoDateSchema.nullable(),
    estimatedMinutes: estimatedMinutesSchema.nullable(),
  })
  .partial()
  .refine((changes) => Object.values(changes).some((value) => value !== undefined), 'An update must change something')

export const operationSchema = z.discriminatedUnion('op', [
  z.strictObject({ op: z.literal('update_task'), taskId: idSchema, changes: taskChangesSchema }),
  z.strictObject({ op: z.literal('add_subtasks'), taskId: idSchema, titles: z.array(text(LIMITS.subtaskTitle)).min(1).max(AI_LIMITS.subtasksPerTask) }),
  z.strictObject({
    op: z.literal('create_event'),
    title: text(200),
    category: z.enum(EVENT_CATEGORIES),
    startAt: timestampSchema,
    endAt: timestampSchema,
    taskId: idSchema.nullable(),
  }),
  /** Moves a single (non-recurring) event. */
  z.strictObject({ op: z.literal('move_event'), eventId: idSchema, startAt: timestampSchema, endAt: timestampSchema }),
])
export type Operation = z.output<typeof operationSchema>
export const OPERATION_NAMES = ['update_task', 'add_subtasks', 'create_event', 'move_event'] as const

// ---------- Assistant turns ----------

export const ASSISTANT_INTENTS = ['answer', 'clarify', 'propose_changes', 'propose_schedule', 'propose_plan'] as const

/** The structured output of one assistant turn. */
export const assistantTurnSchema = z.strictObject({
  intent: z.enum(ASSISTANT_INTENTS),
  reply: text(AI_LIMITS.reply),
  /** Only for propose_changes. */
  operations: z.array(operationSchema).max(AI_LIMITS.operations),
  /** Only for propose_plan: the goal to hand to the plan builder. */
  planGoal: z.string().trim().max(AI_LIMITS.message).nullable(),
})
export type AssistantTurn = z.output<typeof assistantTurnSchema>

export const chatRequestSchema = z.strictObject({
  conversationId: idSchema.nullable().default(null),
  message: text(AI_LIMITS.message),
})

// ---------- Help on one task ----------

export const TASK_ASSIST_KINDS = ['explain', 'breakdown', 'checklist', 'outline', 'next_step'] as const
export type TaskAssistKind = (typeof TASK_ASSIST_KINDS)[number]
export const TASK_ASSIST_LABELS: Record<TaskAssistKind, string> = {
  explain: 'Explain this task',
  breakdown: 'Break it into steps',
  checklist: 'Suggest a checklist',
  outline: 'Draft an outline',
  next_step: 'What should I do next?',
}

export const taskAssistRequestSchema = z.strictObject({ kind: z.enum(TASK_ASSIST_KINDS) })

export const taskAssistResultSchema = z.strictObject({
  content: text(AI_LIMITS.reply),
  /** Suggested subtasks; added only if the user approves. */
  checklist: z.array(text(LIMITS.subtaskTitle)).max(AI_LIMITS.subtasksPerTask),
})
export type TaskAssistResult = z.output<typeof taskAssistResultSchema>

// ---------- Context sent to the model ----------

/*
  The model sees a bounded, minimal summary of the user's data: titles, statuses, dates and
  estimates. No email, no names, no ids of other users, no descriptions beyond a short excerpt.
  User data goes inside a fenced block and the system prompt says it's data, not instructions;
  fence markers inside user text are neutralized so a task title can't close the block.
*/

export const DATA_FENCE_START = '<<<USER_DATA'
export const DATA_FENCE_END = 'USER_DATA>>>'

/** Shortens text, flattens newlines and breaks any fence markers. */
export function sanitizeForContext(value: string, max: number): string {
  const flat = value.replace(/\s+/g, ' ').replaceAll('<<<', '‹‹‹').replaceAll('>>>', '›››').trim()
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const

function localTime(instant: string, timeZone: string): string {
  const parts = zonedParts(new Date(instant), timeZone)
  return `${parts.date} ${String(Math.floor(parts.minutes / 60)).padStart(2, '0')}:${String(parts.minutes % 60).padStart(2, '0')}`
}

export interface AssistantContextInput {
  projects: readonly Project[]
  tasks: readonly Task[]
  upcoming: readonly Occurrence[]
  prefs: Preferences
  now: Date
  /** Task dependencies, so advice respects "B only after A". */
  dependencies?: readonly TaskDependency[]
}

export interface AssistantContext {
  text: string
  /** Ids the model was shown; operations may only reference these. */
  taskIds: Set<string>
  eventIds: Set<string>
  today: IsoDate
}

/** Builds the bounded data block for a request (most relevant items first). */
export function buildAssistantContext({ projects, tasks, upcoming, prefs, now, dependencies }: AssistantContextInput): AssistantContext {
  // Titles of the open tasks each task waits for (done prerequisites no longer block anything).
  const titleOf = new Map(tasks.map((task) => [task.id, task]))
  const openPrerequisiteTitles = (taskId: string) =>
    (dependencies ?? [])
      .filter((edge) => edge.taskId === taskId)
      .map((edge) => titleOf.get(edge.dependsOnId))
      .filter((prerequisite) => prerequisite !== undefined && prerequisite.status !== 'done')
      .map((prerequisite) => sanitizeForContext((prerequisite as Task).title, 120))
  const today = zonedParts(now, prefs.timeZone).date
  const projectNames = new Map(projects.map((project) => [project.id, sanitizeForContext(project.name, 60)]))
  const open = tasks
    .filter((task) => task.status !== 'done')
    .sort(
      (a, b) =>
        (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') ||
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
        a.createdAt.localeCompare(b.createdAt),
    )
    .slice(0, AI_LIMITS.contextTasks)
  const doneCount = tasks.filter((task) => task.status === 'done').length
  const events = upcoming.slice(0, AI_LIMITS.contextEvents)

  const lines = [
    DATA_FENCE_START,
    `today: ${today} (time zone ${prefs.timeZone}); now: ${localTime(now.toISOString(), prefs.timeZone)}`,
    `working hours: days ${prefs.workDays.join(',')} (0=Sun), ${Math.floor(prefs.dayStartMinutes / 60)}:00-${Math.floor(prefs.dayEndMinutes / 60)}:00, max ${prefs.maxDailyMinutes} min/day`,
    `projects (${projects.length}): ${projects.slice(0, AI_LIMITS.contextProjects).map((project) => projectNames.get(project.id)).join(' | ')}`,
    `tasks: ${tasks.length} total, ${doneCount} done, ${tasks.length - doneCount} open (showing ${open.length})`,
    ...open.map((task) =>
      [
        `- task ${task.id}`,
        `"${sanitizeForContext(task.title, 120)}"`,
        `project="${projectNames.get(task.projectId) ?? '?'}"`,
        `status=${task.status}`,
        `priority=${task.priority}`,
        `due=${task.dueDate ?? 'none'}`,
        `estimate=${task.estimatedMinutes === null ? 'unknown' : `${task.estimatedMinutes}min`}`,
        ...openPrerequisiteTitles(task.id).map((title) => `after="${title}"`),
      ].join(' '),
    ),
    `upcoming calendar (next ${events.length}):`,
    ...events.map(
      (occurrence) =>
        `- event ${occurrence.eventId}${occurrence.isRecurring ? ' (recurring)' : ''} "${sanitizeForContext(occurrence.title, 80)}" ${occurrence.category} ${localTime(occurrence.start, prefs.timeZone)} to ${localTime(occurrence.end, prefs.timeZone)}${occurrence.taskId ? ` task=${occurrence.taskId}` : ''}`,
    ),
    DATA_FENCE_END,
  ]
  return {
    text: lines.join('\n'),
    taskIds: new Set(open.map((task) => task.id)),
    eventIds: new Set(events.filter((occurrence) => !occurrence.isRecurring).map((occurrence) => occurrence.eventId)),
    today,
  }
}

/**
 * Drops operations that reference anything the model wasn't shown (a hallucinated or injected
 * id). The server re-checks ownership again when the proposal is applied.
 */
export function filterOperations(operations: readonly Operation[], context: Pick<AssistantContext, 'taskIds' | 'eventIds'>): { kept: Operation[]; dropped: number } {
  const kept = operations.filter((operation) => {
    if (operation.op === 'update_task' || operation.op === 'add_subtasks') return context.taskIds.has(operation.taskId)
    if (operation.op === 'move_event') return context.eventIds.has(operation.eventId)
    return operation.taskId === null || context.taskIds.has(operation.taskId)
  })
  return { kept, dropped: operations.length - kept.length }
}
