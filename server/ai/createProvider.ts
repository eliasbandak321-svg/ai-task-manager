import type { Env } from '../env'
import type { AiSettings } from './aiService'
import { AnthropicProvider } from './anthropicProvider'
import { MockAiProvider } from './mockProvider'

/**
 * The AI provider from the configuration. The mock is the default; the paid provider is only
 * created when AI_PROVIDER=anthropic is set explicitly (loadEnv refuses it in tests).
 */
export function aiSettingsFromEnv(env: Env): AiSettings {
  const provider =
    env.AI_PROVIDER === 'anthropic'
      ? new AnthropicProvider({
          apiKey: env.ANTHROPIC_API_KEY as string,
          model: env.AI_MODEL,
          timeoutMs: env.AI_TIMEOUT_MS,
          effort: env.AI_EFFORT,
        })
      : new MockAiProvider()
  return {
    provider,
    dailyRequestLimit: env.AI_DAILY_REQUEST_LIMIT,
    budgetMicroUsd: Math.round(env.AI_BUDGET_USD * 1_000_000),
  }
}

/** For startup logs: which provider and its limits, never the key. */
export function describeAi(env: Env): string {
  if (env.AI_PROVIDER !== 'anthropic') return 'demo provider (mock, offline, free)'
  const budget = env.AI_BUDGET_USD.toFixed(2)
  return [
    `Claude API (${env.AI_MODEL}, effort ${env.AI_EFFORT}): real requests that cost money.`,
    `Capped at USD ${budget} in total and ${env.AI_DAILY_REQUEST_LIMIT} requests per user per day; Demo AI is the fallback.`,
  ].join(' ')
}
