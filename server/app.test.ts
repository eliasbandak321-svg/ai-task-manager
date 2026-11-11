import { describe, expect, it, vi } from 'vitest'
import { createApp } from './app'
import type { ResolveUserId } from './auth'
import { createTestUser, setupTestDatabase } from './test/testDatabase'

const database = setupTestDatabase()

/**
 * The app under test. Tests choose the current user with an "X-Test-User" header; that header
 * exists only in this test resolver. The real app never reads a user id from the request.
 */
function testApp(resolveUserId: ResolveUserId = async (c) => c.req.header('x-test-user') ?? null) {
  return createApp({ db: database(), resolveUserId, trustedOrigins: ['http://localhost:5173'] })
}

type Json = Record<string, unknown>

/** Sends a request as `userId` and returns the status and parsed JSON body. */
async function call(
  app: ReturnType<typeof testApp>,
  userId: string | null,
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
) {
  const response = await app.request(path, {
    method,
    headers: {
      ...(userId ? { 'X-Test-User': userId } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  })
  const text = await response.text()
  return { status: response.status, body: (text ? JSON.parse(text) : null) as Json & Json[], headers: response.headers }
}

describe('API basics', () => {
  it('answers the health check without a user', async () => {
    const result = await call(testApp(async () => null), null, 'GET', '/api/health')
    expect(result).toMatchObject({ status: 200, body: { status: 'ok' } })
  })

  it('requires a user for everything else', async () => {
    const result = await call(testApp(async () => null), null, 'GET', '/api/projects')
    expect(result.status).toBe(401)
    expect(result.body).toEqual({ error: { code: 'UNAUTHENTICATED', message: 'Please sign in to continue.' } })
  })

  it('returns the user’s projects, starting with the Inbox', async () => {
    const user = await createTestUser(database())
    const result = await call(testApp(), user, 'GET', '/api/projects')
    expect(result.status).toBe(200)
    expect(result.body).toEqual([expect.objectContaining({ name: 'Inbox', isInbox: true, userId: user })])
  })

  it('sends security headers and forbids caching private data', async () => {
    const user = await createTestUser(database())
    const { headers } = await call(testApp(), user, 'GET', '/api/tasks')
    expect(headers.get('cache-control')).toBe('no-store')
    expect(headers.get('x-content-type-options')).toBe('nosniff')
    expect(headers.get('x-frame-options')).toBe('SAMEORIGIN')
  })

  it('answers unknown routes with a JSON 404', async () => {
    const user = await createTestUser(database())
    expect(await call(testApp(), user, 'GET', '/api/nope')).toMatchObject({
      status: 404,
      body: { error: { code: 'NOT_FOUND' } },
    })
  })
})

describe('API input handling', () => {
  it('creates resources with 201 and deletes them with 204', async () => {
    const user = await createTestUser(database())
    const app = testApp()
    const created = await call(app, user, 'POST', '/api/projects', { name: '  Work ' })
    expect(created).toMatchObject({ status: 201, body: { name: 'Work', userId: user } })
    expect((await call(app, user, 'DELETE', `/api/projects/${created.body.id}`)).status).toBe(204)
  })

  it('rejects invalid input with 400 and explains each problem', async () => {
    const user = await createTestUser(database())
    const result = await call(testApp(), user, 'POST', '/api/projects', { name: '' })
    expect(result.status).toBe(400)
    expect(result.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Project name is required',
        issues: [{ path: 'name', message: 'Project name is required' }],
      },
    })
  })

  it('rejects server-owned fields such as userId (mass assignment)', async () => {
    const alice = await createTestUser(database())
    const bob = await createTestUser(database())
    const app = testApp()
    const [inbox] = (await call(app, alice, 'GET', '/api/projects')).body
    const result = await call(app, alice, 'POST', '/api/tasks', { projectId: inbox.id, title: 'A', userId: bob })
    expect(result.status).toBe(400)
    expect(result.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } })
    expect((await call(app, bob, 'GET', '/api/tasks')).body).toEqual([])
  })

  it('rejects malformed JSON, other content types and oversized bodies', async () => {
    const user = await createTestUser(database())
    const app = testApp()
    expect(await call(app, user, 'POST', '/api/projects', '{"name":')).toMatchObject({
      status: 400,
      body: { error: { code: 'INVALID_JSON' } },
    })
    expect(
      await call(app, user, 'POST', '/api/projects', 'name=Work', { 'Content-Type': 'application/x-www-form-urlencoded' }),
    ).toMatchObject({ status: 415, body: { error: { code: 'UNSUPPORTED_MEDIA_TYPE' } } })
    expect(await call(app, user, 'POST', '/api/projects', { name: 'x'.repeat(70_000) })).toMatchObject({
      status: 413,
      body: { error: { code: 'PAYLOAD_TOO_LARGE' } },
    })
  })

  it('maps rule violations to 404, 409 and 400', async () => {
    const user = await createTestUser(database())
    const app = testApp()
    const [inbox] = (await call(app, user, 'GET', '/api/projects')).body
    await call(app, user, 'POST', '/api/projects', { name: 'Work' })

    const expectError = async (result: Promise<{ status: number; body: Json }>, status: number, code: string) =>
      expect(await result).toMatchObject({ status, body: { error: { code } } })

    await expectError(call(app, user, 'PATCH', '/api/tasks/not-a-uuid', { title: 'A' }), 404, 'NOT_FOUND')
    await expectError(call(app, user, 'POST', '/api/projects', { name: 'WORK' }), 409, 'DUPLICATE_PROJECT_NAME')
    await expectError(call(app, user, 'DELETE', `/api/projects/${inbox.id}`), 409, 'INBOX_PROTECTED')
    await expectError(call(app, user, 'POST', '/api/projects', { name: 'inbox' }), 400, 'RESERVED_PROJECT_NAME')

    const task = (await call(app, user, 'POST', '/api/tasks', { projectId: inbox.id, title: 'A' })).body
    await expectError(
      call(app, user, 'PUT', `/api/tasks/${task.id}/subtasks/order`, { orderedIds: ['x'] }),
      400,
      'INVALID_SUBTASK_ORDER',
    )
  })

  it('hides the details of unexpected errors', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const app = testApp(async () => {
      throw new Error('connection to db.internal:5432 failed (password=secret)')
    })
    const result = await call(app, null, 'GET', '/api/projects')

    expect(result.status).toBe(500)
    expect(result.body).toEqual({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on the server. Please try again.' },
    })
    expect(consoleError).toHaveBeenCalled() // logged on the server, not sent to the client
    consoleError.mockRestore()
  })
})

