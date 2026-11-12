import { describe, expect, it } from 'vitest'
import { AUTH_MESSAGES, AuthError, HttpAuthClient } from '../src/data/authClient'
import { HttpRepository } from '../src/data/httpRepository'
import { createApp } from './app'
import { createAuth, sessionUser } from './auth'
import { MemoryMailer } from './mail'
import { setupTestDatabase } from './test/testDatabase'

/*
  The browser's HttpAuthClient against the real server (Better Auth + API on PGlite). A tiny
  cookie jar stands in for the browser: it keeps the cookies the server sets and sends them
  back, with the page's Origin, exactly as a browser on http://localhost:5173 would.
*/

const database = setupTestDatabase()
const ORIGIN = 'http://localhost:5173'
const PASSWORD = 'correct horse battery staple'
let counter = 0
const uniqueEmail = () => `client-${(counter += 1)}-${Date.now()}@example.test`

function browser({ rateLimit = false } = {}) {
  const mailer = new MemoryMailer()
  const auth = createAuth({
    db: database(),
    secret: 'test-secret-that-is-at-least-32-characters-long',
    appOrigin: ORIGIN,
    secureCookies: false,
    rateLimit,
    mailer,
    trustedProxies: ['127.0.0.1'],
  })
  const app = createApp({ db: database(), resolveUserId: sessionUser(auth), trustedOrigins: [ORIGIN], authHandler: auth.handler })
  const jar = new Map<string, string>()

  const fetchWithCookies: typeof fetch = async (input, init = {}) => {
    const headers = new Headers(init.headers)
    headers.set('Origin', ORIGIN)
    headers.set('X-Forwarded-For', '192.0.2.10')
    if (jar.size > 0) headers.set('Cookie', [...jar].map(([name, value]) => `${name}=${value}`).join('; '))
    const response = await app.request(new URL(String(input), ORIGIN).toString(), { ...init, headers })
    for (const cookie of response.headers.getSetCookie()) {
      const [pair, ...attributes] = cookie.split(';')
      const [name, value] = pair.split('=')
      const expired = attributes.some((attribute) => /max-age=0/i.test(attribute.trim())) || value === ''
      if (expired) jar.delete(name)
      else jar.set(name, value)
    }
    return response
  }

  /** Opens a link from an email, like clicking it in the same browser (no redirect following). */
  const openLink = (link: string | undefined) => fetchWithCookies(link ?? 'http://localhost:5173/missing', { redirect: 'manual' })

  return {
    mailer,
    openLink,
    authClient: new HttpAuthClient({ fetch: fetchWithCookies, appOrigin: ORIGIN }),
    repository: new HttpRepository({ fetch: fetchWithCookies }),
  }
}

