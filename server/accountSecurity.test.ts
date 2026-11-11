import { mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { and, eq, like } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { sessions, users, verifications } from './db/schema'
import { loadEnv } from './env'
import { createMailer, FileMailer, MemoryMailer } from './mail'
import { buildServer } from './server'
import { setupTestDatabase } from './test/testDatabase'

/*
  M8 account security against the real server (buildServer, as `npm run dev` runs it):
  email verification, account-enumeration resistance, password reset, session expiry and
  client-IP handling for rate limits.
*/

const database = setupTestDatabase()
const ORIGIN = 'http://localhost:5173'
const PASSWORD = 'correct horse battery staple'
const NEW_PASSWORD = 'a brand new passphrase'
const env = loadEnv({ DATABASE_PROVIDER: 'pglite', BETTER_AUTH_SECRET: 'test-secret-that-is-at-least-32-characters-long' })
let counter = 0
const uniqueEmail = (name = 'user') => `${name}-${(counter += 1)}-${Date.now()}@example.test`

function server({ rateLimit = false } = {}) {
  const mailer = new MemoryMailer()
  const { app } = buildServer(env, database(), { rateLimit, mailer })

  async function send(method: string, path: string, { body, cookie, headers = {} }: { body?: unknown; cookie?: string; headers?: Record<string, string> } = {}) {
    const response = await app.request(path.startsWith('http') ? path : `${ORIGIN}${path}`, {
      method,
      redirect: 'manual',
      headers: {
        Origin: ORIGIN,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await response.text()
    let json: Record<string, unknown> | null = null
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : null
    } catch {
      json = null
    }
    const cookies = response.headers.getSetCookie().map((value) => value.split(';')[0])
    return { status: response.status, json, location: response.headers.get('location'), cookie: cookies.join('; '), cookies }
  }

  /** Signs up and confirms the email; returns the session cookie. */
  async function verifiedUser(email = uniqueEmail()) {
    await send('POST', '/api/auth/sign-up/email', { body: { name: 'User', email, password: PASSWORD, callbackURL: '/email-verified' } })
    const verified = await send('GET', mailer.latestTo(email)?.link ?? '')
    expect(verified.status).toBe(302)
    return { email, cookie: verified.cookie }
  }

  // As the app's client does: a re-sent verification link should land on our page.
  const signIn = (email: string, password: string, headers?: Record<string, string>) =>
    send('POST', '/api/auth/sign-in/email', { body: { email, password, callbackURL: '/email-verified' }, headers })

  return { app, mailer, send, verifiedUser, signIn }
}

describe('email verification', () => {
  it('requires confirming the email before the account can sign in', async () => {
    const { send, mailer, signIn } = server()
    const email = uniqueEmail()

    const created = await send('POST', '/api/auth/sign-up/email', {
      body: { name: 'Grace', email, password: PASSWORD, callbackURL: '/email-verified' },
    })
    expect(created.status).toBe(200)
    expect(created.cookies).toEqual([]) // no session yet
    expect(mailer.latestTo(email)?.subject).toBe('Confirm your email address')

    // Signing in before confirming fails, and sends a fresh link.
    const early = await signIn(email, PASSWORD)
    expect(early.status).toBe(403)
    expect(early.json).toMatchObject({ code: 'EMAIL_NOT_VERIFIED' })
    expect(mailer.sent.filter((mail) => mail.to === email)).toHaveLength(2)

    // The link confirms the address, signs the user in, and lands on our page.
    const verified = await send('GET', mailer.latestTo(email)?.link ?? '')
    expect(verified.status).toBe(302)
    expect(verified.location).toBe('/email-verified')
    expect((await send('GET', '/api/projects', { cookie: verified.cookie })).status).toBe(200)
    expect((await signIn(email, PASSWORD)).status).toBe(200)
  })

  it('signs in from a confirmation link only once (it can’t be reused as a login link)', async () => {
    const { send, mailer } = server()
    const email = uniqueEmail()
    await send('POST', '/api/auth/sign-up/email', { body: { name: 'Once', email, password: PASSWORD, callbackURL: '/email-verified' } })
    const link = mailer.latestTo(email)?.link ?? ''
    expect((await send('GET', link)).cookies).toHaveLength(1)
    expect((await send('GET', link)).cookies).toEqual([])
  })

  it('rejects a forged or tampered verification link', async () => {
    const { send } = server()
    const result = await send('GET', '/api/auth/verify-email?token=not-a-real-token&callbackURL=%2Femail-verified')
    expect(result.status).toBe(302)
    expect(result.location).toMatch(/^\/email-verified\?error=/)
    expect(result.cookies).toEqual([])
  })
})

describe('account enumeration', () => {
  it('answers sign-up the same way for new and existing emails, and tells the real owner', async () => {
    const { send, mailer, verifiedUser, signIn } = server()
    const { email: taken } = await verifiedUser()
    const before = mailer.sent.length

    const forNew = await send('POST', '/api/auth/sign-up/email', {
      body: { name: 'Mallory', email: uniqueEmail('new'), password: 'mallory password' },
    })
    const forTaken = await send('POST', '/api/auth/sign-up/email', {
      body: { name: 'Mallory', email: taken, password: 'mallory password' },
    })

    expect(forTaken.status).toBe(forNew.status)
    expect(Object.keys(forTaken.json ?? {}).sort()).toEqual(Object.keys(forNew.json ?? {}).sort())
    expect(forTaken.cookies).toEqual([])
    // The real owner is told; the account itself is untouched.
    const notice = mailer.sent.slice(before).find((mail) => mail.to === taken)
    expect(notice?.subject).toBe('Someone tried to sign up with your email')
    expect((await signIn(taken, PASSWORD)).status).toBe(200)
    expect((await signIn(taken, 'mallory password')).status).toBe(401)
    const [owner] = await database().select().from(users).where(eq(users.email, taken))
    expect(owner.name).toBe('User')
  })

  it('answers password-reset requests the same way for known and unknown emails', async () => {
    const { send, mailer, verifiedUser } = server()
    const { email } = await verifiedUser()
    const unknown = uniqueEmail('nobody')
    const before = mailer.sent.length

    const known = await send('POST', '/api/auth/request-password-reset', { body: { email, redirectTo: `${ORIGIN}/reset-password` } })
    const missing = await send('POST', '/api/auth/request-password-reset', { body: { email: unknown, redirectTo: `${ORIGIN}/reset-password` } })

    expect(known.status).toBe(200)
    expect(missing).toMatchObject({ status: known.status, json: known.json })
    const sent = mailer.sent.slice(before)
    expect(sent.map((mail) => mail.to)).toEqual([email]) // only the real account gets an email
  })
})

describe('password reset', () => {
  async function requestReset(context: ReturnType<typeof server>, email: string) {
    await context.send('POST', '/api/auth/request-password-reset', { body: { email, redirectTo: `${ORIGIN}/reset-password` } })
    const link = context.mailer.latestTo(email)?.link ?? ''
    expect(context.mailer.latestTo(email)?.subject).toBe('Reset your password')
    // The email link checks the token and forwards to our page with it.
    const opened = await context.send('GET', link)
    expect(opened.status).toBe(302)
    const token = new URL(opened.location ?? '', ORIGIN).searchParams.get('token')
    expect(new URL(opened.location ?? '', ORIGIN).pathname).toBe('/reset-password')
    expect(token).toBeTruthy()
    return token as string
  }

  it('resets the password, signs the account out everywhere, and works only once', async () => {
    const context = server()
    const { email, cookie: oldSession } = await context.verifiedUser()
    const token = await requestReset(context, email)

    const reset = await context.send('POST', '/api/auth/reset-password', { body: { token, newPassword: NEW_PASSWORD } })
    expect(reset.status).toBe(200)

    expect((await context.signIn(email, PASSWORD)).status).toBe(401)
    expect((await context.signIn(email, NEW_PASSWORD)).status).toBe(200)
    // Sessions from before the reset (e.g. an attacker's) are gone.
    expect((await context.send('GET', '/api/projects', { cookie: oldSession })).status).toBe(401)

    // The same link can't be used twice.
    const again = await context.send('POST', '/api/auth/reset-password', { body: { token, newPassword: 'yet another passphrase' } })
    expect(again.status).toBe(400)
    expect((await context.signIn(email, NEW_PASSWORD)).status).toBe(200)
  })

  it('refuses expired, forged and weak resets', async () => {
    const context = server()
    const { email } = await context.verifiedUser()
    const token = await requestReset(context, email)

    // Weak new password: refused, and the token stays usable for a proper one.
    expect((await context.send('POST', '/api/auth/reset-password', { body: { token, newPassword: 'short' } })).status).toBe(400)

    // Forged token.
    expect((await context.send('POST', '/api/auth/reset-password', { body: { token: 'forged', newPassword: NEW_PASSWORD } })).status).toBe(400)
    const forgedLink = await context.send('GET', `/api/auth/reset-password/forged?callbackURL=${encodeURIComponent(`${ORIGIN}/reset-password`)}`)
    expect(forgedLink.location).toBe(`${ORIGIN}/reset-password?error=INVALID_TOKEN`)

    // Expired token (15 minutes): move this test user's token into the past.
    const [user] = await database().select().from(users).where(eq(users.email, email))
    await database()
      .update(verifications)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(and(like(verifications.identifier, 'reset-password:%'), eq(verifications.value, user.id)))
    expect((await context.send('POST', '/api/auth/reset-password', { body: { token, newPassword: NEW_PASSWORD } })).status).toBe(400)
    expect((await context.signIn(email, PASSWORD)).status).toBe(200)
  })

  it('issues tokens that expire after 15 minutes', async () => {
    const context = server()
    const { email } = await context.verifiedUser()
    await context.send('POST', '/api/auth/request-password-reset', { body: { email, redirectTo: `${ORIGIN}/reset-password` } })
    const [user] = await database().select().from(users).where(eq(users.email, email))
    const [row] = await database()
      .select()
      .from(verifications)
      .where(and(like(verifications.identifier, 'reset-password:%'), eq(verifications.value, user.id)))
    const minutes = (row.expiresAt.getTime() - Date.now()) / 60_000
    expect(minutes).toBeGreaterThan(14)
    expect(minutes).toBeLessThanOrEqual(15)
  })

  it('never sends a reset link that would hand the token to another website (regression)', async () => {
    // Password-reset poisoning: an attacker requests a reset for the victim with their own
    // redirectTo; the victim clicks the genuine email and the token goes to the attacker.
    const { send, mailer, verifiedUser } = server()
    const { email } = await verifiedUser()
    const before = mailer.sent.length
    for (const redirectTo of ['https://evil.example/steal-token', '//evil.example/steal', 'http://localhost:5174/reset-password']) {
      const result = await send('POST', '/api/auth/request-password-reset', { body: { email, redirectTo } })
      expect(result.status).toBe(400)
      expect(result.json).toMatchObject({ error: { code: 'UNSAFE_REDIRECT' } })
    }
    expect(mailer.sent.length).toBe(before)
  })

  it('refuses a genuine reset link whose callback was changed to another website', async () => {
    const context = server()
    const { email } = await context.verifiedUser()
    await context.send('POST', '/api/auth/request-password-reset', { body: { email, redirectTo: `${ORIGIN}/reset-password` } })
    const link = new URL(context.mailer.latestTo(email)?.link ?? '')
    link.searchParams.set('callbackURL', 'https://evil.example/steal')
    const opened = await context.send('GET', link.toString())
    expect(opened.status).toBe(400)
    expect(opened.location).toBeNull()
  })

  it('limits reset requests per client', async () => {
    const { send } = server({ rateLimit: true })
    const statuses = []
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const result = await send('POST', '/api/auth/request-password-reset', {
        body: { email: uniqueEmail('target'), redirectTo: `${ORIGIN}/reset-password` },
        headers: { 'X-Forwarded-For': '198.51.100.20, 127.0.0.1' },
      })
      statuses.push(result.status)
    }
    expect(statuses).toEqual([200, 200, 200, 429])
  })
})

describe('sessions', () => {
  it('stops accepting a session once it has expired', async () => {
    const { send, verifiedUser } = server()
    const { email, cookie } = await verifiedUser()
    expect((await send('GET', '/api/projects', { cookie })).status).toBe(200)

    const [user] = await database().select().from(users).where(eq(users.email, email))
    await database().update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.userId, user.id))

    expect((await send('GET', '/api/projects', { cookie })).status).toBe(401)
    expect((await send('GET', '/api/auth/get-session', { cookie })).json).toBeNull()
  })
})

