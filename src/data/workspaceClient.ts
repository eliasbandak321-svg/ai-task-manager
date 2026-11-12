import { z } from 'zod'
import {
  calendarEventSchema,
  createEventInputSchema,
  EVENT_CATEGORIES,
  idSchema,
  isoDateSchema,
  preferencesSchema,
  proposalSchema,
  SESSION_STATUSES,
  timestampSchema,
  type ApplyProposalInput,
  type CalendarEvent,
  type EditScope,
  type Insights,
  type Occurrence,
  type PlanRequest,
  type Preferences,
  type Proposal,
  type TaskAssistKind,
  type TaskDependency,
  type TaskEffort,
  type UpdateEventInput,
} from '../domain'
import { createTransport, type HttpTransportOptions, type Request } from './httpTransport'

/*
  The workspace client (M9): preferences, calendar, scheduling, proposals, insights and AI.
  Like the TaskRepository it's an interface, so components never call fetch directly and
  tests can pass an in-memory version.
*/

const preferencesResponseSchema = z.object({
  preferences: preferencesSchema,
  saved: z.boolean(),
  updatedAt: timestampSchema.nullable(),
})
export type PreferencesResponse = z.infer<typeof preferencesResponseSchema>

const occurrenceSchema = z.object({
  eventId: idSchema,
  occurrenceStart: timestampSchema,
  start: timestampSchema,
  end: timestampSchema,
  title: z.string(),
  category: z.enum(EVENT_CATEGORIES),
  taskId: idSchema.nullable(),
  isRecurring: z.boolean(),
  seriesId: idSchema.nullable(),
  sessionStatus: z.enum(SESSION_STATUSES),
})

const calendarRangeSchema = z.object({ events: z.array(calendarEventSchema), occurrences: z.array(occurrenceSchema) })
export interface CalendarRange {
  events: CalendarEvent[]
  occurrences: Occurrence[]
}

const insightsSchema = z.object({
  today: isoDateSchema,
  counts: z.object({
    total: z.int(),
    completed: z.int(),
    pending: z.int(),
    overdue: z.int(),
    dueToday: z.int(),
    upcoming: z.int(),
    completedLast7Days: z.int(),
  }),
  completionPercent: z.int(),
  projects: z.array(z.object({ projectId: idSchema, name: z.string(), total: z.int(), done: z.int(), percent: z.int() })),
  workload: z.array(z.object({ date: isoDateSchema, scheduledMinutes: z.number(), capacityMinutes: z.int(), dueTasks: z.int() })),
  scheduling: z.object({ scheduled: z.int(), unscheduled: z.int(), unscheduledTaskIds: z.array(idSchema) }),
  suggestions: z.array(
    z.object({
      kind: z.enum(['overdue', 'overloaded_day', 'unscheduled_urgent', 'missing_estimate', 'nothing_planned']),
      message: z.string(),
      taskIds: z.array(idSchema),
      date: isoDateSchema.optional(),
    }),
  ),
})

const dependencySchema = z.object({ taskId: idSchema, dependsOnId: idSchema })
const effortSchema = z.object({
  estimatedMinutes: z.int().nullable(),
  completedMinutes: z.number(),
  plannedMinutes: z.number(),
  missedMinutes: z.number(),
  remainingMinutes: z.number().nullable(),
  plannedUntil: timestampSchema.nullable(),
})

const aiStatusSchema = z.object({
  provider: z.enum(['mock', 'anthropic']),
  model: z.string().nullable(),
  isDemo: z.boolean(),
  dailyLimit: z.int(),
  usedToday: z.int(),
  /** Only for a real provider: the app's spending cap and what's been used. */
  budget: z.object({ limitUsd: z.number(), spentUsd: z.number(), exhausted: z.boolean() }).nullable(),
})
export type AiStatus = z.infer<typeof aiStatusSchema>

const messageSchema = z.object({
  id: idSchema,
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  source: z.string().nullable(),
  proposalId: idSchema.nullable(),
  createdAt: timestampSchema,
})
export type ChatMessage = z.infer<typeof messageSchema>

const chatResponseSchema = z.object({
  conversationId: idSchema,
  message: messageSchema,
  proposal: proposalSchema.nullable(),
  planGoal: z.string().nullable(),
  droppedOperations: z.int(),
})
export type ChatResponse = z.infer<typeof chatResponseSchema>

const conversationSchema = z.object({ id: idSchema, title: z.string(), updatedAt: timestampSchema })
export type Conversation = z.infer<typeof conversationSchema>

const assistResultSchema = z.object({ content: z.string(), source: z.string(), proposal: proposalSchema.nullable() })
export type AssistResult = z.infer<typeof assistResultSchema>

export type CreateEventRequest = z.input<typeof createEventInputSchema>

export interface ScheduleRequest {
  mode: 'fill' | 'replan'
  from: string
  to: string
  taskIds?: string[] | null
}

