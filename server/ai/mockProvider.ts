import {
  addDays,
  assistantTurnSchema,
  daysBetween,
  getDeadlineStatus,
  projectPlanSchema,
  taskAssistResultSchema,
  zonedParts,
  type AssistantTurn,
  type Operation,
  type PlanTask,
  type ProjectPlan,
  type Task,
  type TaskAssistResult,
  type UseCase,
} from '../../src/domain'
import type { AiProvider, AssistantRequest, PlanProviderRequest, ProviderResult, TaskAssistRequest } from './provider'

/*
  The demo AI provider: free, offline and deterministic. It is NOT a language model. It
  answers with simple rules over the user's real data (so answers about tasks are accurate),
  and builds plans from templates. The app labels its output "Demo AI" everywhere.

  It exists so every AI feature — proposals, approvals, validation, limits — works and is
  tested end to end without paid API calls. Its output goes through the same Zod validation
  as a real provider's.
*/

const NO_USAGE = { inputTokens: 0, outputTokens: 0 }

function result<T>(output: T): ProviderResult<T> {
  return { output, usage: NO_USAGE }
}

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const
const list = (tasks: readonly Task[]) => tasks.map((task) => `• ${task.title}${task.dueDate ? ` (due ${task.dueDate})` : ''}`).join('\n')

/** Finds the open task whose title appears in the message (longest match wins). */
function mentionedTask(message: string, tasks: readonly Task[]): Task | undefined {
  const lower = message.toLowerCase()
  return tasks
    .filter((task) => task.status !== 'done' && task.title.length >= 3 && lower.includes(task.title.toLowerCase()))
    .sort((a, b) => b.title.length - a.title.length)[0]
}

function turn(intent: AssistantTurn['intent'], reply: string, operations: Operation[] = [], planGoal: string | null = null): AssistantTurn {
  return assistantTurnSchema.parse({ intent, reply, operations, planGoal })
}

