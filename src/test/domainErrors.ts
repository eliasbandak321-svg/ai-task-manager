import { DomainError, type DomainErrorCode } from '../domain/errors'

/** Runs `fn`, expecting it to throw a DomainError, and returns the error's code. */
export function errorCode(fn: () => unknown): DomainErrorCode {
  try {
    fn()
  } catch (error) {
    if (error instanceof DomainError) return error.code
    throw error
  }
  throw new Error('Expected a DomainError, but nothing was thrown')
}