export interface EventChange {
  scope?: EditScope
  occurrenceStart?: string | null
  changes: UpdateEventInput
}

export interface WorkspaceClient {
  getPreferences(fallbackTimeZone: string): Promise<PreferencesResponse>
  savePreferences(preferences: Preferences): Promise<PreferencesResponse>

  listCalendar(from: string, to: string): Promise<CalendarRange>
  createEvent(input: CreateEventRequest): Promise<CalendarEvent>
  updateEvent(id: string, change: EventChange): Promise<CalendarEvent>
  deleteEvent(id: string, scope?: EditScope, occurrenceStart?: string | null): Promise<void>

  listDependencies(): Promise<TaskDependency[]>
  setDependencies(taskId: string, dependsOn: string[]): Promise<TaskDependency[]>
  efforts(): Promise<Record<string, TaskEffort>>

  proposeSchedule(request: ScheduleRequest): Promise<Proposal>
  listProposals(): Promise<Proposal[]>
  applyProposal(id: string, input?: ApplyProposalInput): Promise<Proposal>
  rejectProposal(id: string): Promise<Proposal>

  insights(): Promise<Insights>

  aiStatus(): Promise<AiStatus>
  chat(message: string, conversationId: string | null): Promise<ChatResponse>
  listConversations(): Promise<Conversation[]>
  conversationMessages(id: string): Promise<ChatMessage[]>
  deleteConversation(id: string): Promise<void>
  generatePlan(request: Partial<PlanRequest> & { goal: string }): Promise<Proposal>
  assistTask(taskId: string, kind: TaskAssistKind): Promise<AssistResult>
}

const id = (value: string) => encodeURIComponent(value)

export class HttpWorkspaceClient implements WorkspaceClient {
  private readonly request: Request

  constructor(options: HttpTransportOptions = {}) {
    this.request = createTransport(options)
  }

  getPreferences(fallbackTimeZone: string) {
    return this.request('GET', `/preferences?tz=${encodeURIComponent(fallbackTimeZone)}`, preferencesResponseSchema)
  }

  savePreferences(preferences: Preferences) {
    return this.request('PUT', '/preferences', preferencesResponseSchema, preferencesSchema.parse(preferences))
  }

  listCalendar(from: string, to: string) {
    return this.request('GET', `/calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, calendarRangeSchema)
  }

  createEvent(input: CreateEventRequest) {
    return this.request('POST', '/calendar/events', calendarEventSchema, createEventInputSchema.parse(input))
  }

  updateEvent(eventId: string, change: EventChange) {
    return this.request('PATCH', `/calendar/events/${id(eventId)}`, calendarEventSchema, change)
  }

  deleteEvent(eventId: string, scope: EditScope = 'series', occurrenceStart: string | null = null) {
    const query = new URLSearchParams({ scope, ...(occurrenceStart ? { occurrenceStart } : {}) })
    return this.request('DELETE', `/calendar/events/${id(eventId)}?${query}`, null)
  }

  listDependencies() {
    return this.request('GET', '/dependencies', z.array(dependencySchema))
  }

  setDependencies(taskId: string, dependsOn: string[]) {
    return this.request('PUT', `/tasks/${id(taskId)}/dependencies`, z.array(dependencySchema), { dependsOn })
  }

  efforts() {
    return this.request('GET', '/effort', z.record(z.string(), effortSchema))
  }

  proposeSchedule(request: ScheduleRequest) {
    return this.request('POST', '/schedule/proposals', proposalSchema, request)
  }

  listProposals() {
    return this.request('GET', '/proposals', z.array(proposalSchema))
  }

  applyProposal(proposalId: string, input: ApplyProposalInput = {}) {
    return this.request('POST', `/proposals/${id(proposalId)}/apply`, proposalSchema, input)
  }

  rejectProposal(proposalId: string) {
    return this.request('POST', `/proposals/${id(proposalId)}/reject`, proposalSchema, {})
  }

  insights() {
    return this.request('GET', '/insights', insightsSchema)
  }

  aiStatus() {
    return this.request('GET', '/ai/status', aiStatusSchema)
  }

  chat(message: string, conversationId: string | null) {
    return this.request('POST', '/ai/chat', chatResponseSchema, { message, conversationId })
  }

  listConversations() {
    return this.request('GET', '/ai/conversations', z.array(conversationSchema))
  }

  conversationMessages(conversationId: string) {
    return this.request('GET', `/ai/conversations/${id(conversationId)}/messages`, z.array(messageSchema))
  }

  deleteConversation(conversationId: string) {
    return this.request('DELETE', `/ai/conversations/${id(conversationId)}`, null)
  }

  generatePlan(request: Partial<PlanRequest> & { goal: string }) {
    return this.request('POST', '/ai/plan', proposalSchema, request)
  }

  assistTask(taskId: string, kind: TaskAssistKind) {
    return this.request('POST', `/ai/tasks/${id(taskId)}/assist`, assistResultSchema, { kind })
  }
}
