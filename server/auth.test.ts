import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { createApp } from './app'
import { createAuth, sessionUser } from './auth'
import { accounts, sessions, users } from './db/schema'
import { setupTestDatabase } from './test/testDatabase'

/*
  Authentication and authorization, end to end: the real Better Auth inside the real API, on
  a real (in-memory) PostgreSQL, driven over HTTP the way a browser does it — with cookies
  and an Origin header.
*/

const database = setupTestDatabase()
const ORIGIN = 'http://localhost:5173'
const SECRET = 'test-secret-that-is-at-least-32-characters-long'
const PASSWORD = 'correct horse battery staple'

let emailCounter = 0
const uniqueEmail = (name = 'user') => `${name}-${(emailCounter += 1)}-${Date.now()}@example.test`

function setup({ secureCookies = false, rateLimit = false } = {}) {
  const auth = createAuth({ db: database(), secret: SECRET, appOrigin: ORIGIN, secureCookies, rateLimit })
  const app = createApp({
    db: database(),
    resolveUserId: sessionUser(auth),
    trustedOrigins: [ORIGIN],
    authHandler: auth.handler,
  })
  return { app, auth }
}

type App = ReturnType<typeof setup>['app']

interface RequestOptions {
  body?: unknown
  cookie?: string
  origin?: string | null
  headers?: Record<string, string>
}

