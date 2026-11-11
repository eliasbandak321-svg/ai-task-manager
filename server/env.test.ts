import { describe, expect, it } from 'vitest'
import { databaseConfig, describeDatabase, loadEnv, trustedProxies } from './env'

const NEON_URL = 'postgresql://user:secret@ep-example-123.c-1.us-east-1.aws.neon.tech/neondb?sslmode=verify-full'
const SECRET = 'test-secret-that-is-at-least-32-characters-long'
const neon = { DATABASE_PROVIDER: 'neon', DATABASE_URL: NEON_URL, NEON_BRANCH_ID: 'br-dev-1', BETTER_AUTH_SECRET: SECRET }

describe('loadEnv: choosing the database', () => {
  it('requires an explicit database provider: no silent fallback', () => {
    expect(() => loadEnv({ BETTER_AUTH_SECRET: SECRET })).toThrow(/DATABASE_PROVIDER is not set/)
    expect(() => loadEnv({ DATABASE_URL: NEON_URL, BETTER_AUTH_SECRET: SECRET })).toThrow(/DATABASE_PROVIDER is not set/)
    expect(() => loadEnv({ DATABASE_PROVIDER: 'sqlite', BETTER_AUTH_SECRET: SECRET })).toThrow(/DATABASE_PROVIDER must be one of/)
  })

  it('uses Neon with the branch check', () => {
    const env = loadEnv(neon)
    expect(databaseConfig(env)).toEqual({ kind: 'postgres', url: NEON_URL, expectedNeonBranchId: 'br-dev-1' })
    expect(describeDatabase(env)).toBe('Neon branch br-dev-1 (verified)')
  })

  it('fails clearly when the Neon configuration is incomplete or wrong', () => {
    expect(() => loadEnv({ DATABASE_PROVIDER: 'neon', BETTER_AUTH_SECRET: SECRET })).toThrow('DATABASE_PROVIDER=neon needs DATABASE_URL')
    expect(() => loadEnv({ ...neon, NEON_BRANCH_ID: undefined })).toThrow('DATABASE_PROVIDER=neon needs NEON_BRANCH_ID')
    expect(() => loadEnv({ ...neon, DATABASE_URL: 'postgres://localhost/app' })).toThrow('does not point to a Neon host')
    expect(() => loadEnv({ ...neon, NEON_BRANCH_ID: 'production' })).toThrow(/NEON_BRANCH_ID must look like br-/)
    expect(() => loadEnv({ ...neon, DATABASE_URL: 'mysql://nope' })).toThrow(/must start with postgres/)
  })

  it('never includes the connection string in configuration errors', () => {
    for (const source of [{ ...neon, NEON_BRANCH_ID: undefined }, { DATABASE_PROVIDER: 'postgres', DATABASE_URL: NEON_URL, BETTER_AUTH_SECRET: SECRET }]) {
      expect(() => loadEnv(source)).toThrow(expect.objectContaining({ message: expect.not.stringContaining('secret') }))
    }
  })

  it('allows another PostgreSQL server, but sends Neon URLs through the branch check', () => {
    const env = loadEnv({ DATABASE_PROVIDER: 'postgres', DATABASE_URL: 'postgres://u:p@localhost:5432/app', BETTER_AUTH_SECRET: SECRET })
    expect(databaseConfig(env)).toEqual({ kind: 'postgres', url: 'postgres://u:p@localhost:5432/app' })
    expect(() => loadEnv({ DATABASE_PROVIDER: 'postgres', DATABASE_URL: NEON_URL, BETTER_AUTH_SECRET: SECRET })).toThrow(/use DATABASE_PROVIDER=neon/)
  })

  it('uses PGlite only when chosen explicitly, and never in production', () => {
    const env = loadEnv({ DATABASE_PROVIDER: 'pglite', BETTER_AUTH_SECRET: SECRET })
    expect(databaseConfig(env)).toEqual({ kind: 'pglite', dataDir: '.data/pglite' })
    expect(describeDatabase(env)).toBe('PGlite, offline (.data/pglite)')
    expect(() => loadEnv({ DATABASE_PROVIDER: 'pglite', NODE_ENV: 'production', BETTER_AUTH_SECRET: SECRET })).toThrow(/cannot be used in production/)
  })
})

