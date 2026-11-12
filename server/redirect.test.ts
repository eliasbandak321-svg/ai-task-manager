import { describe, expect, it } from 'vitest'
import { isSafeRedirect } from './app'

const TRUSTED = ['http://localhost:5173', 'http://127.0.0.1:5173']

describe('isSafeRedirect', () => {
  it.each(['/app', '/reset-password', '/email-verified?x=1', 'http://localhost:5173/reset-password', 'http://127.0.0.1:5173/app'])(
    'allows %s',
    (target) => expect(isSafeRedirect(target, TRUSTED)).toBe(true),
  )

  it.each([
    'https://evil.example/steal',
    '//evil.example/steal',
    '/\\evil.example',
    'http://localhost:5174/app',
    'https://localhost:5173/app',
    'javascript:alert(1)',
    'data:text/html,hi',
    'not a url',
  ])('blocks %s', (target) => expect(isSafeRedirect(target, TRUSTED)).toBe(false))
})
