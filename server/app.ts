import { Hono, type Context } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { secureHeaders } from 'hono/secure-headers'
import { z } from 'zod'
import type { TaskRepository } from '../src/data/repository'
import type { ResolveUserId } from './auth'
import type { Database } from './db/client'
import { DbRepository } from './db/dbRepository'
import { ApiError, errorBody, toErrorResponse } from './errors'

/*
  The HTTP API (docs/architecture.md §5–6). Routes are deliberately thin:

    request → who is it? (resolveUserId) → repository scoped to that user → JSON

  Validation and business rules live in the repository and src/domain, so the API, the
  browser adapter and the tests all share one implementation of every rule.

  The app is plain code with no knowledge of where it runs: server/dev.ts serves it with
  Node locally; in M11 a Vercel Function mounts the same app.
*/

export interface AppOptions {
  db: Database
  resolveUserId: ResolveUserId
  /**
   * Origins allowed to send requests that change data (the app's own origin). Requests from
   * any other origin are refused before they reach a route: the CSRF check.
   */
  trustedOrigins: readonly string[]
  /** Handles /api/auth/* (Better Auth): sign-up, sign-in, sign-out, session. */
  authHandler?: (request: Request) => Promise<Response>
  /** Injected for tests; default to the real clock and random UUIDs. */
  now?: () => Date
  newId?: () => string
}

type AppEnv = { Variables: { repository: TaskRepository } }

/** Request bodies are small JSON objects; anything bigger is refused before parsing. */
const MAX_BODY_BYTES = 64 * 1024

const reorderBodySchema = z.strictObject({ orderedIds: z.array(z.string()) })

/**
 * Reads a JSON body. Requiring the JSON content type also means a plain HTML form on
 * another site can't send requests here (forms can't set it), a first CSRF safeguard.
 */
async function readJson(c: Context): Promise<unknown> {
  if (!/^application\/json\b/i.test(c.req.header('content-type') ?? '')) {
    throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Send the request body as JSON (Content-Type: application/json).')
  }
  try {
    return await c.req.json()
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'The request body is not valid JSON.')
  }
}

/**
 * The body as the repository's request type. It is *not* validated yet: the repository
 * parses it with the shared Zod schemas, and rejects anything else with a 400.
 */
async function requestBody<T>(c: Context): Promise<T> {
  return (await readJson(c)) as T
}

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * CSRF protection for cookie-based sessions, in layers:
 * 1. SameSite=Lax session cookies: browsers don't attach them to cross-site POST/PATCH/DELETE.
 * 2. This check: a state-changing request whose Origin isn't ours is refused (browsers always
 *    send Origin on such requests; Sec-Fetch-Site covers the rare case where it's missing).
 * 3. JSON-only bodies: an HTML form on another site can't send application/json.
 * Requests without Origin and Sec-Fetch-Site don't come from a browser (e.g. curl), so they
 * carry no victim's cookies.
 */
function isCrossOrigin(c: Context, trustedOrigins: readonly string[]): boolean {
  const origin = c.req.header('origin')
  if (origin) return !trustedOrigins.includes(origin)
  const site = c.req.header('sec-fetch-site')
  return site !== undefined && site !== 'same-origin' && site !== 'none'
}

export function createApp({ db, resolveUserId, trustedOrigins, authHandler, now, newId }: AppOptions) {
  const app = new Hono<AppEnv>().basePath('/api')

  app.use(secureHeaders())
  app.use(async (c, next) => {
    await next()
    // Responses contain private data: never store them in shared or browser caches.
    c.header('Cache-Control', 'no-store')
  })
  app.use(
    bodyLimit({
      maxSize: MAX_BODY_BYTES,
      onError: (c) => c.json(errorBody('PAYLOAD_TOO_LARGE', 'The request body is too large.'), 413),
    }),
  )

  app.use(async (c, next) => {
    if (UNSAFE_METHODS.has(c.req.method) && isCrossOrigin(c, trustedOrigins)) {
      throw new ApiError(403, 'FORBIDDEN_ORIGIN', 'This request was blocked because it came from another website.')
    }
    await next()
  })

  // Public: lets developers (and later the host) check that the API is up.
  app.get('/health', (c) => c.json({ status: 'ok' }))

  // Public: sign-up, sign-in, sign-out and the current session, handled by Better Auth.
  if (authHandler) {
    app.on(['GET', 'POST'], '/auth/*', (c) => authHandler(c.req.raw))
  }

  // Everything below needs a user. The repository is created per request, bound to that user.
  app.use(async (c, next) => {
    const userId = await resolveUserId(c)
    if (!userId) throw new ApiError(401, 'UNAUTHENTICATED', 'Please sign in to continue.')
    c.set('repository', new DbRepository(db, userId, { now, newId }))
    await next()
  })

  // ---------- Projects ----------
  app.get('/projects', async (c) => c.json(await c.var.repository.listProjects()))
  app.post('/projects', async (c) => c.json(await c.var.repository.createProject(await requestBody(c)), 201))
  app.patch('/projects/:id', async (c) =>
    c.json(await c.var.repository.updateProject(c.req.param('id'), await requestBody(c))),
  )
  app.delete('/projects/:id', async (c) => {
    await c.var.repository.deleteProject(c.req.param('id'))
    return c.body(null, 204)
  })

  // ---------- Tasks ----------
  app.get('/tasks', async (c) => c.json(await c.var.repository.listTasks()))
  app.post('/tasks', async (c) => c.json(await c.var.repository.createTask(await requestBody(c)), 201))
  app.patch('/tasks/:id', async (c) => c.json(await c.var.repository.updateTask(c.req.param('id'), await requestBody(c))))
  app.delete('/tasks/:id', async (c) => {
    await c.var.repository.deleteTask(c.req.param('id'))
    return c.body(null, 204)
  })

  // ---------- Subtasks ----------
  app.get('/subtasks', async (c) => c.json(await c.var.repository.listSubtasks()))
  app.post('/tasks/:taskId/subtasks', async (c) =>
    c.json(await c.var.repository.createSubtask(c.req.param('taskId'), await requestBody(c)), 201),
  )
  app.put('/tasks/:taskId/subtasks/order', async (c) => {
    const { orderedIds } = reorderBodySchema.parse(await readJson(c))
    return c.json(await c.var.repository.reorderSubtasks(c.req.param('taskId'), orderedIds))
  })
  app.patch('/subtasks/:id', async (c) =>
    c.json(await c.var.repository.updateSubtask(c.req.param('id'), await requestBody(c))),
  )
  app.delete('/subtasks/:id', async (c) => {
    await c.var.repository.deleteSubtask(c.req.param('id'))
    return c.body(null, 204)
  })

  app.notFound((c) => c.json(errorBody('NOT_FOUND', 'Not found'), 404))

  app.onError((error, c) => {
    const { status, body } = toErrorResponse(error)
    // Expected errors (4xx) are part of normal use; only unexpected ones are logged.
    if (status >= 500) console.error('Unhandled API error:', error)
    return c.json(body, status)
  })

  return app
}

export type App = ReturnType<typeof createApp>
