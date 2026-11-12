import { z } from 'zod'
import { DomainError, type DomainErrorCode } from '../domain'
import { AuthRequiredError, RepositoryError } from './errors'

/*
  The JSON transport shared by the HTTP adapters (tasks and workspace):
  - same-origin requests, so the session cookie is sent automatically;
  - every response is validated with a Zod schema, so a client/server mismatch fails here;
  - API rule errors come back as DomainErrors with the same code; everything else becomes a
    RepositoryError with a message that is safe to show.
*/

const DOMAIN_ERROR_CODES = new Set<string>([
  'NOT_FOUND',
  'INBOX_PROTECTED',
  'DUPLICATE_PROJECT_NAME',
  'RESERVED_PROJECT_NAME',
  'OWNERSHIP_MISMATCH',
  'SUBTASK_LIMIT_REACHED',
  'INVALID_SUBTASK_ORDER',
  'INVALID_OCCURRENCE',
  'PROPOSAL_DECIDED',
  'PROPOSAL_EXPIRED',
  'PROPOSAL_STALE',
  'SCHEDULE_CONFLICT',
] satisfies DomainErrorCode[])

/** Server errors whose message is written for people (AI outages and invalid AI output). */
const FRIENDLY_SERVER_CODES = new Set(['AI_UNAVAILABLE', 'AI_INVALID_OUTPUT'])

const apiErrorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) })

export const MESSAGES = {
  offline: "Couldn't reach the server. Check your connection and try again.",
  server: 'Something went wrong on the server. Please try again.',
  unexpected: 'The server sent an unexpected response. Please reload the page.',
  unauthenticated: 'Please sign in to continue.',
} as const

export interface HttpTransportOptions {
  /** Where the API lives. Same origin by default. */
  baseUrl?: string
  /** Injected for tests (e.g. the Hono app's own request handler). */
  fetch?: typeof globalThis.fetch
}

export type Request = {
  (method: string, path: string, schema: null, body?: unknown): Promise<void>
  <T>(method: string, path: string, schema: z.ZodType<T>, body?: unknown): Promise<T>
}

export function createTransport({ baseUrl = '/api', fetch = (...args) => globalThis.fetch(...args) }: HttpTransportOptions = {}): Request {
  async function request<T>(method: string, path: string, schema: z.ZodType<T> | null, body?: unknown): Promise<T | undefined> {
    let response: Response
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: 'same-origin',
      })
    } catch (error) {
      throw new RepositoryError(MESSAGES.offline, { cause: error })
    }

    if (!response.ok) throw await toError(response)
    if (schema === null) return undefined

    let json: unknown
    try {
      json = await response.json()
    } catch (error) {
      throw new RepositoryError(MESSAGES.unexpected, { cause: error })
    }
    const parsed = schema.safeParse(json)
    if (!parsed.success) throw new RepositoryError(MESSAGES.unexpected, { cause: parsed.error })
    return parsed.data
  }
  return request as Request
}

async function toError(response: Response): Promise<Error> {
  const json: unknown = await response.json().catch(() => null)
  const parsed = apiErrorSchema.safeParse(json)
  const apiError = parsed.success ? parsed.data.error : null

  if (apiError && DOMAIN_ERROR_CODES.has(apiError.code)) {
    return new DomainError(apiError.code as DomainErrorCode, apiError.message)
  }
  if (response.status === 401) return new AuthRequiredError(MESSAGES.unauthenticated)
  // A 4xx message from our own API is written for people (e.g. a validation message).
  if (apiError && (response.status < 500 || FRIENDLY_SERVER_CODES.has(apiError.code))) return new RepositoryError(apiError.message)
  return new RepositoryError(MESSAGES.server, { cause: apiError ?? response.status })
}
