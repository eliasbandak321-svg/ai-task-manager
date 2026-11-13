import { createApp } from '../app'
import type { AiSettings } from '../ai/aiService'
import type { Database } from '../db/client'

/*
  Test client for the API. The current user is chosen with an "X-Test-User" header that only
  this test resolver reads; the real app takes the user from the session cookie.
*/

export interface TestApiOptions {
  now?: () => Date
  ai?: AiSettings
}

type Json = Record<string, unknown>
/** Loose JSON for assertions; tests pass a precise type where they read nested fields. */
export type JsonBody = Json & Json[]

export type TestApi = ReturnType<typeof testApi>

export function testApi(db: Database, { now, ai }: TestApiOptions = {}) {
  const app = createApp({
    db,
    resolveUserId: async (c) => c.req.header('x-test-user') ?? null,
    trustedOrigins: ['http://localhost:5173'],
    now,
    ai,
  })
  return async function call<T = JsonBody>(user: string | null, method: string, path: string, body?: unknown) {
    const response = await app.request(path, {
      method,
      headers: {
        ...(user ? { 'X-Test-User': user } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await response.text()
    return { status: response.status, body: (text ? JSON.parse(text) : null) as T }
  }
}

/** A clock tests can move. */
export function testClock(start: string) {
  let current = new Date(start).getTime()
  return {
    now: () => new Date(current),
    set: (instant: string) => {
      current = new Date(instant).getTime()
    },
    advanceMinutes: (minutes: number) => {
      current += minutes * 60_000
    },
  }
}

export const BERLIN_PREFS = {
  timeZone: 'Europe/Berlin',
  useCase: 'student',
  workDays: [1, 2, 3, 4, 5],
  dayStartMinutes: 9 * 60,
  dayEndMinutes: 17 * 60,
  focusPeriod: 'none',
  sessionMinutes: 60,
  breakMinutes: 0,
  maxDailyMinutes: 360,
} as const