describe('loadEnv: empty values', () => {
  it('treats an empty variable as not set, so an inherited value can be blanked', () => {
    // How the end-to-end tests make sure an exported Neon URL in the shell can't reach them.
    const env = loadEnv({ ...neon, DATABASE_PROVIDER: 'pglite', DATABASE_URL: '', NEON_BRANCH_ID: '' })
    expect(databaseConfig(env)).toEqual({ kind: 'pglite', dataDir: '.data/pglite' })
    expect(() => loadEnv({ ...neon, BETTER_AUTH_SECRET: '' })).toThrow(/BETTER_AUTH_SECRET is not set/)
  })
})

describe('loadEnv: other settings', () => {
  it('has safe defaults and validates values', () => {
    expect(loadEnv(neon)).toMatchObject({ NODE_ENV: 'development', API_PORT: 8787 })
    expect(loadEnv({ ...neon, API_PORT: '9000' }).API_PORT).toBe(9000)
    expect(() => loadEnv({ ...neon, API_PORT: 'eighty' })).toThrow(/API_PORT/)
  })
})

describe('loadEnv: authentication settings', () => {
  it('requires a long random secret for session cookies', () => {
    expect(() => loadEnv({ ...neon, BETTER_AUTH_SECRET: undefined })).toThrow(/BETTER_AUTH_SECRET is not set/)
    expect(() => loadEnv({ ...neon, BETTER_AUTH_SECRET: 'short' })).toThrow(/at least 32 characters/)
  })

  it('uses the local app origin by default and normalises it', () => {
    expect(loadEnv(neon).APP_ORIGIN).toBe('http://localhost:5173')
    expect(loadEnv({ ...neon, APP_ORIGIN: 'https://tasks.example.com/' }).APP_ORIGIN).toBe('https://tasks.example.com')
    expect(() => loadEnv({ ...neon, APP_ORIGIN: 'not a url' })).toThrow(/APP_ORIGIN/)
  })

  it('requires HTTPS in production, so session cookies can be Secure', () => {
    expect(() => loadEnv({ ...neon, NODE_ENV: 'production' })).toThrow(/APP_ORIGIN must use https in production/)
  })

  it('refuses production until the M11 checklist is done: client IP and a real email provider', () => {
    const prod = { ...neon, NODE_ENV: 'production', APP_ORIGIN: 'https://tasks.example.com' }
    expect(() => loadEnv(prod)).toThrow(/Configure the client IP in production/)
    expect(() => loadEnv({ ...prod, TRUSTED_PROXIES: '10.0.0.0/8' })).toThrow(/No email provider is configured for production/)
    expect(() => loadEnv({ ...prod, CLIENT_IP_HEADER: 'x-real-ip' })).toThrow(/No email provider is configured for production/)
  })

  it('validates mail and client-IP settings', () => {
    expect(loadEnv(neon)).toMatchObject({ MAIL_TRANSPORT: 'console', CLIENT_IP_HEADER: 'x-forwarded-for', TRUSTED_PROXIES: [] })
    expect(loadEnv({ ...neon, TRUSTED_PROXIES: '10.0.0.1, 192.168.0.0/16' }).TRUSTED_PROXIES).toEqual(['10.0.0.1', '192.168.0.0/16'])
    expect(() => loadEnv({ ...neon, TRUSTED_PROXIES: 'not-an-ip' })).toThrow(/TRUSTED_PROXIES/)
    expect(() => loadEnv({ ...neon, CLIENT_IP_HEADER: 'X Real IP' })).toThrow(/CLIENT_IP_HEADER/)
    expect(() => loadEnv({ ...neon, MAIL_TRANSPORT: 'sendgrid' })).toThrow(/MAIL_TRANSPORT/)
  })

  it('trusts this computer as the proxy in development, and nothing implicit in production', () => {
    expect(trustedProxies({ TRUSTED_PROXIES: [], NODE_ENV: 'development' })).toEqual(['127.0.0.1', '::1'])
    expect(trustedProxies({ TRUSTED_PROXIES: [], NODE_ENV: 'production' })).toEqual([])
    expect(trustedProxies({ TRUSTED_PROXIES: ['10.0.0.1'], NODE_ENV: 'development' })).toEqual(['10.0.0.1'])
  })

  it('never includes the secret in configuration errors', () => {
    expect(() => loadEnv({ ...neon, BETTER_AUTH_SECRET: 'short-secret-value' })).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('short-secret-value') }),
    )
  })
})
