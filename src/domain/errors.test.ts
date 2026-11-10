import { describe, expect, it } from 'vitest'
import { DomainError, isDomainError } from './errors'

describe('isDomainError', () => {
  const error = new DomainError('NOT_FOUND', 'Project not found')

  it('recognises domain errors, optionally by code', () => {
    expect(isDomainError(error)).toBe(true)
    expect(isDomainError(error, 'NOT_FOUND')).toBe(true)
    expect(isDomainError(error, 'INBOX_PROTECTED')).toBe(false)
  })

  it('rejects other errors and non-errors', () => {
    expect(isDomainError(new Error('boom'))).toBe(false)
    expect(isDomainError('NOT_FOUND')).toBe(false)
    expect(isDomainError(undefined)).toBe(false)
  })

  it('keeps a readable name and message for logs', () => {
    expect(error.name).toBe('DomainError')
    expect(error.message).toBe('Project not found')
    expect(error).toBeInstanceOf(Error)
  })
})