export function mockAssistantTurn({ message, data }: AssistantRequest): AssistantTurn {
  const lower = message.toLowerCase()
  const today = zonedParts(data.now, data.prefs.timeZone).date
  const open = data.tasks.filter((task) => task.status !== 'done')
  const visible = new Set(open.slice(0, 40).map((task) => task.id))
  const target = mentionedTask(message, open.filter((task) => visible.has(task.id)))

  // Requests to change something become proposals; nothing is changed without approval.
  if (target && /\b(high|medium|low)\s+priority|priority\s+(to\s+)?(high|medium|low)/.test(lower)) {
    const priority = (/\b(high|medium|low)\b/.exec(lower)?.[1] ?? 'high') as Task['priority']
    return turn('propose_changes', `I can set the priority of "${target.title}" to ${priority}. Review the change below and approve it if it's right.`, [
      { op: 'update_task', taskId: target.id, changes: { priority } },
    ])
  }
  if (target && /\b(mark|set)\b.*\b(done|complete|finished)\b|\bi (finished|completed)\b/.test(lower)) {
    return turn('propose_changes', `Marking "${target.title}" as done — please confirm below.`, [
      { op: 'update_task', taskId: target.id, changes: { status: 'done' } },
    ])
  }
  if (target && /\b(postpone|push|delay|move)\b.*\b(tomorrow|next week|(\d+)\s+days?)\b/.test(lower)) {
    const days = lower.includes('tomorrow') ? 1 : lower.includes('next week') ? 7 : Number(/(\d+)\s+days?/.exec(lower)?.[1] ?? 1)
    const base = target.dueDate && target.dueDate > today ? target.dueDate : today
    const dueDate = addDays(base, Math.min(days, 365))
    return turn('propose_changes', `I can move the deadline of "${target.title}" to ${dueDate}. If you also want the calendar updated, ask me to replan your schedule afterwards.`, [
      { op: 'update_task', taskId: target.id, changes: { dueDate } },
    ])
  }

  if (/\b(schedule|plan my (day|week)|organi[sz]e my|time.?block|replan|reschedule|fit .* in)\b/.test(lower)) {
    return turn('propose_schedule', 'I asked the scheduler to place your open tasks into your free working time. Review the proposed sessions below; nothing is added to your calendar until you approve.')
  }
  if (/\b(create|build|make|start|set up)\b.*\b(project|plan|roadmap)\b|\bi want to\b|\bmy goal\b|\bhelp me (learn|prepare|build|launch|write)\b/.test(lower)) {
    return turn('propose_plan', 'That sounds like a goal worth turning into a project. Open the plan builder to generate phases, tasks and estimates you can edit before saving.', [], message.slice(0, 2000))
  }

  if (/\boverdue|late|missed\b/.test(lower)) {
    const overdue = open.filter((task) => getDeadlineStatus(task, today) === 'overdue')
    return turn('answer', overdue.length === 0 ? 'Good news: nothing is overdue.' : `${overdue.length} task(s) are overdue:\n${list(overdue)}\nYou could finish them, move their deadlines, or ask me to replan your schedule.`)
  }
  if (/\b(today|this week|due|deadline)/.test(lower)) {
    const horizon = lower.includes('today') ? today : addDays(today, 6)
    const due = open.filter((task) => task.dueDate !== null && task.dueDate >= today && task.dueDate <= horizon).sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
    const label = lower.includes('today') ? 'today' : 'in the next 7 days'
    return turn('answer', due.length === 0 ? `Nothing is due ${label}.` : `Due ${label}:\n${list(due)}`)
  }
  if (/\b(calendar|meeting|event|busy|free time|sessions?)\b/.test(lower)) {
    const upcoming = data.upcoming.slice(0, 8)
    return turn('answer', upcoming.length === 0 ? 'Your calendar has nothing planned for the next days.' : `Coming up:\n${upcoming.map((o) => { const p = zonedParts(new Date(o.start), data.prefs.timeZone); return `• ${p.date} ${String(Math.floor(p.minutes / 60)).padStart(2, '0')}:${String(p.minutes % 60).padStart(2, '0')} ${o.title}` }).join('\n')}`)
  }
  if (/\b(what should i|next|focus|priorit|important|start with)\b/.test(lower)) {
    const ranked = [...open].sort((a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]).slice(0, 3)
    return turn('answer', ranked.length === 0 ? 'You have no open tasks. A good moment to plan your next goal!' : `Based on deadlines and priorities, I'd start with:\n${list(ranked)}`)
  }
  if (/\b(progress|how am i doing|summary|status|overview)\b/.test(lower)) {
    const done = data.tasks.length - open.length
    return turn('answer', `You have ${data.tasks.length} task(s): ${done} done and ${open.length} open, across ${data.projects.length} project(s). See Insights for workload and suggestions.`)
  }
  if (lower.trim().length < 4) {
    return turn('clarify', 'Could you tell me a bit more about what you need?')
  }
  return turn(
    'answer',
    'I am the offline demo assistant, so I understand a limited set of requests. Try: "What is due this week?", "What should I focus on?", "Schedule my week", "Set <task> to high priority", or "Help me learn Spanish" to build a project plan.',
  )
}

// ---------- Plans ----------

const TEMPLATES: Record<UseCase, { phase: string; tasks: [string, number][] }[]> = {
  student: [
    { phase: 'Understand', tasks: [['Collect the requirements and materials for', 60], ['Make a study outline for', 45]] },
    { phase: 'Learn and practise', tasks: [['Work through the core topics of', 180], ['Practise with exercises for', 120]] },
    { phase: 'Review', tasks: [['Review weak areas of', 90], ['Do a final check of', 45]] },
  ],
  developer: [
    { phase: 'Design', tasks: [['Write down the requirements for', 60], ['Sketch the architecture of', 90]] },
    { phase: 'Build', tasks: [['Implement the first working version of', 240], ['Add tests for', 120]] },
    { phase: 'Ship', tasks: [['Review and refactor', 90], ['Document and release', 60]] },
  ],
  professional: [
    { phase: 'Scope', tasks: [['Define the goals and stakeholders of', 60], ['Draft a timeline for', 45]] },
    { phase: 'Execute', tasks: [['Do the main work for', 240], ['Share a progress update on', 30]] },
    { phase: 'Close', tasks: [['Review results of', 60], ['Present the outcome of', 60]] },
  ],
  freelancer: [
    { phase: 'Agree', tasks: [['Confirm scope and price for', 45], ['Plan milestones for', 45]] },
    { phase: 'Deliver', tasks: [['Produce the first draft of', 240], ['Incorporate feedback on', 120]] },
    { phase: 'Wrap up', tasks: [['Deliver the final version of', 45], ['Send the invoice for', 15]] },
  ],
  personal: [
    { phase: 'Prepare', tasks: [['Research what you need for', 45], ['Gather everything required for', 60]] },
    { phase: 'Do', tasks: [['Work on', 120], ['Make steady progress on', 120]] },
    { phase: 'Reflect', tasks: [['Review how it went with', 30]] },
  ],
  general: [
    { phase: 'Plan', tasks: [['Clarify what success means for', 30], ['Break down the work for', 45]] },
    { phase: 'Do', tasks: [['Work on the main part of', 180], ['Finish the remaining parts of', 120]] },
    { phase: 'Review', tasks: [['Review and wrap up', 45]] },
  ],
}

