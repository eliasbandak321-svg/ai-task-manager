import { and, asc, desc, eq, sql } from 'drizzle-orm'
import type { z } from 'zod'
import {
  addDays,
  AI_LIMITS,
  assistantTurnSchema,
  buildAssistantContext,
  chatRequestSchema,
  DomainError,
  filterOperations,
  idSchema,
  planRequestSchema,
  projectPlanSchema,
  taskAssistRequestSchema,
  taskAssistResultSchema,
  zonedParts,
  zonedRange,
  type AssistantContextInput,
  type Proposal,
} from '../../src/domain'
import type { Database } from '../db/client'
import { aiConversations, aiMessages, aiUsage } from '../db/schema'
import { ApiError } from '../errors'
import type { Workspace } from '../workspace/workspace'
import { MAX_TOKENS } from './anthropicProvider'
import { MockAiProvider } from './mockProvider'
import { costMicroUsd, estimateInputTokens, formatUsd } from './pricing'
import { SpendLedger } from './spendLedger'
import { AiError, type AiProvider, type AiRequestKind, type ChatMessage, type ProviderResult, type Usage } from './provider'

const DEMO = new MockAiProvider()

/*
  AI features for one user. The flow is always:
    authorize (session) → check limits → build bounded context from *this user's* data →
    provider → validate output → store a proposal (never apply) → respond.
  Message content is stored for the conversation history but never logged.
*/

export interface AiSettings {
  provider: AiProvider
  dailyRequestLimit: number
  /** Hard cap on real-provider spending across all users, in micro-dollars. Default: $1. */
  budgetMicroUsd?: number
  /** Used when the real provider is over budget or unavailable. Default: the demo provider. */
  fallback?: AiProvider
  /** The spending ledger; default: the application-wide one in this database. */
  ledger?: SpendLedger
}

/** Why an answer came from Demo AI although a real provider is configured. */
export type FallbackReason = 'budget' | 'unavailable'

const FALLBACK_NOTICE: Record<FallbackReason, string> = {
  budget: 'Real AI is paused because the app’s AI spending limit has been reached.',
  unavailable: 'Real AI could not be reached just now.',
}

interface Generated<T> {
  output: T
  source: AiProvider['name']
  fallbackReason: FallbackReason | null
}

export interface ChatResponse {
  conversationId: string
  message: StoredMessage
  proposal: Proposal | null
  /** For "propose_plan": the goal to prefill the plan builder with. */
  planGoal: string | null
  /** Operations the model suggested but that referenced data it wasn't shown (dropped). */
  droppedOperations: number
}

export interface StoredMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  source: string | null
  proposalId: string | null
  createdAt: string
}

/** Per-user burst limit, in memory (the daily limit in the database is the durable one). */
const BURST_WINDOW_MS = 60_000
const BURST_MAX = 10
const recentRequests = new Map<string, number[]>()

function checkBurst(userId: string, now: number): void {
  const recent = (recentRequests.get(userId) ?? []).filter((at) => now - at < BURST_WINDOW_MS)
  if (recent.length >= BURST_MAX) throw new ApiError(429, 'RATE_LIMITED', 'Too many AI requests. Please wait a minute.')
  recent.push(now)
  recentRequests.set(userId, recent)
}

/** For tests: forget burst counters. */
export function resetAiBurstLimits(): void {
  recentRequests.clear()
}

export class AiService {
  private readonly db: Database
  private readonly workspace: Workspace
  private readonly settings: AiSettings

  constructor(workspace: Workspace, settings: AiSettings) {
    this.db = workspace.db
    this.workspace = workspace
    this.settings = settings
  }

  private get userId() {
    return this.workspace.userId
  }

  private get budget(): number {
    return this.settings.budgetMicroUsd ?? 1_000_000
  }

  /** The application-wide spending ledger (independent of user accounts). */
  private get ledger(): SpendLedger {
    return this.settings.ledger ?? new SpendLedger(this.db, { now: this.workspace.now })
  }