describe('client IP for rate limiting', () => {
  it('uses the first address our own proxy didn’t add, so a faked header can’t dodge the limit', async () => {
    const { signIn, verifiedUser } = server({ rateLimit: true })
    const { email } = await verifiedUser()
    const statuses = []
    for (let attempt = 0; attempt < 7; attempt += 1) {
      // What Vite forwards when the client sends its own X-Forwarded-For: "<fake>, <client>, <proxy>".
      const result = await signIn(email, 'wrong password', { 'X-Forwarded-For': `10.9.0.${attempt}, 203.0.113.50, 127.0.0.1` })
      statuses.push(result.status)
    }
    expect(statuses).toEqual([401, 401, 401, 401, 401, 429, 429])

    // A different real client has its own allowance.
    const other = await signIn(email, PASSWORD, { 'X-Forwarded-For': '203.0.113.51, 127.0.0.1' })
    expect(other.status).toBe(200)
  })
})

describe('mail transports', () => {
  it('saves emails as private files for the file transport', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mail-'))
    const mailer = createMailer({ MAIL_TRANSPORT: 'file', MAIL_DIR: dir })
    expect(mailer).toBeInstanceOf(FileMailer)
    await mailer.send({ to: 'a@example.test', subject: 'Hi', text: 'Body', link: 'http://localhost:5173/x' })
    const [file] = readdirSync(dir)
    expect(JSON.parse(readFileSync(join(dir, file), 'utf8'))).toMatchObject({ to: 'a@example.test', link: 'http://localhost:5173/x' })
    expect(statSync(join(dir, file)).mode & 0o777).toBe(0o600)
  })
})