export function mockProjectPlan({ request, today, useCase }: PlanProviderRequest): ProjectPlan {
  const goal = request.goal.replace(/\s+/g, ' ').trim()
  const short = goal.length > 60 ? `${goal.slice(0, 57)}…` : goal
  const projectName = (goal.length > 70 ? `${goal.slice(0, 69)}…` : goal).replace(/^./, (c) => c.toUpperCase())
  const phases = TEMPLATES[useCase]
  const total = phases.reduce((sum, phase) => sum + phase.tasks.length, 0)
  // Spread deadlines evenly up to the user's deadline, if there is one.
  const span = request.deadline && request.deadline > today ? daysBetween(today, request.deadline) : null
  let index = 0
  let previous: string | null = null
  const planned = phases.map((phase) => ({
    name: phase.phase,
    tasks: phase.tasks.map(([verb, minutes]): PlanTask => {
      index += 1
      const key = `t${index}`
      const task: PlanTask = {
        key,
        title: `${verb} ${short}`.slice(0, 200),
        description: '',
        priority: index <= 2 ? 'high' : index === total ? 'low' : 'medium',
        estimatedMinutes: minutes,
        dueDate: span === null ? null : addDays(today, Math.max(1, Math.round((span * index) / total))),
        dependsOn: previous ? [previous] : [],
        subtasks: index === 1 ? ['List what is needed', 'Decide the first step'] : [],
      }
      previous = key
      return task
    }),
  }))
  const questions = [
    ...(request.deadline ? [] : ['Is there a deadline? Deadlines let me schedule the work realistically.']),
    ...(request.hoursPerWeek ? [] : ['How many hours per week can you spend on this?']),
  ]
  return projectPlanSchema.parse({
    projectName,
    summary: `A ${phases.length}-phase template plan (demo): adjust titles, estimates and deadlines before saving.`,
    clarifyingQuestions: questions,
    phases: planned,
  })
}

// ---------- Help on a task ----------

export function mockTaskAssist({ kind, task }: TaskAssistRequest): TaskAssistResult {
  const steps = [`Decide what "done" means for "${task.title}"`, 'Collect what you need', 'Do the first focused work session', 'Review the result']
  const estimate = task.estimatedMinutes ? `about ${task.estimatedMinutes} minutes` : 'no estimate yet'
  const content: Record<TaskAssistRequest['kind'], string> = {
    explain: `"${task.title}" is a ${task.priority}-priority task in ${task.projectName}${task.dueDate ? `, due ${task.dueDate}` : ''} (${estimate}). ${task.description ? `Your notes say: ${task.description.slice(0, 300)}` : 'It has no description yet; adding one will make help more specific.'}`,
    breakdown: `A simple way to approach "${task.title}":\n${steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}`,
    checklist: `Here is a starter checklist for "${task.title}". You can add it as subtasks after reviewing it.`,
    outline: `Outline for "${task.title}":\n1. Goal and context\n2. Main points\n3. Details and evidence\n4. Conclusion and next steps`,
    next_step: task.subtasks.length > 0 ? `Your next step: "${task.subtasks[0]}". Book a focused session for it.` : `Your next step: ${steps[0].toLowerCase()}. Then schedule a session for it.`,
  }
  const checklist = kind === 'checklist' || kind === 'breakdown' ? steps.filter((step) => !task.subtasks.includes(step)) : []
  return taskAssistResultSchema.parse({ content: content[kind], checklist })
}

export class MockAiProvider implements AiProvider {
  readonly name = 'mock' as const
  readonly model = null

  async assistantTurn(request: AssistantRequest) {
    return result(mockAssistantTurn(request))
  }

  async projectPlan(request: PlanProviderRequest) {
    return result(mockProjectPlan(request))
  }

  async taskAssist(request: TaskAssistRequest) {
    return result(mockTaskAssist(request))
  }
}
