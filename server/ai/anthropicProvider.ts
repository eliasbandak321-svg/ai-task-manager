import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { z } from 'zod'
import {
  assistantTurnSchema,
  projectPlanSchema,
  sanitizeForContext,
  taskAssistResultSchema,
  type AssistantTurn,
  type ProjectPlan,
  type TaskAssistResult,
} from '../../src/domain'
import {
  assistantSystemPrompt,
  assistantUserContent,
  planSystemPrompt,
  planUserContent,
  taskAssistSystemPrompt,
  taskAssistUserContent,
} from './prompts'
import { AiError, type AiProvider, type AssistantRequest, type PlanProviderRequest, type ProviderResult, type TaskAssistRequest } from './provider'

/*
  Claude through the official Anthropic SDK (server-side only; the key never reaches the
  browser). Only used when AI_PROVIDER=anthropic — which costs money per request and is off
  until the developer approves it.

  - Structured output: the response must match a Zod schema (messages.parse), and is
    validated again with the full domain schema (including rules JSON Schema can't express).
  - Bounded: output token caps per request type, a timeout, and limited retries (the SDK
    retries connection errors, 429 and 5xx with backoff).
  - Failures become AiError with a code; details are never shown to users or logged with
    request content.
*/

/** The part of the SDK client this provider uses (so tests can pass a fake). */
export interface MessagesClient {
  messages: Pick<Anthropic['messages'], 'parse'>
}

/**
 * Output caps per request type. Haiku 5.5 thinks before answering and thinking counts toward
 * max_tokens, so they leave room for it; at effort "low" it thinks little or not at all.
 */
export const MAX_TOKENS = { assistant: 2000, plan: 8000, assist: 2000 } as const
export type AiEffort = 'low' | 'medium' | 'high'

export interface AnthropicProviderOptions {
  apiKey: string
  model: string
  timeoutMs: number
  effort?: AiEffort
  /** Injected in tests; by default the real SDK client. */
  client?: MessagesClient
}

export class AnthropicProvider implements AiProvider {
  readonly name = 'anthropic' as const
  readonly model: string
  private readonly effort: AiEffort
  private readonly client: MessagesClient

  constructor({ apiKey, model, timeoutMs, effort = 'low', client }: AnthropicProviderOptions) {
    this.model = model
    this.effort = effort
    this.client = client ?? new Anthropic({ apiKey, timeout: timeoutMs, maxRetries: 2 })
  }

  private async call<S extends z.ZodType>(
    schema: S,
    system: string,
    messages: { role: 'user' | 'assistant'; content: string }[],
    maxTokens: number,
  ): Promise<ProviderResult<z.output<S>>> {
    let response
    try {
      response = await this.client.messages.parse({
        model: this.model,
        max_tokens: maxTokens,
        system,
        messages,
        output_config: { format: zodOutputFormat(schema), effort: this.effort },
      })
    } catch (error) {
      throw toAiError(error)
    }
    if (response.stop_reason === 'refusal') throw new AiError('refused', 'The AI declined this request.')
    if (response.stop_reason === 'max_tokens') throw new AiError('invalid_output', 'The AI response was too long and was cut off.')
    const parsed = schema.safeParse(response.parsed_output)
    if (!parsed.success) throw new AiError('invalid_output', 'The AI returned a response in an unexpected format.')
    return {
      output: parsed.data,
      usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
    }
  }

  assistantTurn(request: AssistantRequest): Promise<ProviderResult<AssistantTurn>> {
    const history = request.history.map((message) => ({ role: message.role, content: sanitizeForContext(message.content, 2000) }))
    return this.call(
      assistantTurnSchema,
      assistantSystemPrompt(request.useCase),
      [...history, { role: 'user', content: assistantUserContent(request) }],
      MAX_TOKENS.assistant,
    )
  }

  projectPlan(request: PlanProviderRequest): Promise<ProviderResult<ProjectPlan>> {
    return this.call(projectPlanSchema, planSystemPrompt(request.useCase), [{ role: 'user', content: planUserContent(request) }], MAX_TOKENS.plan)
  }

  taskAssist(request: TaskAssistRequest): Promise<ProviderResult<TaskAssistResult>> {
    return this.call(
      taskAssistResultSchema,
      taskAssistSystemPrompt(request.useCase),
      [{ role: 'user', content: taskAssistUserContent(request) }],
      MAX_TOKENS.assist,
    )
  }
}

/** Maps SDK errors to safe codes (most specific first). */
export function toAiError(error: unknown): AiError {
  if (error instanceof AiError) return error
  if (error instanceof Anthropic.APIConnectionTimeoutError) return new AiError('timeout', 'The AI took too long to respond.', { cause: error })
  if (error instanceof Anthropic.RateLimitError) return new AiError('rate_limited', 'The AI service is busy.', { cause: error })
  if (error instanceof Anthropic.APIError) return new AiError('unavailable', 'The AI service is unavailable.', { cause: error })
  // A response that failed the SDK's own schema parsing.
  return new AiError('invalid_output', 'The AI returned a response in an unexpected format.', { cause: error })
}