describe('HttpAuthClient with the real server', () => {
  it('signs up, confirms the email, keeps the session, reaches the API, signs out and back in', async () => {
    const { authClient, repository, mailer, openLink } = browser()
    const email = uniqueEmail()

    expect(await authClient.getSession()).toBeNull()
    await authClient.signUp({ name: ' Grace ', email: email.toUpperCase(), password: PASSWORD })
    expect(await authClient.getSession()).toBeNull() // not signed in until the email is confirmed

    await expect(authClient.signIn({ email, password: PASSWORD })).rejects.toEqual(new AuthError(AUTH_MESSAGES.emailNotVerified))
    const confirmed = await openLink(mailer.latestTo(email)?.link)
    expect(confirmed.headers.get('location')).toBe('/email-verified')

    const user = await authClient.getSession()
    expect(user).toEqual({ id: expect.any(String), name: 'Grace', email })
    expect((await repository.listProjects()).map((project) => project.name)).toEqual(['Inbox'])

    await authClient.signOut()
    expect(await authClient.getSession()).toBeNull()
    await expect(repository.listProjects()).rejects.toThrow('Please sign in to continue.')

    expect(await authClient.signIn({ email, password: PASSWORD })).toEqual(user)
    expect(await repository.listProjects()).toHaveLength(1)
  })

  it('resets a forgotten password through the emailed link', async () => {
    const { authClient, mailer, openLink } = browser()
    const email = uniqueEmail()
    await authClient.signUp({ name: 'Ada', email, password: PASSWORD })
    await openLink(mailer.latestTo(email)?.link)
    await authClient.signOut()

    // Same answer for an unknown email.
    await expect(authClient.requestPasswordReset({ email: uniqueEmail() })).resolves.toBeUndefined()
    await authClient.requestPasswordReset({ email })
    const opened = await openLink(mailer.latestTo(email)?.link)
    const landing = new URL(opened.headers.get('location') ?? '', ORIGIN)
    expect(landing.pathname).toBe('/reset-password')
    const token = landing.searchParams.get('token') ?? ''

    await expect(authClient.resetPassword({ token: 'forged', newPassword: 'a new passphrase' })).rejects.toEqual(
      new AuthError(AUTH_MESSAGES.invalidResetLink),
    )
    await authClient.resetPassword({ token, newPassword: 'a new passphrase' })
    await expect(authClient.signIn({ email, password: PASSWORD })).rejects.toEqual(new AuthError(AUTH_MESSAGES.invalidCredentials))
    expect(await authClient.signIn({ email, password: 'a new passphrase' })).toMatchObject({ email })
  })

  it('turns server errors into clear messages, without revealing registered emails', async () => {
    const { authClient, mailer, openLink } = browser()
    const email = uniqueEmail()
    await authClient.signUp({ name: 'Ada', email, password: PASSWORD })
    await openLink(mailer.latestTo(email)?.link)
    await authClient.signOut()

    await expect(authClient.signIn({ email, password: 'wrong password' })).rejects.toEqual(
      new AuthError(AUTH_MESSAGES.invalidCredentials),
    )
    // Signing up again with a registered email looks exactly like a new sign-up.
    await expect(authClient.signUp({ name: 'Ada again', email, password: PASSWORD })).resolves.toBeUndefined()
  })

  it('reports rate limiting', async () => {
    const { authClient } = browser({ rateLimit: true })
    const email = uniqueEmail()
    const attempts = Array.from({ length: 6 }, () =>
      authClient.signIn({ email, password: 'wrong password' }).catch((error: unknown) => error),
    )
    const results = []
    for (const attempt of attempts) results.push(await attempt)
    expect(results.at(-1)).toEqual(new AuthError(AUTH_MESSAGES.tooManyAttempts))
  })

  it('validates input before sending anything', async () => {
    const sent: unknown[] = []
    const client = new HttpAuthClient({
      fetch: async (input) => {
        sent.push(input)
        return Response.json(null)
      },
    })
    await expect(client.signUp({ name: '', email: 'nope', password: 'short' })).rejects.toThrow()
    await expect(client.signIn({ email: 'nope', password: '' })).rejects.toThrow()
    expect(sent).toEqual([])
  })

  it('handles network failures, blocked requests and unexpected responses', async () => {
    const offline = new HttpAuthClient({
      fetch: async () => {
        throw new TypeError('fetch failed')
      },
    })
    await expect(offline.getSession()).rejects.toEqual(new AuthError(AUTH_MESSAGES.offline))

    const blocked = new HttpAuthClient({ fetch: async () => Response.json({ error: {} }, { status: 403 }) })
    await expect(blocked.signOut()).rejects.toEqual(new AuthError(AUTH_MESSAGES.blocked))

    // Our API's origin check explains itself; the client shows that message as is.
    const wrongAddress = new HttpAuthClient({
      fetch: async () =>
        Response.json(
          { error: { code: 'FORBIDDEN_ORIGIN', message: 'Blocked. Open the app at http://localhost:5173 instead.' } },
          { status: 403 },
        ),
    })
    await expect(wrongAddress.signUp({ name: 'A', email: 'a@example.test', password: 'long enough' })).rejects.toEqual(
      new AuthError('Blocked. Open the app at http://localhost:5173 instead.'),
    )

    const garbage = new HttpAuthClient({ fetch: async () => Response.json({ user: { id: 1 } }) })
    await expect(garbage.getSession()).rejects.toEqual(new AuthError(AUTH_MESSAGES.server))
    await expect(garbage.signIn({ email: 'a@example.test', password: 'x' })).rejects.toEqual(
      new AuthError(AUTH_MESSAGES.server),
    )

    const broken = new HttpAuthClient({ fetch: async () => new Response('oops', { status: 500 }) })
    await expect(broken.getSession()).rejects.toEqual(new AuthError(AUTH_MESSAGES.server))

    const badRequest = new HttpAuthClient({
      fetch: async () => Response.json({ message: 'Password is too short' }, { status: 400 }),
    })
    await expect(badRequest.signUp({ name: 'A', email: 'a@example.test', password: 'long enough' })).rejects.toEqual(
      new AuthError('Password is too short'),
    )
  })
})
