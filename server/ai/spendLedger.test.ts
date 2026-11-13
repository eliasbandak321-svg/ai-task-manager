import { randomUUID } from 'node:crypto'
import { eq, inArray } from 'drizzle-orm'
import { beforeEach, describe, expect, it } from 'vitest'
import type { AssistantTurn } from '../../src/domain'
import { aiSpendLedger, users } from '../db/schema'
import { BERLIN_PREFS, testApi } from '../test/apiClient'
import { createTestUser, setupTestDatabase } from '../test/testDatabase'
import { resetAiBurstLimits, type ChatResponse } from './aiService'
import { mockAssistantTurn, MockAiProvider } from './mockProvider'
import { AiError, type AiProvider, type AssistantRequest } from './provider'
import { SpendLedger } from './spendLedger'

/*
  The application-wide spending ledger. Every test uses its own budget key, so tests can't
  affect each other (or the real 'app' counter). All providers are fakes: no network, no cost.
*/

const database = setupTestDatabase()
beforeEach(() => resetAiBurstLimits())

const ledger = () => new SpendLedger(database(), { key: `test-${randomUUID()}` })

/** Behaves like the Claude API: reports usage (4,000 in / 1,000 out = $0.0009) or fails. */
class FakeClaude extends MockAiProvider implements AiProvider {
  override readonly name = 'anthropic' as never
  override readonly model = 'claude-haiku-5-5' as never
  calls = 0
  failure: AiError | null = null
  output: AssistantTurn | null = null
  delayMs = 0

  override async assistantTurn(request: AssistantRequest) {
    this.calls += 1
    if (this.delayMs) await new Promise((resolve) => setTimeout(resolve, this.delayMs))
    if (this.failure) throw this.failure
    return { output: this.output ?? mockAssistantTurn(request), usage: { inputTokens: 4000, outputTokens: 1000 } }
  }
}

/**
 * The worst-case reservation of one chat in these tests (measured, so the cap tests don't
 * depend on prompt length). Every test user has the same empty context, so it's stable.
 */
async function worstCaseOfChat(): Promise<number> {
  const { chat } = await setup(1_000_000)
  const since = new Date()
  await chat()
  const rows = await database().select().from(aiSpendLedger)
  const mine = rows.filter((row) => row.createdAt >= new Date(since.getTime() - 1000) && Number(row.costMicroUsd) === 900)
  return Number(mine[mine.length - 1].reservedMicroUsd)
}

async function setup(budgetMicroUsd: number) {
  const provider = new FakeClaude()
  const spend = ledger()
  const call = testApi(database(), { ai: { provider, dailyRequestLimit: 50, budgetMicroUsd, ledger: spend } })
  const user = await createTestUser(database())
  await call(user, 'PUT', '/api/preferences', BERLIN_PREFS)
  const chat = (as = user) => call<ChatResponse>(as, 'POST', '/api/ai/chat', { message: 'What should I focus on?' })
  return { call, user, provider, spend, chat }
}

describe('SpendLedger', () => {
  it('reserves, settles to the actual cost, releases, and keeps the worst case when the cost is unknown', async () => {
    const spend = ledger()
    const a = await spend.reserve('assistant', 'claude-haiku-5-5', 1500, 10_000)
    expect(await spend.committed()).toBe(1500)
    await spend.settle(a as string, 900, { inputTokens: 4000, outputTokens: 1000 })
    expect(await spend.committed()).toBe(900)

    const b = await spend.reserve('assistant', 'claude-haiku-5-5', 1500, 10_000)
    await spend.release(b as string, 'unavailable')
    expect(await spend.committed()).toBe(900)

    const c = await spend.reserve('plan', 'claude-haiku-5-5', 4500, 10_000)
    await spend.keep(c as string, 'timeout')
    expect(await spend.committed()).toBe(5400)

    // Finishing an entry twice changes nothing.
    await spend.settle(a as string, 1, { inputTokens: 1, outputTokens: 1 })
    expect(await spend.committed()).toBe(5400)

    const rows = await database().select().from(aiSpendLedger).where(inArray(aiSpendLedger.id, [a, b, c] as string[]))
    expect(Object.fromEntries(rows.map((row) => [row.id, [row.status, Number(row.costMicroUsd), row.note]]))).toEqual({
      [a as string]: ['settled', 900, null],
      [b as string]: ['released', 0, 'unavailable'],
      [c as string]: ['settled', 4500, 'timeout'],
    })
  })

  it('refuses a reservation that would exceed the cap', async () => {
    const spend = ledger()
    expect(await spend.reserve('assistant', 'm', 6000, 10_000)).not.toBeNull()
    expect(await spend.reserve('assistant', 'm', 5000, 10_000)).toBeNull()
    expect(await spend.reserve('assistant', 'm', 20_000, 10_000)).toBeNull()
    expect(await spend.committed()).toBe(6000)
  })

  it('never lets simultaneous reservations exceed the cap', async () => {
    const spend = ledger()
    const results = await Promise.all(Array.from({ length: 50 }, () => spend.reserve('assistant', 'm', 1000, 10_000)))
    expect(results.filter((id) => id !== null)).toHaveLength(10)
    expect(await spend.committed()).toBe(10_000)
  })
})