  async status() {
    // The daily limit resets at midnight UTC (the same day key as reserve()).
    const day = zonedParts(this.workspace.now(), 'UTC').date
    const [row] = await this.db.select().from(aiUsage).where(and(eq(aiUsage.userId, this.userId), eq(aiUsage.day, day)))
    const real = this.settings.provider.name !== 'mock'
    const spent = real ? await this.ledger.committed() : 0
    return {
      provider: this.settings.provider.name,
      model: this.settings.provider.model,
      isDemo: !real,
      dailyLimit: this.settings.dailyRequestLimit,
      usedToday: row?.requests ?? 0,
      budget: real ? { limitUsd: this.budget / 1_000_000, spentUsd: spent / 1_000_000, exhausted: spent >= this.budget } : null,
    }
  }

  /**
   * Runs one AI request: through the real provider when it's configured and the worst-case
   * cost still fits the spending cap, otherwise (or when it's unreachable) through Demo AI,
   * labelled as such. Output is validated with the domain schema either way.
   */
  private async generate<S extends z.ZodType>(
    kind: AiRequestKind,
    promptText: string,
    schema: S,
    call: (provider: AiProvider) => Promise<ProviderResult<z.output<S>>>,
    day: string,
  ): Promise<Generated<z.output<S>>> {
    const provider = this.settings.provider
    const fallback = this.settings.fallback ?? DEMO
    const viaFallback = async (reason: FallbackReason): Promise<Generated<z.output<S>>> => {
      const { output } = await call(fallback).then(validated(schema))
      return { output, source: fallback.name, fallbackReason: reason }
    }
    if (provider.name === 'mock' || provider.model === null) {
      const { output } = await call(provider)
        .then(validated(schema))
        .catch((error: unknown) => {
          throw toApiError(error)
        })
      return { output, source: provider.name, fallbackReason: null }
    }

    // Reserve the worst case first (atomic, app-wide); no reservation, no real request.
    const model = provider.model
    const worstCase = costMicroUsd(model, estimateInputTokens(promptText), MAX_TOKENS[kind])
    const entry = await this.ledger.reserve(kind, model, worstCase, this.budget)
    if (entry === null) {
      console.warn(`AI budget reached (${formatUsd(this.budget)}): using Demo AI`)
      return viaFallback('budget')
    }

    let usage: Usage | null = null
    try {
      const result = await call(provider)
      usage = result.usage
      const { output } = validated(schema)(result)
      const cost = costMicroUsd(model, usage.inputTokens, usage.outputTokens)
      await this.ledger.settle(entry, cost, usage)
      await this.recordUsage(day, usage)
      // Counts only: never prompts, answers or user data.
      console.info(`AI usage: ${kind} ${model} input=${usage.inputTokens} output=${usage.outputTokens} cost=${formatUsd(cost)}`)
      return { output, source: provider.name, fallbackReason: null }
    } catch (error) {
      const billed = usage ?? (error instanceof AiError ? error.usage : null)
      if (billed) {
        // The model answered (refused, cut off or invalid): that was billed.
        await this.ledger.settle(entry, costMicroUsd(model, billed.inputTokens, billed.outputTokens), billed)
        await this.recordUsage(day, billed)
      } else if (error instanceof AiError && (error.code === 'unavailable' || error.code === 'rate_limited')) {
        // An error response from the API: not billed.
        await this.ledger.release(entry, error.code)
      } else {
        // A timeout or an unexpected failure: the request may have run, keep the worst case.
        await this.ledger.keep(entry, error instanceof AiError ? error.code : 'unexpected')
      }
      if (error instanceof AiError && (error.code === 'unavailable' || error.code === 'timeout' || error.code === 'rate_limited')) {
        console.warn(`AI provider error: ${error.code}; using Demo AI`)
        return viaFallback('unavailable')
      }
      throw toApiError(error)
    }
  }

