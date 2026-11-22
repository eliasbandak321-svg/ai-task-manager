import type { TaskRepository } from '../data/repository'
import type {
  AiStatus,
  CalendarRange,
  ChatMessage,
  ChatResponse,
  Conversation,
  CreateEventRequest,
  EventChange,
  PreferencesResponse,
  ScheduleRequest,
  WorkspaceClient,
} from '../data/workspaceClient'
import {
  CALENDAR_RANGE_MAX_DAYS,
  computeInsights,
  computeTaskEffort,
  planDependencies,
  createEventInputSchema,
  defaultPreferences,
  DomainError,
  expandEvents,
  scheduleTasks,
  zonedRange,
  type ApplyProposalInput,
  type CalendarEvent,
  type PlanRequest,
  type Preferences,
  type Proposal,
  type ProposalPayload,
  type TaskAssistKind,
  type TaskDependency,
} from '../domain'

/*
  A WorkspaceClient that runs entirely in the browser, built on the real domain logic
  (recurrence, scheduling, insights, dependencies) and any TaskRepository. Two users:
  - UI tests (as createFakeWorkspaceClient), in memory;
  - the portfolio demo (M11, VITE_DEMO=1), which passes saved `initial` state and an
    `onChange` callback that stores it in sessionStorage (src/demo/demoClients.ts).
  It never makes network requests. Its AI is SIMULATED: canned, rule-based answers labelled
  'mock' ("Demo AI"), never a language model. Real API behaviour is covered by the server
  tests and the full-stack end-to-end tests.
*/

/** The owner id on events created here (browser-only: there is one local user). */
export const LOCAL_USER_ID = '00000000-0000-4000-8000-00000000d3e0'

let counter = 0
const randomPart = () => Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0')
// A per-page-load prefix keeps ids unique across reloads of a saved demo.
const idPrefix = `00000000-${randomPart()}-4000-9000`
const nextId = () => `${idPrefix}-${(++counter).toString(16).padStart(12, '0')}`

/** Everything the in-memory workspace keeps; what the demo saves between page loads. */
export interface WorkspaceState {
  preferences: Preferences
  saved: boolean
  events: CalendarEvent[]
  proposals: Proposal[]
  conversations: (Conversation & { messages: ChatMessage[] })[]
  dependencies: TaskDependency[]
}

export interface InMemoryWorkspaceOptions {
  now?: () => Date
  timeZone?: string
  /** Saved state to start from (the demo); otherwise empty with default preferences. */
  initial?: WorkspaceState
  /** Called with the full state after every change (the demo saves it). */
  onChange?: (state: WorkspaceState) => void
}

