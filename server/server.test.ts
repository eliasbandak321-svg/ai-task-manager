import { describe, expect, it, vi } from 'vitest'
import { loadEnv, trustedOrigins } from './env'
import { buildServer } from './server'
import { setupTestDatabase } from './test/testDatabase'

/*
  Regression tests for the M7 sign-up failure: opening the dev server at http://127.0.0.1:5173
  (instead of http://localhost:5173) made every sign-up fail with 403 FORBIDDEN_ORIGIN,
  because only the exact APP_ORIGIN string was trusted. These tests use buildServer — the
  same wiring server/dev.ts runs — so a mismatch between configuration and server is caught.
*/

const database = setupTestDatabase()
const SECRET = 'test-secret-that-is-at-least-32-characters-long'
const devEnv = loadEnv({ DATABASE_PROVIDER: 'pglite', BETTER_AUTH_SECRET: SECRET })
const PASSWORD = 'correct horse battery staple'
let counter = 0

async function signUpFrom(origin: string, env = devEnv) {
  const { app } = buildServer(env, database(), { rateLimit: false })
  counter += 1
  const response = await app.request(`${env.APP_ORIGIN}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: origin, 'Sec-Fetch-Site': 'same-origin' },
    body: JSON.stringify({ name: 'Origin test', email: `origin-${counter}-${Date.now()}@example.test`, password: PASSWORD }),
  })
  return { status: response.status, json: (await response.json()) as { error?: { code: string; message: string } }, app, response }
}

describe('trustedOrigins', () => {
  it('trusts every name of this computer for the dev server’s scheme and port', () => {
    expect(trustedOrigins({ APP_ORIGIN: 'http://localhost:5173', NODE_ENV: 'development' })).toEqual([
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://[::1]:5173',
    ])
    expect(trustedOrigins({ APP_ORIGIN: 'http://127.0.0.1:5173', NODE_ENV: 'development' })[0]).toBe('http://127.0.0.1:5173')
  })

  it('trusts exactly one origin in production, or for a non-local address', () => {
    expect(trustedOrigins({ APP_ORIGIN: 'https://tasks.example.com', NODE_ENV: 'production' })).toEqual([
      'https://tasks.example.com',
    ])
    expect(trustedOrigins({ APP_ORIGIN: 'http://localhost:5173', NODE_ENV: 'production' })).toEqual([
      'http://localhost:5173',
    ])
    expect(trustedOrigins({ APP_ORIGIN: 'http://dev.example.com:5173', NODE_ENV: 'development' })).toEqual([
      'http://dev.example.com:5173',
    ])
  })
})

describe('sign-up from the address the browser actually uses (regression)', () => {
  it.each(['http://localhost:5173', 'http://127.0.0.1:5173', 'http://[::1]:5173'])(
    'signs up from %s in development',
    async (origin) => {
      const { status, response } = await signUpFrom(origin)
      expect(status).toBe(200)
      expect(response.headers.getSetCookie().some((cookie) => cookie.startsWith('better-auth.session_token='))).toBe(true)
    },
  )

  it('still blocks other websites and other ports, and says which address to use', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    for (const origin of ['https://evil.example', 'http://localhost:5174', 'http://127.0.0.1:8080']) {
      const { status, json } = await signUpFrom(origin)
      expect(status).toBe(403)
      expect(json.error).toEqual({
        code: 'FORBIDDEN_ORIGIN',
        message: 'This request was blocked because it came from another website. Open the app at http://localhost:5173 instead.',
      })
    }
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Blocked POST /api/auth/sign-up/email: origin https://evil.example'))
    warn.mockRestore()
  })

  it('keeps production strict: one origin, and a generic message', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const production = loadEnv({
      DATABASE_PROVIDER: 'postgres',
      DATABASE_URL: 'postgres://u:p@db.example:5432/app',
      NODE_ENV: 'production',
      BETTER_AUTH_SECRET: SECRET,
      APP_ORIGIN: 'https://tasks.example.com',
    })
    const blocked = await signUpFrom('http://127.0.0.1:5173', production)
    expect(blocked.status).toBe(403)
    expect(blocked.json.error?.message).toBe('This request was blocked because it came from another website.')
    warn.mockRestore()
  })
})