  /**
   * Counts one request against the daily limit, atomically: the row only increments while
   * under the limit, so parallel requests can't overshoot it.
   */
  private async reserve(): Promise<string> {
    checkBurst(this.userId, this.workspace.now().getTime())
    const day = zonedParts(this.workspace.now(), 'UTC').date
    const rows = await this.db
      .insert(aiUsage)
      .values({ userId: this.userId, day, requests: 1 })
      .onConflictDoUpdate({
        target: [aiUsage.userId, aiUsage.day],
        set: { requests: sql`${aiUsage.requests} + 1` },
        setWhere: sql`${aiUsage.requests} < ${this.settings.dailyRequestLimit}`,
      })
      .returning({ requests: aiUsage.requests })
    if (rows.length === 0) {
      throw new ApiError(429, 'AI_LIMIT_REACHED', `You've reached today's limit of ${this.settings.dailyRequestLimit} AI requests. It resets tomorrow.`)
    }
    return day
  }

  /** Per-user token statistics (spending itself is tracked in the ledger). */
  private async recordUsage(day: string, usage: Usage): Promise<void> {
    if (usage.inputTokens === 0 && usage.outputTokens === 0) return
    await this.db
      .update(aiUsage)
      .set({
        inputTokens: sql`${aiUsage.inputTokens} + ${usage.inputTokens}`,
        outputTokens: sql`${aiUsage.outputTokens} + ${usage.outputTokens}`,
      })
      .where(and(eq(aiUsage.userId, this.userId), eq(aiUsage.day, day)))
  }

  private async contextInput(): Promise<AssistantContextInput> {
    const prefs = await this.workspace.prefs()
    const now = this.workspace.now()
    const today = zonedParts(now, prefs.timeZone).date
    const range = zonedRange(today, addDays(today, 13), prefs.timeZone)
    const [projects, tasks, upcoming] = await Promise.all([
      this.workspace.tasks.listProjects(),
      this.workspace.tasks.listTasks(),
      this.workspace.calendar.occurrences(now, range.end),
    ])
    return { projects, tasks, upcoming, prefs, now }
  }

  // ---------- Conversations ----------

  async listConversations() {
    const rows = await this.db
      .select()
      .from(aiConversations)
      .where(eq(aiConversations.userId, this.userId))
      .orderBy(desc(aiConversations.updatedAt))
      .limit(30)
    return rows.map((row) => ({ id: row.id, title: row.title, updatedAt: row.updatedAt.toISOString() }))
  }

  async messages(conversationId: string): Promise<StoredMessage[]> {
    await this.conversation(conversationId)
    const rows = await this.db
      .select()
      .from(aiMessages)
      .where(and(eq(aiMessages.userId, this.userId), eq(aiMessages.conversationId, conversationId)))
      .orderBy(asc(aiMessages.createdAt), asc(aiMessages.id))
    return rows.map(toMessage)
  }

  async deleteConversation(conversationId: string): Promise<void> {
    await this.conversation(conversationId)
    await this.db.delete(aiConversations).where(and(eq(aiConversations.id, conversationId), eq(aiConversations.userId, this.userId)))
  }

  private async conversation(id: string) {
    if (!idSchema.safeParse(id).success) throw new DomainError('NOT_FOUND', 'Conversation not found')
    const [row] = await this.db
      .select()
      .from(aiConversations)
      .where(and(eq(aiConversations.id, id), eq(aiConversations.userId, this.userId)))
    if (!row) throw new DomainError('NOT_FOUND', 'Conversation not found')
    return row
  }

  private async insertMessage(conversationId: string, message: Omit<StoredMessage, 'id' | 'createdAt'>, at: Date): Promise<StoredMessage> {
    const [row] = await this.db
      .insert(aiMessages)
      .values({ id: this.workspace.newId(), userId: this.userId, conversationId, ...message, createdAt: at })
      .returning()
    return toMessage(row)
  }