export function createInMemoryWorkspaceClient(
  repository: TaskRepository,
  { now = () => new Date(), timeZone = 'UTC', initial, onChange }: InMemoryWorkspaceOptions = {},
) {
  let preferences: Preferences = initial?.preferences ?? defaultPreferences(timeZone)
  let saved = initial?.saved ?? false
  const events: CalendarEvent[] = [...(initial?.events ?? [])]
  const proposals: Proposal[] = [...(initial?.proposals ?? [])]
  const conversations: (Conversation & { messages: ChatMessage[] })[] = [...(initial?.conversations ?? [])]
  const calls: { method: string; args: unknown[] }[] = []
  const calendarRequests: { from: string; to: string }[] = []
  let dependencies: TaskDependency[] = [...(initial?.dependencies ?? [])]
  const snapshot = (): WorkspaceState => ({ preferences, saved, events, proposals, conversations, dependencies })

  const record = (method: string, ...args: unknown[]) => calls.push({ method, args })

  function propose(payload: ProposalPayload, source: Proposal['source']): Proposal {
    const created = now()
    const proposal: Proposal = {
      id: nextId(),
      kind: payload.kind,
      status: 'pending',
      source,
      payload,
      result: null,
      createdAt: created.toISOString(),
      expiresAt: new Date(created.getTime() + 86_400_000).toISOString(),
      decidedAt: null,
    }
    proposals.push(proposal)
    return proposal
  }

  const client: WorkspaceClient & { calls: typeof calls; events: typeof events; calendarRequests: typeof calendarRequests; failCalendar: boolean } = {
    calls,
    events,
    calendarRequests,
    /** Tests set this to make calendar requests fail (like a network or server error). */
    failCalendar: false,

    async getPreferences(): Promise<PreferencesResponse> {
      return { preferences, saved, updatedAt: saved ? now().toISOString() : null }
    },

    async savePreferences(next) {
      record('savePreferences', next)
      preferences = next
      saved = true
      return { preferences, saved, updatedAt: now().toISOString() }
    },

    async listCalendar(from, to): Promise<CalendarRange> {
      calendarRequests.push({ from, to })
      if (client.failCalendar) throw new Error('The calendar service is unavailable.')
      // Same limit as the real API (server/workspace/calendarStore.ts), so tests catch requests it would refuse.
      if (new Date(to).getTime() - new Date(from).getTime() > CALENDAR_RANGE_MAX_DAYS * 86_400_000) throw new Error(`The range may be at most ${CALENDAR_RANGE_MAX_DAYS} days`)
      return { events: [...events], occurrences: expandEvents(events, new Date(from), new Date(to)) }
    },

    async createEvent(input: CreateEventRequest) {
      record('createEvent', input)
      const parsed = createEventInputSchema.parse(input)
      const stamp = now().toISOString()
      const event: CalendarEvent = { id: nextId(), userId: LOCAL_USER_ID, ...parsed, excludedStarts: [], seriesId: null, originalStart: null, sessionStatus: 'planned', createdAt: stamp, updatedAt: stamp }
      events.push(event)
      return event
    },

    async updateEvent(id: string, change: EventChange) {
      record('updateEvent', id, change)
      const index = events.findIndex((event) => event.id === id)
      if (index < 0) throw new DomainError('NOT_FOUND', 'Event not found')
      events[index] = { ...events[index], ...change.changes, updatedAt: now().toISOString() } as CalendarEvent
      return events[index]
    },

    async deleteEvent(id, scope, occurrenceStart) {
      record('deleteEvent', id, scope, occurrenceStart)
      const index = events.findIndex((event) => event.id === id)
      if (index < 0) throw new DomainError('NOT_FOUND', 'Event not found')
      events.splice(index, 1)
    },

    async listDependencies() {
      return [...dependencies]
    },

    async setDependencies(taskId: string, dependsOn: string[]) {
      record('setDependencies', taskId, dependsOn)
      const known = new Set((await repository.listTasks()).map((task) => task.id))
      const next = planDependencies(taskId, dependsOn, dependencies, known)
      dependencies = [...dependencies.filter((edge) => edge.taskId !== taskId), ...next]
      return next
    },

    async efforts() {
      const tasks = await repository.listTasks()
      const sessions = expandEvents(events, new Date(0), new Date(now().getTime() + 90 * 86_400_000))
      return Object.fromEntries(tasks.map((task) => [task.id, computeTaskEffort(task, sessions, now())]))
    },

    async proposeSchedule(request: ScheduleRequest) {
      record('proposeSchedule', request)
      const tasks = (await repository.listTasks()).filter((task) => task.status !== 'done' && (!request.taskIds || request.taskIds.includes(task.id)))
      const range = zonedRange(request.from, request.to, preferences.timeZone)
      const busy = expandEvents(events, now(), range.end).map((o) => ({ start: new Date(o.start), end: new Date(o.end), category: o.category }))
      const result = scheduleTasks({ tasks: tasks.map((task) => ({ ...task, completedMinutes: 0, plannedMinutes: 0, plannedUntil: null, dependsOn: [] })), busy, prefs: preferences, from: request.from, to: request.to, now: now() })
      const title = new Map(tasks.map((task) => [task.id, task.title]))
      return propose(
        {
          kind: 'schedule',
          mode: request.mode,
          timeZone: preferences.timeZone,
          from: request.from,
          to: request.to,
          items: result.sessions.map((s) => ({ type: 'create' as const, taskId: s.taskId, title: title.get(s.taskId) ?? 'Task', startAt: s.start.toISOString(), endAt: s.end.toISOString() })),
          unscheduled: result.unscheduled.map((u) => ({ ...u, title: title.get(u.taskId) ?? 'Task' })),
          explanation: [`Planned ${result.sessions.length} session(s).`],
          basis: { tasks: {}, events: {} },
        },
        'engine',
      )
    },

    async listProposals() {
      return proposals.filter((proposal) => proposal.status === 'pending')
    },

    async applyProposal(id: string, input: ApplyProposalInput = {}) {
      record('applyProposal', id, input)
      const proposal = proposals.find((candidate) => candidate.id === id)
      if (!proposal) throw new DomainError('NOT_FOUND', 'Proposal not found')
      if (proposal.status !== 'pending') throw new DomainError('PROPOSAL_DECIDED', `This proposal was already ${proposal.status}.`)
      let result: unknown = null
      const payload = proposal.payload
      if (payload.kind === 'schedule') {
        const items = input.include ? input.include.map((index) => payload.items[index]) : payload.items
        for (const item of items) {
          if (item.type === 'create') await client.createEvent({ title: item.title, category: 'work_session', startAt: item.startAt, endAt: item.endAt, timeZone: payload.timeZone, taskId: item.taskId })
        }
      } else if (payload.kind === 'changes') {
        for (const op of payload.operations) {
          if (op.op === 'update_task') await repository.updateTask(op.taskId, op.changes)
          if (op.op === 'add_subtasks') for (const title of op.titles) await repository.createSubtask(op.taskId, { title })
        }
      } else {
        const plan = input.plan ?? payload.plan
        const project = await repository.createProject({ name: plan.projectName })
        for (const phase of plan.phases) {
          for (const task of phase.tasks) {
            const created = await repository.createTask({ projectId: project.id, title: task.title, priority: task.priority, dueDate: task.dueDate, estimatedMinutes: task.estimatedMinutes })
            for (const title of task.subtasks) await repository.createSubtask(created.id, { title })
          }
        }
        result = { projectId: project.id }
      }
      Object.assign(proposal, { status: 'applied', decidedAt: now().toISOString(), result })
      return { ...proposal }
    },

    async rejectProposal(id: string) {
      record('rejectProposal', id)
      const proposal = proposals.find((candidate) => candidate.id === id)
      if (!proposal) throw new DomainError('NOT_FOUND', 'Proposal not found')
      Object.assign(proposal, { status: 'rejected', decidedAt: now().toISOString() })
      return { ...proposal }
    },

    async insights() {
      const [tasks, projects] = await Promise.all([repository.listTasks(), repository.listProjects()])
      const upcoming = expandEvents(events, now(), new Date(now().getTime() + 8 * 86_400_000))
      return computeInsights({ tasks, projects, upcoming, prefs: preferences, now: now() })
    },

    async aiStatus(): Promise<AiStatus> {
      return { provider: 'mock', model: null, isDemo: true, dailyLimit: 50, usedToday: calls.filter((call) => call.method === 'chat').length, budget: null }
    },

    async chat(message: string, conversationId: string | null): Promise<ChatResponse> {
      record('chat', message, conversationId)
      let conversation = conversations.find((candidate) => candidate.id === conversationId)
      if (!conversation) {
        conversation = { id: nextId(), title: message.slice(0, 80), updatedAt: now().toISOString(), messages: [] }
        conversations.push(conversation)
      }
      const at = now().toISOString()
      const tasks = await repository.listTasks()
      const target = tasks.find((task) => message.toLowerCase().includes(task.title.toLowerCase()))
      let proposal: Proposal | null = null
      let reply = `You have ${tasks.filter((task) => task.status !== 'done').length} open task(s).`
      if (target && /high priority/i.test(message)) {
        proposal = propose({ kind: 'changes', labels: [`Update "${target.title}": priority → high`], operations: [{ op: 'update_task', taskId: target.id, changes: { priority: 'high' } }], basis: { tasks: {}, events: {} } }, 'mock')
        reply = `I can set "${target.title}" to high priority. Approve it below.`
      }
      const userMessage: ChatMessage = { id: nextId(), role: 'user', content: message, source: null, proposalId: null, createdAt: at }
      const assistant: ChatMessage = { id: nextId(), role: 'assistant', content: reply, source: 'mock', proposalId: proposal?.id ?? null, createdAt: at }
      conversation.messages.push(userMessage, assistant)
      const planGoal = /help me (learn|build|prepare)/i.test(message) ? message : null
      return { conversationId: conversation.id, message: assistant, proposal, planGoal, droppedOperations: 0 }
    },

    async listConversations() {
      return conversations.map(({ messages: _messages, ...conversation }) => conversation)
    },

    async conversationMessages(id: string) {
      const conversation = conversations.find((candidate) => candidate.id === id)
      if (!conversation) throw new DomainError('NOT_FOUND', 'Conversation not found')
      return [...conversation.messages]
    },

    async deleteConversation(id: string) {
      const index = conversations.findIndex((candidate) => candidate.id === id)
      if (index >= 0) conversations.splice(index, 1)
    },

    async generatePlan(request: Partial<PlanRequest> & { goal: string }) {
      record('generatePlan', request)
      return propose(
        {
          kind: 'plan',
          request: { goal: request.goal, details: request.details ?? '', deadline: request.deadline ?? null, hoursPerWeek: request.hoursPerWeek ?? null },
          plan: {
            projectName: request.goal.slice(0, 80),
            summary: 'Demo plan',
            clarifyingQuestions: ['How many hours per week can you spend on this?'],
            phases: [
              {
                name: 'Start',
                tasks: [
                  { key: 't1', title: 'Outline the goal', description: '', priority: 'high', estimatedMinutes: 30, dueDate: null, dependsOn: [], subtasks: ['List resources'] },
                  { key: 't2', title: 'Do the first step', description: '', priority: 'medium', estimatedMinutes: 60, dueDate: null, dependsOn: ['t1'], subtasks: [] },
                ],
              },
            ],
          },
        },
        'mock',
      )
    },

    async assistTask(taskId: string, kind: TaskAssistKind) {
      record('assistTask', taskId, kind)
      const proposal =
        kind === 'checklist'
          ? propose({ kind: 'changes', labels: ['Add 2 subtask(s): Research; Draft'], operations: [{ op: 'add_subtasks', taskId, titles: ['Research', 'Draft'] }], basis: { tasks: {}, events: {} } }, 'mock')
          : null
      return { content: `Demo help (${kind}).`, source: 'mock', proposal }
    },
  }

  // Save after every change (the demo); reads don't change anything.
  if (onChange) {
    const mutating = [
      'savePreferences', 'createEvent', 'updateEvent', 'deleteEvent', 'setDependencies', 'proposeSchedule',
      'applyProposal', 'rejectProposal', 'chat', 'deleteConversation', 'generatePlan', 'assistTask',
    ] as const
    for (const name of mutating) {
      const original = client[name] as (...args: unknown[]) => Promise<unknown>
      ;(client as unknown as Record<string, unknown>)[name] = async (...args: unknown[]) => {
        const result = await original(...args)
        onChange(snapshot())
        return result
      }
    }
  }
  return client
}
