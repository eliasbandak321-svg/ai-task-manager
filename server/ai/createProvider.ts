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
      ? new AnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY as string, model: env.AI_MODEL, timeoutMs: env.AI_TIMEOUT_MS })
      : new MockAiProvider()
  return { provider, dailyRequestLimit: env.AI_DAILY_REQUEST_LIMIT }
}

/** For startup logs: which provider, never the key. */
export function describeAi(env: Env): string {
  return env.AI_PROVIDER === 'anthropic' ? `Claude API (${env.AI_MODEL}), real requests that cost money` : 'demo provider (mock, offline, free)'
}
