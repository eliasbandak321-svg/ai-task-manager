import { z } from 'zod'
import { operationSchema, planRequestSchema, projectPlanSchema } from './ai'
import { idSchema, timestampSchema } from './schemas'

/*
  Proposals (M9): suggested changes that wait for the user's decision.

  - plan      a project with phases, tasks and subtasks from the goal builder
  - schedule  work sessions placed by the scheduling engine (fill free time, or replan)
  - changes   allowlisted operations suggested by the assistant or the task helper

  A proposal is stored with a `basis`: the updatedAt of every task and event it relies on.
  When it's applied, anything that changed since makes it stale (409), so an old preview
  can never overwrite newer edits. Approval flips the status exactly once.
*/

export const PROPOSAL_SOURCES = ['mock', 'anthropic', 'engine'] as const
export type ProposalSource = (typeof PROPOSAL_SOURCES)[number]

const basisSchema = z.object({
  tasks: z.record(z.string(), timestampSchema),
  events: z.record(z.string(), timestampSchema),
})
export type ProposalBasis = z.infer<typeof basisSchema>

export const planPayloadSchema = z.object({
  kind: z.literal('plan'),
  request: planRequestSchema,
  plan: projectPlanSchema,
})

export type PlanPayload = z.infer<typeof planPayloadSchema>

const sessionTimes = { startAt: timestampSchema, endAt: timestampSchema }
export const scheduleItemSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('create'), taskId: idSchema, title: z.string(), ...sessionTimes }),
  z.object({
    type: z.literal('move'),
    eventId: idSchema,
    taskId: idSchema,
    title: z.string(),
    fromStartAt: timestampSchema,
    fromEndAt: timestampSchema,
    ...sessionTimes,
  }),
  z.object({ type: z.literal('remove'), eventId: idSchema, taskId: idSchema, title: z.string(), fromStartAt: timestampSchema, fromEndAt: timestampSchema }),
])
export type ScheduleItem = z.infer<typeof scheduleItemSchema>

export const schedulePayloadSchema = z.object({
  kind: z.literal('schedule'),
  mode: z.enum(['fill', 'replan']),
  timeZone: z.string(),
  from: z.string(),
  to: z.string(),
  items: z.array(scheduleItemSchema),
  unscheduled: z.array(
    z.object({
      taskId: idSchema,
      title: z.string(),
      reason: z.enum(['not_enough_time', 'deadline_passed', 'blocked_by_dependency', 'dependency_cycle']),
      missingMinutes: z.int(),
      blockedBy: z.string().optional(),
    }),
  ),
  /** Plain-language explanation of the result, computed from the numbers (not by AI). */
  explanation: z.array(z.string()),
  basis: basisSchema,
})
export type SchedulePayload = z.infer<typeof schedulePayloadSchema>

export const changesPayloadSchema = z.object({
  kind: z.literal('changes'),
  /** One human-readable line per operation, written by the server from real data. */
  labels: z.array(z.string()),
  operations: z.array(operationSchema),
  basis: basisSchema,
})
export type ChangesPayload = z.infer<typeof changesPayloadSchema>

export const proposalPayloadSchema = z.discriminatedUnion('kind', [planPayloadSchema, schedulePayloadSchema, changesPayloadSchema])
export type ProposalPayload = z.infer<typeof proposalPayloadSchema>

export const proposalSchema = z.object({
  id: idSchema,
  kind: z.enum(['plan', 'schedule', 'changes']),
  status: z.enum(['pending', 'applied', 'rejected']),
  source: z.enum(PROPOSAL_SOURCES),
  payload: proposalPayloadSchema,
  result: z.unknown().nullable(),
  createdAt: timestampSchema,
  expiresAt: timestampSchema,
  decidedAt: timestampSchema.nullable(),
})
export type Proposal = z.infer<typeof proposalSchema>

/** How long a proposal can be approved; after that the data has probably moved on. */
export const PROPOSAL_TTL_HOURS = 24

/** What the user approves: optionally an edited plan, or a subset of the items/operations. */
export const applyProposalInputSchema = z.strictObject({
  plan: projectPlanSchema.optional(),
  /** Indexes into items (schedule) or operations (changes); default: all. */
  include: z.array(z.int().min(0).max(500)).max(500).optional(),
})
export type ApplyProposalInput = z.output<typeof applyProposalInputSchema>

export function isExpired(proposal: Pick<Proposal, 'expiresAt'>, now: Date): boolean {
  return new Date(proposal.expiresAt) <= now
}