  // ---------- Chat ----------

  async chat(input: unknown): Promise<ChatResponse> {
    const request = chatRequestSchema.parse(input)
    const existing = request.conversationId ? await this.conversation(request.conversationId) : null
    const day = await this.reserve()

    const history: ChatMessage[] = existing
      ? (
          await this.db
            .select({ role: aiMessages.role, content: aiMessages.content })
            .from(aiMessages)
            .where(and(eq(aiMessages.userId, this.userId), eq(aiMessages.conversationId, existing.id)))
            .orderBy(desc(aiMessages.createdAt))
            .limit(AI_LIMITS.historyMessages)
        ).reverse()
      : []

    const data = await this.contextInput()
    const context = buildAssistantContext(data)
    const request_ = { contextText: context.text, history, message: request.message, useCase: data.prefs.useCase, data }
    const { output, source, fallbackReason } = await this.generate(
      'assistant',
      `${context.text}\n${history.map((m) => m.content).join('\n')}\n${request.message}`,
      assistantTurnSchema,
      (provider) => provider.assistantTurn(request_),
      day,
    )

    let proposal: Proposal | null = null
    let dropped = 0
    if (output.intent === 'propose_changes') {
      const filtered = filterOperations(output.operations, context)
      dropped = filtered.dropped
      proposal = await this.workspace.proposeChanges(filtered.kept, source)
    } else if (output.intent === 'propose_schedule') {
      proposal = await this.workspace.proposeSchedule({ mode: /\b(replan|reschedule)\b/i.test(request.message) ? 'replan' : 'fill', from: context.today, to: addDays(context.today, 6) })
    }

    // Messages are ordered by time: never let a new one sort before the previous ones.
    const [last] = existing
      ? await this.db
          .select({ createdAt: aiMessages.createdAt })
          .from(aiMessages)
          .where(and(eq(aiMessages.userId, this.userId), eq(aiMessages.conversationId, existing.id)))
          .orderBy(desc(aiMessages.createdAt))
          .limit(1)
      : []
    const clock = this.workspace.now()
    const now = last && last.createdAt >= clock ? new Date(last.createdAt.getTime() + 1) : clock
    const conversationId = existing?.id ?? this.workspace.newId()
    if (existing) {
      await this.db.update(aiConversations).set({ updatedAt: now }).where(and(eq(aiConversations.id, existing.id), eq(aiConversations.userId, this.userId)))
    } else {
      const title = request.message.replace(/\s+/g, ' ').slice(0, 80)
      await this.db.insert(aiConversations).values({ id: conversationId, userId: this.userId, title, createdAt: now, updatedAt: now })
    }
    await this.insertMessage(conversationId, { role: 'user', content: request.message, source: null, proposalId: null }, now)
    let reply = output.reply
    if (output.intent === 'propose_changes' && proposal === null) {
      reply += '\n\n(No change could be proposed: the suggestion referred to items that are not in your current data.)'
    }
    if (fallbackReason) reply += `\n\n(${FALLBACK_NOTICE[fallbackReason]} This answer comes from Demo AI.)`
    const message = await this.insertMessage(
      conversationId,
      { role: 'assistant', content: reply.slice(0, AI_LIMITS.reply + 400), source, proposalId: proposal?.id ?? null },
      new Date(now.getTime() + 1),
    )
    return { conversationId, message, proposal, planGoal: output.intent === 'propose_plan' ? output.planGoal ?? request.message : null, droppedOperations: dropped }
  }

  // ---------- Plan builder ----------

