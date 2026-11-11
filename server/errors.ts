import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { z } from 'zod'
import { isDomainError, type DomainErrorCode } from '../src/domain'

/*
  One error format for every API response:

    { "error": { "code": "NOT_FOUND", "message": "Task not found", "issues"?: [...] } }

  `code` is stable and machine-readable (the HTTP repository turns it back into a
  DomainError); `message` is written for people. Unexpected errors never reveal details.
*/

export type ApiErrorCode =
  | DomainErrorCode
  | 'VALIDATION_ERROR'
  | 'INVALID_JSON'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN_ORIGIN'
  | 'INTERNAL_ERROR'

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string; issues?: { path: string; message: string }[] }
}

/**
 * Rule violations: "not found" (including another user's data) is 404; a conflict with the
 * current state is 409; a request that can never succeed as sent is 400.
 */
export const DOMAIN_ERROR_STATUS: Record<DomainErrorCode, ContentfulStatusCode> = {
  NOT_FOUND: 404,
  OWNERSHIP_MISMATCH: 404,
  INBOX_PROTECTED: 409,
  DUPLICATE_PROJECT_NAME: 409,
  SUBTASK_LIMIT_REACHED: 409,
  RESERVED_PROJECT_NAME: 400,
  INVALID_SUBTASK_ORDER: 400,
}

export class ApiError extends Error {
  readonly status: ContentfulStatusCode
  readonly code: ApiErrorCode

  constructor(status: ContentfulStatusCode, code: ApiErrorCode, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export function errorBody(code: ApiErrorCode, message: string, issues?: ApiErrorBody['error']['issues']): ApiErrorBody {
  return { error: issues ? { code, message, issues } : { code, message } }
}

/** Turns any thrown value into a status and a safe response body. */
export function toErrorResponse(error: unknown): { status: ContentfulStatusCode; body: ApiErrorBody } {
  if (error instanceof ApiError) {
    return { status: error.status, body: errorBody(error.code, error.message) }
  }
  if (isDomainError(error)) {
    return { status: DOMAIN_ERROR_STATUS[error.code], body: errorBody(error.code, error.message) }
  }
  if (error instanceof z.ZodError) {
    const issues = error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
    return { status: 400, body: errorBody('VALIDATION_ERROR', issues[0]?.message ?? 'Invalid request', issues) }
  }
  return { status: 500, body: errorBody('INTERNAL_ERROR', 'Something went wrong on the server. Please try again.') }
}