describe('the spending cap in the AI service', () => {
  it('is application-wide: one user’s spending counts for everyone', async () => {
    // Room for one request's worst case; after it settles ($0.0009) a second worst case doesn't fit.
    const worst = await worstCaseOfChat()
    const { chat, provider, call } = await setup(worst + 899)
    const other = await createTestUser(database())
    await call(other, 'PUT', '/api/preferences', BERLIN_PREFS)
    expect((await chat()).body.message.source).toBe('anthropic')
    expect((await chat(other)).body.message.source).toBe('mock')
    expect(provider.calls).toBe(1)
  })

  it('keeps spending history when the user account is deleted', async () => {
    const { chat, user, spend } = await setup(1_000_000)
    await chat()
    const before = await spend.committed()
    expect(before).toBe(900)
    await database().delete(users).where(eq(users.id, user))
    expect(await spend.committed()).toBe(before)
    const rows = await database().select().from(aiSpendLedger).where(eq(aiSpendLedger.costMicroUsd, 900))
    expect(rows.length).toBeGreaterThan(0)
  })

  it('lets only as many simultaneous requests through as the cap allows', async () => {
    // The cap fits exactly two worst-case reservations at the same time.
    const worst = await worstCaseOfChat()
    const { chat, provider, spend } = await setup(2 * worst + 1)
    provider.delayMs = 400 // every request reserves before any of them settles
    const responses = await Promise.all(Array.from({ length: 6 }, () => chat()))
    const sources = responses.map((response) => response.body.message.source)
    expect(sources.filter((source) => source === 'anthropic')).toHaveLength(2)
    expect(sources.filter((source) => source === 'mock')).toHaveLength(4)
    expect(provider.calls).toBe(2)
    expect(await spend.committed()).toBe(1800) // settled to the actual cost of the two
  })

  it('charges billed failures, releases unbilled ones, keeps the worst case for timeouts', async () => {
    const { chat, provider, spend } = await setup(1_000_000)

    // Invalid output: the model answered, so it was billed; the user gets an error.
    provider.failure = new AiError('invalid_output', 'bad', { usage: { inputTokens: 2000, outputTokens: 500 } })
    expect((await chat()).status).toBe(502)
    expect(await spend.committed()).toBe(450)

    // Outage: an API error response isn't billed; Demo AI answers, labelled.
    provider.failure = new AiError('unavailable', 'down')
    const outage = await chat()
    expect(outage.body.message.source).toBe('mock')
    expect(await spend.committed()).toBe(450)

    // Timeout: the request may have run, so the worst case stays counted.
    provider.failure = new AiError('timeout', 'slow')
    const timeout = await chat()
    expect(timeout.body.message.source).toBe('mock')
    expect(await spend.committed()).toBeGreaterThan(450)
  })

  it('reports app-wide spending in the status', async () => {
    const { chat, call, user } = await setup(1_000_000)
    await chat()
    const status = await call(user, 'GET', '/api/ai/status')
    expect(status.body.budget).toEqual({ limitUsd: 1, spentUsd: 0.0009, exhausted: false })
  })
})