async function send(app: App, method: string, path: string, { body, cookie, origin = ORIGIN, headers = {} }: RequestOptions = {}) {
  const response = await app.request(`${ORIGIN}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(origin ? { Origin: origin } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = text
  }
  return { status: response.status, json: json as Record<string, unknown> & Record<string, unknown>[], headers: response.headers }
}

/** The cookies a response sets, as a Cookie request header ("name=value; …"). */
function cookieHeader(headers: Headers): string {
  return headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ')
}

async function signUp(app: App, email = uniqueEmail(), name = 'Test User') {
  const result = await send(app, 'POST', '/api/auth/sign-up/email', { body: { name, email, password: PASSWORD } })
  expect(result.status).toBe(200)
  return { email, cookie: cookieHeader(result.headers), result }
}

describe('sign-up', () => {
  it('creates the account, signs the user in with a secure cookie, and creates their Inbox', async () => {
    const { app } = setup()
    const { cookie, result } = await signUp(app)

    const sessionCookie = result.headers.getSetCookie().find((value) => value.startsWith('better-auth.session_token='))
    expect(sessionCookie).toBeDefined()
    expect(sessionCookie).toMatch(/HttpOnly/i)
    expect(sessionCookie).toMatch(/SameSite=Lax/i)
    expect(sessionCookie).toMatch(/Path=\//)
    expect(sessionCookie).toMatch(/Max-Age=604800/) // 7 days: stays signed in across browser restarts

    const projects = await send(app, 'GET', '/api/projects', { cookie })
    expect(projects.status).toBe(200)
    expect(projects.json).toEqual([expect.objectContaining({ name: 'Inbox', isInbox: true })])
  })

  it('stores only a salted hash of the password', async () => {
    const { app } = setup()
    const { email } = await signUp(app)
    const [user] = await database().select().from(users).where(eq(users.email, email))
    const [account] = await database().select().from(accounts).where(eq(accounts.userId, user.id))
    expect(account.password).toBeTruthy()
    expect(account.password).not.toContain(PASSWORD)
    expect(account.password).toMatch(/^[0-9a-f]+:[0-9a-f]+$/) // scrypt salt:hash
  })

  it('validates input and refuses a second account with the same email', async () => {
    const { app } = setup()
    const bad = [
      { name: 'A', email: 'not-an-email', password: PASSWORD },
      { name: 'A', email: uniqueEmail(), password: 'short' },
      { name: 'A', email: uniqueEmail(), password: 'x'.repeat(129) },
    ]
    for (const body of bad) {
      const result = await send(app, 'POST', '/api/auth/sign-up/email', { body })
      expect(result.status).toBeGreaterThanOrEqual(400)
      expect(result.status).toBeLessThan(500)
      expect(result.headers.getSetCookie()).toEqual([])
    }

    // Taking over an existing email doesn't work, and the original password keeps working.
    const { email } = await signUp(app)
    const takeover = await send(app, 'POST', '/api/auth/sign-up/email', {
      body: { name: 'Mallory', email, password: 'a different password' },
    })
    expect(takeover.status).toBe(422)
    const signIn = await send(app, 'POST', '/api/auth/sign-in/email', { body: { email, password: PASSWORD } })
    expect(signIn.status).toBe(200)
  })

  it('marks cookies Secure (HTTPS only) in production', async () => {
    const { app } = setup({ secureCookies: true })
    const { result } = await signUp(app)
    const sessionCookie = result.headers.getSetCookie().find((value) => value.includes('session_token='))
    expect(sessionCookie).toMatch(/^__Secure-better-auth\.session_token=/)
    expect(sessionCookie).toMatch(/; Secure/i)
  })
})

describe('sign-in and sessions', () => {
  it('signs in with the right password; the session cookie then authorizes API requests', async () => {
    const { app } = setup()
    const { email } = await signUp(app)
    const signIn = await send(app, 'POST', '/api/auth/sign-in/email', { body: { email, password: PASSWORD } })
    expect(signIn.status).toBe(200)

    const cookie = cookieHeader(signIn.headers)
    const session = await send(app, 'GET', '/api/auth/get-session', { cookie })
    expect(session.json).toMatchObject({ user: { email } })
    expect((await send(app, 'GET', '/api/tasks', { cookie })).status).toBe(200)
  })

  it('gives the same answer for a wrong password and an unknown email (no account enumeration)', async () => {
    const { app } = setup()
    const { email } = await signUp(app)
    const wrongPassword = await send(app, 'POST', '/api/auth/sign-in/email', { body: { email, password: 'wrong password!' } })
    const unknownEmail = await send(app, 'POST', '/api/auth/sign-in/email', {
      body: { email: uniqueEmail('nobody'), password: 'wrong password!' },
    })
    expect(wrongPassword.status).toBe(401)
    expect(unknownEmail.status).toBe(401)
    expect(wrongPassword.json).toEqual(unknownEmail.json)
    expect(wrongPassword.headers.getSetCookie()).toEqual([])
  })

  it('signing out ends the session on the server, so the old cookie stops working', async () => {
    const { app } = setup()
    const { cookie, email } = await signUp(app)
    expect((await send(app, 'GET', '/api/projects', { cookie })).status).toBe(200)

    const signOut = await send(app, 'POST', '/api/auth/sign-out', { cookie, body: {} })
    expect(signOut.status).toBe(200)

    // Even a copy of the old cookie no longer works: the session row is gone.
    expect((await send(app, 'GET', '/api/projects', { cookie })).status).toBe(401)
    const [user] = await database().select().from(users).where(eq(users.email, email))
    expect(await database().select().from(sessions).where(eq(sessions.userId, user.id))).toEqual([])
  })

  it('stores sessions that expire after 7 days', async () => {
    const { app } = setup()
    const { email } = await signUp(app)
    const [user] = await database().select().from(users).where(eq(users.email, email))
    const [session] = await database().select().from(sessions).where(eq(sessions.userId, user.id))
    const days = (session.expiresAt.getTime() - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(6.9)
    expect(days).toBeLessThanOrEqual(7)
  })
})

describe('authorization: who is the user?', () => {
  it('refuses requests without a valid session cookie', async () => {
    const { app } = setup()
    const { cookie } = await signUp(app)
    const tampered = cookie.replace(/session_token=([^;.]+)/, 'session_token=$1x')

    for (const attempt of [undefined, tampered, 'better-auth.session_token=forged.value']) {
      const result = await send(app, 'GET', '/api/projects', { cookie: attempt })
      expect(result.status).toBe(401)
      expect(result.json).toEqual({ error: { code: 'UNAUTHENTICATED', message: 'Please sign in to continue.' } })
    }
  })

  it('only accepts the signed HttpOnly cookie, not the raw token that responses expose to JavaScript', async () => {
    const { app } = setup()
    const { cookie, result } = await signUp(app)
    const rawToken = (result.json as { token?: string }).token
    expect(rawToken).toBeTruthy()

    // The cookie carries the token plus a signature made with BETTER_AUTH_SECRET; the token
    // alone (e.g. stolen by a script) works neither as a cookie nor as a Bearer token.
    expect((await send(app, 'GET', '/api/projects', { cookie })).status).toBe(200)
    expect((await send(app, 'GET', '/api/projects', { cookie: `better-auth.session_token=${rawToken}` })).status).toBe(401)
    expect((await send(app, 'GET', '/api/projects', { headers: { Authorization: `Bearer ${rawToken}` } })).status).toBe(401)
  })

  it('never takes the user from headers, the URL or the body', async () => {
    const { app } = setup()
    const { email: aliceEmail } = await signUp(app)
    const [alice] = await database().select().from(users).where(eq(users.email, aliceEmail))

    // No session: identity claims anywhere else are ignored.
    const claimed = await send(app, 'GET', `/api/projects?userId=${alice.id}`, {
      headers: { 'X-User-Id': alice.id, 'X-Test-User': alice.id },
    })
    expect(claimed.status).toBe(401)

    // With Bob's session, a userId in the body is rejected, not used.
    const { cookie: bob } = await signUp(app)
    const [bobInbox] = (await send(app, 'GET', '/api/projects', { cookie: bob })).json
    const planted = await send(app, 'POST', '/api/tasks', {
      cookie: bob,
      body: { projectId: bobInbox.id, title: 'Planted', userId: alice.id },
    })
    expect(planted.status).toBe(400)
  })

  it('keeps two signed-in users completely apart', async () => {
    const { app } = setup()
    const { cookie: alice } = await signUp(app, uniqueEmail('alice'), 'Alice')
    const { cookie: bob } = await signUp(app, uniqueEmail('bob'), 'Bob')

    const project = (await send(app, 'POST', '/api/projects', { cookie: alice, body: { name: 'Secret plans' } })).json
    const task = (await send(app, 'POST', '/api/tasks', { cookie: alice, body: { projectId: project.id, title: 'Secret' } }))
      .json
    const subtask = (await send(app, 'POST', `/api/tasks/${task.id}/subtasks`, { cookie: alice, body: { title: 'Step' } })).json

    expect((await send(app, 'GET', '/api/projects', { cookie: bob })).json.map((p) => p.name)).toEqual([
      'Inbox',
    ])
    expect((await send(app, 'GET', '/api/tasks', { cookie: bob })).json).toEqual([])
    expect((await send(app, 'GET', '/api/subtasks', { cookie: bob })).json).toEqual([])

    const attempts: [string, string, unknown?][] = [
      ['PATCH', `/api/projects/${project.id}`, { name: 'Hacked' }],
      ['DELETE', `/api/projects/${project.id}`],
      ['POST', '/api/tasks', { projectId: project.id, title: 'Planted' }],
      ['PATCH', `/api/tasks/${task.id}`, { status: 'done' }],
      ['DELETE', `/api/tasks/${task.id}`],
      ['POST', `/api/tasks/${task.id}/subtasks`, { title: 'Planted' }],
      ['PUT', `/api/tasks/${task.id}/subtasks/order`, { orderedIds: [subtask.id] }],
      ['PATCH', `/api/subtasks/${subtask.id}`, { done: true }],
      ['DELETE', `/api/subtasks/${subtask.id}`],
    ]
    for (const [method, path, body] of attempts) {
      const result = await send(app, method, path, { cookie: bob, body })
      expect({ method, path, status: result.status }).toEqual({ method, path, status: 404 })
    }
    expect((await send(app, 'GET', '/api/tasks', { cookie: alice })).json).toEqual([task])
    expect((await send(app, 'GET', '/api/subtasks', { cookie: alice })).json).toEqual([subtask])
  })
})

describe('CSRF protection', () => {
  it('refuses state-changing requests from another website, even with a valid session cookie', async () => {
    const { app } = setup()
    const { cookie } = await signUp(app)

    const fromEvil = await send(app, 'POST', '/api/projects', { cookie, origin: 'https://evil.example', body: { name: 'Pwned' } })
    expect(fromEvil.status).toBe(403)
    expect(fromEvil.json).toMatchObject({ error: { code: 'FORBIDDEN_ORIGIN' } })

    const crossSite = await send(app, 'DELETE', '/api/projects/00000000-0000-4000-8000-000000000000', {
      cookie,
      origin: null,
      headers: { 'Sec-Fetch-Site': 'cross-site' },
    })
    expect(crossSite.status).toBe(403)

    const names = (await send(app, 'GET', '/api/projects', { cookie })).json.map((p) => p.name)
    expect(names).toEqual(['Inbox'])
  })

  it('protects the auth endpoints too (no login or logout forced by another site)', async () => {
    const { app } = setup()
    const { email, cookie } = await signUp(app)
    const forcedLogin = await send(app, 'POST', '/api/auth/sign-in/email', {
      origin: 'https://evil.example',
      body: { email, password: PASSWORD },
    })
    expect(forcedLogin.status).toBe(403)
    const forcedLogout = await send(app, 'POST', '/api/auth/sign-out', { cookie, origin: 'https://evil.example', body: {} })
    expect(forcedLogout.status).toBe(403)
    expect((await send(app, 'GET', '/api/projects', { cookie })).status).toBe(200)
  })
})

describe('brute-force protection', () => {
  it('limits sign-in attempts per IP address', async () => {
    const { app } = setup({ rateLimit: true })
    const { email } = await signUp(app)
    const ip = { 'X-Forwarded-For': '203.0.113.7' }
    const statuses: number[] = []
    for (let attempt = 0; attempt < 7; attempt += 1) {
      const result = await send(app, 'POST', '/api/auth/sign-in/email', {
        headers: ip,
        body: { email, password: 'wrong password!' },
      })
      statuses.push(result.status)
    }
    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401])
    expect(statuses.slice(5)).toEqual([429, 429])

    // Another address isn't affected.
    const other = await send(app, 'POST', '/api/auth/sign-in/email', {
      headers: { 'X-Forwarded-For': '198.51.100.4' },
      body: { email, password: PASSWORD },
    })
    expect(other.status).toBe(200)
  })
})