describe('API user isolation', () => {
  /** Alice owns a project, a task in it, and a subtask; Bob is another user. */
  async function aliceAndBob() {
    const app = testApp()
    const alice = await createTestUser(database())
    const bob = await createTestUser(database())
    const project = (await call(app, alice, 'POST', '/api/projects', { name: 'Secret plans' })).body
    const task = (await call(app, alice, 'POST', '/api/tasks', { projectId: project.id, title: 'Secret task' })).body
    const subtask = (await call(app, alice, 'POST', `/api/tasks/${task.id}/subtasks`, { title: 'Secret step' })).body
    return { app, alice, bob, project, task, subtask }
  }

  it('never lists another user’s projects, tasks or subtasks', async () => {
    const { app, bob } = await aliceAndBob()
    const projects = (await call(app, bob, 'GET', '/api/projects')).body
    expect(projects.map((project: Json) => project.name)).toEqual(['Inbox'])
    expect((await call(app, bob, 'GET', '/api/tasks')).body).toEqual([])
    expect((await call(app, bob, 'GET', '/api/subtasks')).body).toEqual([])
  })

  it('answers 404 to every attempt to change another user’s data, and changes nothing', async () => {
    const { app, alice, bob, project, task, subtask } = await aliceAndBob()
    const [bobInbox] = (await call(app, bob, 'GET', '/api/projects')).body
    const bobTask = (await call(app, bob, 'POST', '/api/tasks', { projectId: bobInbox.id, title: 'Mine' })).body

    const attempts: [string, string, unknown?][] = [
      ['PATCH', `/api/projects/${project.id}`, { name: 'Hacked' }],
      ['DELETE', `/api/projects/${project.id}`],
      ['POST', '/api/tasks', { projectId: project.id, title: 'Planted' }],
      ['PATCH', `/api/tasks/${task.id}`, { title: 'Hacked' }],
      ['DELETE', `/api/tasks/${task.id}`],
      ['PATCH', `/api/tasks/${bobTask.id}`, { projectId: project.id }],
      ['POST', `/api/tasks/${task.id}/subtasks`, { title: 'Planted' }],
      ['PUT', `/api/tasks/${task.id}/subtasks/order`, { orderedIds: [subtask.id] }],
      ['PATCH', `/api/subtasks/${subtask.id}`, { done: true }],
      ['DELETE', `/api/subtasks/${subtask.id}`],
    ]
    for (const [method, path, body] of attempts) {
      const result = await call(app, bob, method, path, body)
      expect({ method, path, status: result.status, code: result.body?.error }).toMatchObject({
        status: 404,
        code: { code: 'NOT_FOUND' },
      })
    }

    // Alice's data is exactly as she left it.
    expect((await call(app, alice, 'GET', '/api/projects')).body.map((p: Json) => p.name)).toEqual(['Inbox', 'Secret plans'])
    expect((await call(app, alice, 'GET', '/api/tasks')).body).toEqual([task])
    expect((await call(app, alice, 'GET', '/api/subtasks')).body).toEqual([subtask])
  })
})
