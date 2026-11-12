import { randomUUID } from 'node:crypto'
import { and, desc, eq, gt } from 'drizzle-orm'
import {
  DomainError,
  idSchema,
  PROPOSAL_TTL_HOURS,
  proposalPayloadSchema,
  type Proposal,
  type ProposalPayload,
  type ProposalSource,
} from '../../src/domain'
import type { Database, Transaction } from '../db/client'
import { aiProposals } from '../db/schema'

type ProposalRow = typeof aiProposals.$inferSelect

function toProposal(row: ProposalRow): Proposal {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    source: row.source as ProposalSource,
    // Stored JSON is re-validated on every read, like any other external input.
    payload: proposalPayloadSchema.parse(row.payload),
    result: row.result ?? null,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
  }
}

/** Proposals of one user: created pending, decided (applied or rejected) exactly once. */
export class ProposalStore {
  private readonly db: Database
  private readonly userId: string
  private readonly now: () => Date
  private readonly newId: () => string

  constructor(db: Database, userId: string, now: () => Date = () => new Date(), newId: () => string = randomUUID) {
    this.db = db
    this.userId = userId
    this.now = now
    this.newId = newId
  }

  async create(payload: ProposalPayload, source: ProposalSource): Promise<Proposal> {
    const createdAt = this.now()
    const [row] = await this.db
      .insert(aiProposals)
      .values({
        id: this.newId(),
        userId: this.userId,
        kind: payload.kind,
        status: 'pending',
        payload: proposalPayloadSchema.parse(payload),
        source,
        createdAt,
        expiresAt: new Date(createdAt.getTime() + PROPOSAL_TTL_HOURS * 3_600_000),
      })
      .returning()
    return toProposal(row)
  }

  async get(id: string, db: Database | Transaction = this.db): Promise<Proposal> {
    if (!idSchema.safeParse(id).success) throw new DomainError('NOT_FOUND', 'Proposal not found')
    const [row] = await db
      .select()
      .from(aiProposals)
      .where(and(eq(aiProposals.id, id), eq(aiProposals.userId, this.userId)))
    if (!row) throw new DomainError('NOT_FOUND', 'Proposal not found')
    return toProposal(row)
  }

  async listPending(): Promise<Proposal[]> {
    const rows = await this.db
      .select()
      .from(aiProposals)
      .where(and(eq(aiProposals.userId, this.userId), eq(aiProposals.status, 'pending'), gt(aiProposals.expiresAt, this.now())))
      .orderBy(desc(aiProposals.createdAt))
      .limit(20)
    return rows.map(toProposal)
  }

  /**
   * Atomically moves a pending, unexpired proposal to `status`. Only one request can win:
   * a second click, a replayed request or a concurrent tab finds it already decided.
   * Call inside the transaction that applies the changes, so a failure undoes the claim.
   */
  async claim(tx: Transaction, id: string, status: 'applied' | 'rejected'): Promise<Proposal> {
    if (!idSchema.safeParse(id).success) throw new DomainError('NOT_FOUND', 'Proposal not found')
    const now = this.now()
    const [row] = await tx
      .update(aiProposals)
      .set({ status, decidedAt: now })
      .where(
        and(
          eq(aiProposals.id, id),
          eq(aiProposals.userId, this.userId),
          eq(aiProposals.status, 'pending'),
          gt(aiProposals.expiresAt, now),
        ),
      )
      .returning()
    if (row) return toProposal(row)

    // Read inside the same transaction (one connection; never wait on our own lock).
    const existing = await this.get(id, tx) // 404 for a missing or foreign proposal
    if (existing.status !== 'pending') throw new DomainError('PROPOSAL_DECIDED', `This proposal was already ${existing.status}.`)
    throw new DomainError('PROPOSAL_EXPIRED', 'This proposal has expired. Ask for a new one.')
  }

  async setResult(tx: Transaction, id: string, result: unknown): Promise<void> {
    await tx
      .update(aiProposals)
      .set({ result })
      .where(and(eq(aiProposals.id, id), eq(aiProposals.userId, this.userId)))
  }
}