  async plan(input: unknown): Promise<Proposal> {
    const request = planRequestSchema.parse(input)
    const prefs = await this.workspace.prefs()
    const today = zonedParts(this.workspace.now(), prefs.timeZone).date
    if (request.deadline !== null && request.deadline < today) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'The deadline is in the past.')
    }
    const day = await this.reserve()
    const { output, source } = await this.generate(
      'plan',
      `${request.goal}\n${request.details}`,
      projectPlanSchema,
      (provider) => provider.projectPlan({ request, today, useCase: prefs.useCase }),
      day,
    )
    // Keep model-suggested dates inside [today, deadline].
    const plan = {
      ...output,
      phases: output.phases.map((phase) => ({
        ...phase,
        tasks: phase.tasks.map((task) => ({
          ...task,
          dueDate:
            task.dueDate === null ? null : task.dueDate < today ? today : request.deadline && task.dueDate > request.deadline ? request.deadline : task.dueDate,
        })),
      })),
    }
    return this.workspace.proposals.create({ kind: 'plan', request, plan }, source)
  }

  // ---------- Help on one task ----------

  async taskAssist(taskId: string, input: unknown) {
    const { kind } = taskAssistRequestSchema.parse(input)
    const [tasks, projects, subtasks] = await Promise.all([
      this.workspace.tasks.listTasks(),
      this.workspace.tasks.listProjects(),
      this.workspace.tasks.listSubtasks(),
    ])
    const task = tasks.find((candidate) => candidate.id === taskId)
    if (!task) throw new DomainError('NOT_FOUND', 'Task not found')
    const prefs = await this.workspace.prefs()
    const day = await this.reserve()
    const assistRequest = {
      kind,
      today: zonedParts(this.workspace.now(), prefs.timeZone).date,
      useCase: prefs.useCase,
      task: {
        title: task.title,
        description: task.description.slice(0, 1500),
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        estimatedMinutes: task.estimatedMinutes,
        projectName: projects.find((project) => project.id === task.projectId)?.name ?? 'Inbox',
        subtasks: subtasks.filter((subtask) => subtask.taskId === task.id).map((subtask) => subtask.title),
      },
    }
    const { output, source, fallbackReason } = await this.generate(
      'assist',
      JSON.stringify(assistRequest.task),
      taskAssistResultSchema,
      (provider) => provider.taskAssist(assistRequest),
      day,
    )
    const proposal =
      output.checklist.length > 0
        ? await this.workspace.proposeChanges([{ op: 'add_subtasks', taskId: task.id, titles: output.checklist }], source)
        : null
    const content = fallbackReason ? `${output.content}\n\n(${FALLBACK_NOTICE[fallbackReason]} This answer comes from Demo AI.)` : output.content
    return { content, source, proposal }
  }
}

/** Never trust a provider to validate its own output: parse it again with the domain schema. */
function validated<S extends z.ZodType>(schema: S) {
  return <R extends { output: unknown; usage: Usage }>(result: R) => {
    const parsed = schema.safeParse(result.output)
    if (!parsed.success) throw new AiError('invalid_output', 'Provider output failed validation')
    return { ...result, output: parsed.data as z.output<S> }
  }
}

function toMessage(row: typeof aiMessages.$inferSelect): StoredMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    source: row.source,
    proposalId: row.proposalId,
    createdAt: row.createdAt.toISOString(),
  }
}

/** Provider failures become safe API errors; nothing about the request is logged. */
function toApiError(error: unknown): Error {
  if (error instanceof AiError) {
    console.warn(`AI provider error: ${error.code}`)
    if (error.code === 'invalid_output' || error.code === 'refused') {
      return new ApiError(502, 'AI_INVALID_OUTPUT', "The AI couldn't produce a valid answer. Please try again or rephrase.")
    }
    return new ApiError(503, 'AI_UNAVAILABLE', 'The AI service is not available right now. Please try again later.')
  }
  // A schema failure in a provider's output is treated the same way.
  if (error instanceof Error && error.name === 'ZodError') {
    return new ApiError(502, 'AI_INVALID_OUTPUT', "The AI couldn't produce a valid answer. Please try again or rephrase.")
  }
  return error instanceof Error ? error : new Error('Unknown AI error')
}
