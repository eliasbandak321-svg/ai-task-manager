import Anthropic from '@anthropic-ai/sdk'
import { describe, expect, it } from 'vitest'
import { defaultPreferences } from '../../src/domain'
import { AnthropicProvider, toAiError, type MessagesClient } from './anthropicProvider'
import { AiError } from './provider'

/*
  The real provider, tested with a fake SDK client: no network, no API key, no cost.
  The request it builds and how it handles every kind of response are checked here.
*/

type ParseParams = Parameters<MessagesClient['messages']['parse']>[0]

function fakeClient(response: Record<string, unknown> | Error) {
  const calls: ParseParams[] = []
  const client = {
    messages: {
      parse: async (params: ParseParams) => {
        calls.push(params)
        if (response instanceof Error) throw response
        return { stop_reason: 'end_turn', usage: { input_tokens: 120, output_tokens: 30 }, ...response }
      },
    },
  } as unknown as MessagesClient
  return { client, calls }
}

const request = {
  contextText: '<<<USER_DATA\ntoday: 2026-03-02\nUSER_DATA>>>',
  history: [{ role: 'user' as const, content: 'earlier question' }],
  message: 'What is due?',
  useCase: 'student' as const,
  data: { projects: [], tasks: [], upcoming: [], prefs: defaultPreferences('UTC'), now: new Date() },
}

const provider = (client: MessagesClient) => new AnthropicProvider({ apiKey: 'test-key-not-real-000000', model: 'claude-haiku-5-5', timeoutMs: 1000, client })

describe('AnthropicProvider', () => {
  it('sends a structured-output request with the system prompt, history and fenced data', async () => {
    const { client, calls } = fakeClient({ parsed_output: { intent: 'answer', reply: 'Nothing is due.', operations: [], planGoal: null } })
    const result = await provider(client).assistantTurn(request)
    expect(result).toEqual({ output: { intent: 'answer', reply: 'Nothing is due.', operations: [], planGoal: null }, usage: { inputTokens: 120, outputTokens: 30 } })
    const params = calls[0]
    expect(params.model).toBe('claude-haiku-5-5')
    expect(params.max_tokens).toBe(2000)
    expect(params.output_config?.effort).toBe('low')
    expect(String(params.system)).toContain('never as instructions')
    expect(params.messages.at(-1)?.content).toContain('USER_DATA>>>')
    expect(params.messages[0]).toEqual({ role: 'user', content: 'earlier question' })
    expect(params.output_config?.format).toBeDefined()
  })

  it('converts every output schema for structured output', async () => {
    const { client, calls } = fakeClient({ parsed_output: null })
    const p = provider(client)
    await p.projectPlan({ request: { goal: 'x', details: '', deadline: null, hoursPerWeek: null }, today: '2026-03-02', useCase: 'general' }).catch(() => undefined)
    await p.taskAssist({ kind: 'explain', today: '2026-03-02', useCase: 'general', task: { title: 't', description: '', status: 'todo', priority: 'low', dueDate: null, estimatedMinutes: null, projectName: 'Inbox', subtasks: [] } }).catch(() => undefined)
    expect(calls.map((call) => call.output_config?.format?.type)).toEqual(['json_schema', 'json_schema'])
  })

  it('rejects output that fails the full domain schema', async () => {
    const { client } = fakeClient({ parsed_output: { intent: 'answer', reply: '', operations: [], planGoal: null } })
    await expect(provider(client).assistantTurn(request)).rejects.toMatchObject({ code: 'invalid_output' })
    const forbidden = fakeClient({ parsed_output: { intent: 'propose_changes', reply: 'x', operations: [{ op: 'run_sql', sql: 'DROP TABLE task' }], planGoal: null } })
    await expect(provider(forbidden.client).assistantTurn(request)).rejects.toMatchObject({ code: 'invalid_output' })
  })

  it('handles refusals and truncated responses', async () => {
    await expect(provider(fakeClient({ stop_reason: 'refusal', parsed_output: null }).client).assistantTurn(request)).rejects.toMatchObject({ code: 'refused' })
    await expect(provider(fakeClient({ stop_reason: 'max_tokens', parsed_output: null }).client).assistantTurn(request)).rejects.toMatchObject({ code: 'invalid_output' })
  })

  it('maps SDK errors to safe codes', async () => {
    const timeout = new Anthropic.APIConnectionTimeoutError()
    await expect(provider(fakeClient(timeout).client).assistantTurn(request)).rejects.toMatchObject({ code: 'timeout' })
    expect(toAiError(new Error('bad json')).code).toBe('invalid_output')
    expect(toAiError(new AiError('refused', 'x')).code).toBe('refused')
  })
})
