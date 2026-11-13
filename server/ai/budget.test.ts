import { beforeEach, describe, expect, it } from 'vitest'
import type { AssistantTurn, PlanPayload, Proposal } from '../../src/domain'
import { BERLIN_PREFS, testApi, testClock } from '../test/apiClient'
import { createTestUser, setupTestDatabase } from '../test/testDatabase'
import { resetAiBurstLimits, type ChatResponse } from './aiService'
import { mockAssistantTurn, MockAiProvider } from './mockProvider'
import { costMicroUsd, estimateInputTokens } from './pricing'
import { AiError, type AiProvider, type AssistantRequest } from './provider'

/*
  The spending cap and the Demo AI fallback, with a fake "real" provider: it reports token
  usage like the Claude API would, but never makes a network request.
*/

const database = setupTestDatabase()
beforeEach(() => resetAiBurstLimits())

class FakeClaude extends MockAiProvider implements AiProvider {
  override readonly name = 'anthropic' as never
  override readonly model = 'claude-haiku-5-5' as never
  calls = 0
  failWith: AiError | null = null
  output: AssistantTurn | null = null

  override async assistantTurn(request: AssistantRequest) {
    this.calls += 1
    if (this.failWith) throw this.failWith
    return { output: this.output ?? mockAssistantTurn(request), usage: { inputTokens: 4000, outputTokens: 1000 } }
  }
}

async function setup(budgetMicroUsd: number) {
  const provider = new FakeClaude()
  const call = testApi(database(), { now: testClock('2026-03-02T07:00:00.000Z').now, ai: { provider, dailyRequestLimit: 50, budgetMicroUsd } })
  const user = await createTestUser(database())
  await call(user, 'PUT', '/api/preferences', BERLIN_PREFS)
  return { call, user, provider }
}

describe('pricing', () => {
  it('computes cost from the official per-million-token prices', () => {
    expect(costMicroUsd('claude-haiku-5-5', 4000, 1000)).toBe(900) // $0.0009
    expect(costMicroUsd('claude-haiku-5-5', 200_000, 1000)).toBe(102_500) // long-prompt rate card
    expect(costMicroUsd('claude-sonnet-5-5', 4000, 1000)).toBe(18_000)
    expect(() => costMicroUsd('unknown-model', 1, 1)).toThrow()
    expect(estimateInputTokens('x'.repeat(3000))).toBe(1200)
  })
})

describe('spending cap and fallback', () => {
  it('records the cost of each real request and reports it', async () => {
    const { call, user, provider } = await setup(1_000_000)
    const response = await call<ChatResponse>(user, 'POST', '/api/ai/chat', { message: 'What should I focus on?' })
    expect(response.body.message.source).toBe('anthropic')
    expect(provider.calls).toBe(1)
    // The cap is shared by every user: other test files' requests don't count here (fresh rows).
    const status = await call(user, 'GET', '/api/ai/status')
    expect(status.body).toMatchObject({ provider: 'anthropic', isDemo: false, budget: { limitUsd: 1, exhausted: false } })
    expect((status.body.budget as { spentUsd: number }).spentUsd).toBeGreaterThanOrEqual(0.0009)
  })

  it('switches to Demo AI, clearly labelled, when the next request might exceed the cap', async () => {
    // A budget below one worst-case request: the real provider is never called.
    const { call, user, provider } = await setup(1)
    const response = await call<ChatResponse>(user, 'POST', '/api/ai/chat', { message: 'What should I focus on?' })
    expect(response.status).toBe(200)
    expect(response.body.message.source).toBe('mock')
    expect(response.body.message.content).toContain('AI spending limit has been reached')
    expect(response.body.message.content).toContain('Demo AI')
    expect(provider.calls).toBe(0)

    const plan = await call<Proposal & { payload: PlanPayload }>(user, 'POST', '/api/ai/plan', { goal: 'Learn to cook' })
    expect(plan.body.source).toBe('mock')
  })

  it('falls back to Demo AI when the provider is unreachable, and reports invalid output as an error', async () => {
    const { call, user, provider } = await setup(1_000_000)
    provider.failWith = new AiError('unavailable', 'down')
    const fallback = await call<ChatResponse>(user, 'POST', '/api/ai/chat', { message: 'What should I focus on?' })
    expect(fallback.body.message).toMatchObject({ source: 'mock' })
    expect(fallback.body.message.content).toContain('could not be reached')

    provider.failWith = null
    provider.output = { intent: 'nonsense', reply: 'x', operations: [], planGoal: null } as unknown as AssistantTurn
    const invalid = await call(user, 'POST', '/api/ai/chat', { message: 'Hello there' })
    expect(invalid).toMatchObject({ status: 502, body: { error: { code: 'AI_INVALID_OUTPUT' } } })
  })
})
