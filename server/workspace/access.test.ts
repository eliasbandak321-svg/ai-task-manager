import { describe, expect, it } from 'vitest'
import type { Task, TaskEffort } from '../../src/domain'
import { BERLIN_PREFS, testApi } from '../test/apiClient'
import { createTestUser, setupTestDatabase } from '../test/testDatabase'

/*
  Final M9 access sweep: every new endpoint needs a session, and per-user data never leaks
  between users.
*/

const database = setupTestDatabase()
const ID = '00000000-0000-4000-8000-000000000123'

const ENDPOINTS: [string, string, unknown?][] = [
  ['GET', '/api/preferences'],
  ['PUT', '/api/preferences', BERLIN_PREFS],
  ['GET', '/api/calendar/events?from=2026-03-01T00:00:00.000Z&to=2026-03-08T00:00:00.000Z'],
  ['POST', '/api/calendar/events', {}],
  ['GET', `/api/calendar/events/${ID}`],
  ['PATCH', `/api/calendar/events/${ID}`, { changes: { title: 'x' } }],
  ['DELETE', `/api/calendar/events/${ID}`],
  ['GET', '/api/dependencies'],
  ['PUT', `/api/tasks/${ID}/dependencies`, { dependsOn: [] }],
  ['GET', '/api/effort'],
  ['POST', '/api/schedule/proposals', { from: '2026-03-02', to: '2026-03-06' }],
  ['GET', '/api/proposals'],
  ['GET', `/api/proposals/${ID}`],
  ['POST', `/api/proposals/${ID}/apply`, {}],
  ['POST', `/api/proposals/${ID}/reject`, {}],
  ['GET', '/api/insights'],
  ['GET', '/api/ai/status'],
  ['POST', '/api/ai/chat', { message: 'hi' }],
  ['GET', '/api/ai/conversations'],
  ['GET', `/api/ai/conversations/${ID}/messages`],
  ['DELETE', `/api/ai/conversations/${ID}`],
  ['POST', '/api/ai/plan', { goal: 'x' }],
  ['POST', `/api/ai/tasks/${ID}/assist`, { kind: 'explain' }],
]

describe('M9 endpoints', () => {
  it.each(ENDPOINTS)('%s %s requires a signed-in user', async (method, path, body) => {
    const call = testApi(database())
    const response = await call(null, method, path, body)
    expect(response.status).toBe(401)
  })

  it("never reveal another user's effort or dependencies", async () => {
    const call = testApi(database())
    const alice = await createTestUser(database())
    const bob = await createTestUser(database())
    const [inbox] = (await call(alice, 'GET', '/api/projects')).body
    const a = (await call<Task>(alice, 'POST', '/api/tasks', { projectId: inbox.id, title: 'A', estimatedMinutes: 60 })).body
    const b = (await call<Task>(alice, 'POST', '/api/tasks', { projectId: inbox.id, title: 'B' })).body
    await call(alice, 'PUT', `/api/tasks/${b.id}/dependencies`, { dependsOn: [a.id] })

    expect(Object.keys((await call<Record<string, TaskEffort>>(alice, 'GET', '/api/effort')).body)).toEqual(expect.arrayContaining([a.id, b.id]))
    expect((await call<Record<string, TaskEffort>>(bob, 'GET', '/api/effort')).body).toEqual({})
    expect((await call(bob, 'GET', '/api/dependencies')).body).toEqual([])
    expect((await call(bob, 'PUT', `/api/tasks/${b.id}/dependencies`, { dependsOn: [] })).status).toBe(404)
  })
})
