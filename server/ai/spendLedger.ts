import { randomUUID } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import type { Database } from '../db/client'
import { aiSpendLedger, aiSpendTotal } from '../db/schema'

/*
  The application-wide AI spending ledger (migration 0004).

  Before a real request, its worst-case cost is *reserved* with one conditional UPDATE on a
  single counter row: "add X if the total stays within the cap". PostgreSQL locks that row
  for the update, so concurrent requests are applied one after another and can never push
  the total past the cap together. After the request the reservation is settled:
  - settle:  the actual cost from the reported token usage replaces the reservation;
  - release: the provider answered with an error (not billed), so nothing is spent;
  - keep:    the cost is unknown (e.g. a timeout after the request may have run), so the
             worst-case reservation stays counted — the safe side.

  Not linked to user accounts: deleting a user never removes spending history. The ledger
  counts only what this app has requested through this database; the Anthropic Console is the
  authoritative bill for the whole account.
*/

export const APP_BUDGET_KEY = 'app'

export interface SpendUsage {
  inputTokens: number
  outputTokens: number
}

export class SpendLedger {
  private readonly db: Database
  private readonly key: string
  private readonly now: () => Date

  constructor(db: Database, { key = APP_BUDGET_KEY, now = () => new Date() }: { key?: string; now?: () => Date } = {}) {
    this.db = db
    this.key = key
    this.now = now
  }

  /** Reserved plus settled spending so far, in micro-dollars. */
  async committed(): Promise<number> {
    const [row] = await this.db.select({ value: aiSpendTotal.committedMicroUsd }).from(aiSpendTotal).where(eq(aiSpendTotal.key, this.key))
    return Number(row?.value ?? 0)
  }

  /**
   * Reserves `amount` if the total stays within `limit`. Returns the ledger entry id, or null
   * when the cap doesn't allow it. Atomic: counter and ledger entry are written together.
   */
  async reserve(kind: string, model: string, amount: number, limit: number): Promise<string | null> {
    if (amount > limit) return null
    const id = randomUUID()
    const now = this.now()
    return this.db.transaction(async (tx) => {
      const updated = await tx
        .insert(aiSpendTotal)
        .values({ key: this.key, committedMicroUsd: amount, updatedAt: now })
        .onConflictDoUpdate({
          target: aiSpendTotal.key,
          set: { committedMicroUsd: sql`${aiSpendTotal.committedMicroUsd} + ${amount}`, updatedAt: now },
          setWhere: sql`${aiSpendTotal.committedMicroUsd} + ${amount} <= ${limit}`,
        })
        .returning({ committed: aiSpendTotal.committedMicroUsd })
      if (updated.length === 0) return null
      await tx.insert(aiSpendLedger).values({ id, kind, model, status: 'reserved', reservedMicroUsd: amount, createdAt: now })
      return id
    })
  }

  /** Replaces the reservation with the actual cost. */
  async settle(id: string, cost: number, usage: SpendUsage): Promise<void> {
    await this.finish(id, 'settled', cost, usage, null)
  }

  /** The request wasn't billed (an API error response): give the reservation back. */
  async release(id: string, note: string): Promise<void> {
    await this.finish(id, 'released', 0, null, note)
  }

  /** The cost is unknown: keep the whole worst-case reservation counted. */
  async keep(id: string, note: string): Promise<void> {
    await this.finish(id, 'settled', null, null, note)
  }

  private async finish(id: string, status: 'settled' | 'released', cost: number | null, usage: SpendUsage | null, note: string | null) {
    await this.db.transaction(async (tx) => {
      const [entry] = await tx
        .select()
        .from(aiSpendLedger)
        .where(and(eq(aiSpendLedger.id, id), eq(aiSpendLedger.status, 'reserved')))
        .for('update')
      if (!entry) return // already finished
      const final = cost ?? Number(entry.reservedMicroUsd)
      const delta = final - Number(entry.reservedMicroUsd)
      await tx
        .update(aiSpendLedger)
        .set({ status, costMicroUsd: final, inputTokens: usage?.inputTokens ?? null, outputTokens: usage?.outputTokens ?? null, note, settledAt: this.now() })
        .where(eq(aiSpendLedger.id, id))
      if (delta !== 0) {
        await tx
          .update(aiSpendTotal)
          .set({ committedMicroUsd: sql`greatest(0, ${aiSpendTotal.committedMicroUsd} + ${delta})`, updatedAt: this.now() })
          .where(eq(aiSpendTotal.key, this.key))
      }
    })
  }
}
