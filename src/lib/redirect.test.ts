import { describe, expect, it } from 'vitest'
import { loginPathFor, safeNextPath } from './redirect'

describe('safeNextPath', () => {
  it('accepts paths inside the app', () => {
    expect(safeNextPath('/app')).toBe('/app')
    expect(safeNextPath('/app/projects/123')).toBe('/app/projects/123')
    expect(safeNextPath('/app?q=report')).toBe('/app?q=report')
  })

  it.each([
    null,
    '',
    'https://evil.example/app',
    '//evil.example/app',
    '/app//evil.example',
    '/\\evil.example',
    '/app\\..\\evil',
    '/login',
    '/application',
    'javascript:alert(1)',
  ])('falls back to /app for %s', (next) => {
    expect(safeNextPath(next)).toBe('/app')
  })
})

describe('loginPathFor', () => {
  it('remembers where to return to', () => {
    expect(loginPathFor('/app/projects/1?q=x')).toBe('/login?next=%2Fapp%2Fprojects%2F1%3Fq%3Dx')
    expect(loginPathFor('/app')).toBe('/login')
  })
})
