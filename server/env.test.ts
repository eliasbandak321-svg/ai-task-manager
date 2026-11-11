import { describe, expect, it } from 'vitest'
import { developmentUser } from './auth'
import { databaseConfig, loadEnv } from './env'

describe('loadEnv', () => {
  it('uses safe local defaults', () => {
    const env = loadEnv({})
    expect(env).toMatchObject({ NODE_ENV: 'development', API_PORT: 8787, PGLITE_DIR: '.data/pglite' })
    expect(databaseConfig(env)).toEqual({ kind: 'pglite', dataDir: '.data/pglite' })
  })

  it('uses PostgreSQL when DATABASE_URL is set', () => {
    const env = loadEnv({ DATABASE_URL: 'postgres://user:pass@localhost:5432/app', API_PORT: '9000' })
    expect(env.API_PORT).toBe(9000)
    expect(databaseConfig(env)).toEqual({
      kind: 'postgres',
      url: 'postgres://user:pass@localhost:5432/app',
      expectedNeonBranchId: undefined,
    })
  })

  it('fails fast with a clear message on invalid values', () => {
    expect(() => loadEnv({ DATABASE_URL: 'mysql://nope' })).toThrow(/DATABASE_URL must start with postgres/)
    expect(() => loadEnv({ API_PORT: 'eighty' })).toThrow(/API_PORT/)
    expect(() => loadEnv({ DEV_USER_ID: 'admin' })).toThrow(/DEV_USER_ID/)
    expect(() => loadEnv({ NEON_BRANCH_ID: 'production' })).toThrow(/NEON_BRANCH_ID/)
  })

  it('requires the branch check for Neon databases', () => {
    const neon = 'postgresql://user:secret@ep-example-123.c-1.us-east-1.aws.neon.tech/neondb?sslmode=verify-full'
    expect(() => loadEnv({ DATABASE_URL: neon })).toThrow('NEON_BRANCH_ID is required when DATABASE_URL points to Neon')
    expect(databaseConfig(loadEnv({ DATABASE_URL: neon, NEON_BRANCH_ID: 'br-dev-1' }))).toMatchObject({
      expectedNeonBranchId: 'br-dev-1',
    })
  })

  it('never includes the connection string in configuration errors', () => {
    expect(() => loadEnv({ DATABASE_URL: 'postgresql://user:secret@ep-x.aws.neon.tech/db' })).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('secret') }),
    )
  })

  it('requires a real database in production', () => {
    expect(() => loadEnv({ NODE_ENV: 'production' })).toThrow('DATABASE_URL is required in production.')
  })
})

describe('developmentUser', () => {
  it('always answers with the configured user during development', async () => {
    const resolve = developmentUser('00000000-0000-4000-8000-000000000001', 'development')
    await expect(resolve({} as never)).resolves.toBe('00000000-0000-4000-8000-000000000001')
  })

  it('can never be used in production', () => {
    expect(() => developmentUser('00000000-0000-4000-8000-000000000001', 'production')).toThrow(/never be used in production/)
  })
})
