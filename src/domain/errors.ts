/**
 * Business-rule violations. Input *shape* errors are caught earlier by Zod; these are about
 * rules that depend on existing data (e.g. a duplicate project name).
 *
 * The `code` is stable and machine-readable, so the API can map it to an HTTP status
 * and the UI to a friendly message, without parsing error text.
 */
export type DomainErrorCode =
  | 'NOT_FOUND' // the referenced item doesn't exist *for this user* (maps to 404)
  | 'INBOX_PROTECTED' // the Inbox can't be renamed or deleted
  | 'DUPLICATE_PROJECT_NAME'
  | 'RESERVED_PROJECT_NAME'
  | 'OWNERSHIP_MISMATCH' // items from different users were combined: a bug or an attack
  | 'SUBTASK_LIMIT_REACHED'
  | 'INVALID_SUBTASK_ORDER'

export class DomainError extends Error {
  readonly code: DomainErrorCode

  constructor(code: DomainErrorCode, message: string) {
    super(message)
    this.name = 'DomainError'
    this.code = code
  }
}

/** True for a DomainError, optionally with a specific code. */
export function isDomainError(error: unknown, code?: DomainErrorCode): error is DomainError {
  return error instanceof DomainError && (code === undefined || error.code === code)
}
