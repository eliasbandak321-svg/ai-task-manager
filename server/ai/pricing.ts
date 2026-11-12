/*
  Claude API prices (USD per million tokens), from the official pricing page, checked
  2026-11-12: https://platform.claude.com/docs/en/about-claude/pricing
  Thinking tokens are billed as output tokens. Used for the app's spending cap; the Anthropic
  Console remains the source of truth for what was actually billed.
*/

export interface ModelPrice {
  inputPerMTok: number
  outputPerMTok: number
  /** Haiku 5.5 has a higher rate card for prompts over 100K tokens. */
  longPrompt?: { thresholdTokens: number; inputPerMTok: number; outputPerMTok: number }
}

export const MODEL_PRICES: Record<string, ModelPrice> = {
  'claude-haiku-5-5': { inputPerMTok: 0.1, outputPerMTok: 0.5, longPrompt: { thresholdTokens: 100_000, inputPerMTok: 0.5, outputPerMTok: 2.5 } },
  'claude-sonnet-5-5': { inputPerMTok: 2, outputPerMTok: 10 },
  'claude-opus-5-5': { inputPerMTok: 4, outputPerMTok: 20 },
}

/**
 * Cost in millionths of a dollar ("micro-dollars"): integers avoid rounding drift when summed.
 * One token at $1 per million tokens costs exactly one micro-dollar.
 */
export function costMicroUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = MODEL_PRICES[model]
  if (!price) throw new Error(`No price known for model ${model}`)
  const rate = price.longPrompt && inputTokens > price.longPrompt.thresholdTokens ? price.longPrompt : price
  return Math.ceil(inputTokens * rate.inputPerMTok + outputTokens * rate.outputPerMTok)
}

/** A generous upper bound of input tokens for a prompt (about 3 characters per token). */
export function estimateInputTokens(...texts: readonly string[]): number {
  return Math.ceil(texts.reduce((sum, text) => sum + text.length, 0) / 3) + 200
}

export function formatUsd(microUsd: number): string {
  return `$${(microUsd / 1_000_000).toFixed(4)}`
}
