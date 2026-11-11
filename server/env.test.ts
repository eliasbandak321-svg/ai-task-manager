import { describe, expect, it } from 'vitest'
import { developmentUser } from './auth'
import { databaseConfig, describeDatabase, loadEnv } from './env'

const NEON_URL = 'postgresql://user:secret@ep-example-123.c-1.us-east-1.aws.neon.tech/neondb?sslmode=verify-full'
const neon = { DATABASE_PROVIDER: 'neon', DATABASE_URL: NEON_URL, NEON_BRANCH_ID: 'br-dev-1' }

describe('loadEnv: choosing the database', () => {
  it('requires an explicit database provider: no silent fallback', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_PROVIDER is not set/)
    expect(() => loadEnv({ DATABASE_URL: NEON_URL })).toThrow(/DATABASE_PROVIDER is not set/)
    expect(() => loadEnv({ DATABASE_PROVIDER: 'sqlite' })).toThrow(/DATABASE_PROVIDER must be one of/)
  })

  it('uses Neon with the branch check', () => {
    const env = loadEnv(neon)
    expect(databaseConfig(env)).toEqual({ kind: 'postgres', url: NEON_URL, expectedNeonBranchId: 'br-dev-1' })
    expect(describeDatabase(env)).toBe('Neon branch br-dev-1 (verified)')
  })

  it('fails clearly when the Neon configuration is incomplete or wrong', () => {
    expect(() => loadEnv({ DATABASE_PROVIDER: 'neon' })).toThrow('DATABASE_PROVIDER=neon needs DATABASE_URL')
    expect(() => loadEnv({ ...neon, NEON_BRANCH_ID: undefined })).toThrow('DATABASE_PROVIDER=neon needs NEON_BRANCH_ID')
    expect(() => loadEnv({ ...neon, DATABASE_URL: 'postgres://localhost/app' })).toThrow('does not point to a Neon host')
    expect(() => loadEnv({ ...neon, NEON_BRANCH_ID: 'production' })).toThrow(/NEON_BRANCH_ID must look like br-/)
    expect(() => loadEnv({ ...neon, DATABASE_URL: 'mysql://nope' })).toThrow(/must start with postgres/)
  })

  it('never includes the connection string in configuration errors', () => {
    for (const source of [{ ...neon, NEON_BRANCH_ID: undefined }, { DATABASE_PROVIDER: 'postgres', DATABASE_URL: NEON_URL }]) {
      expect(() => loadEnv(source)).toThrow(expect.objectContaining({ message: expect.not.stringContaining('secret') }))
    }
  })

  it('allows another PostgreSQL server, but sends Neon URLs through the branch check', () => {
    const env = loadEnv({ DATABASE_PROVIDER: 'postgres', DATABASE_URL: 'postgres://u:p@localhost:5432/app' })
    expect(databaseConfig(env)).toEqual({ kind: 'postgres', url: 'postgres://u:p@localhost:5432/app' })
    expect(() => loadEnv({ DATABASE_PROVIDER: 'postgres', DATABASE_URL: NEON_URL })).toThrow(/use DATABASE_PROVIDER=neon/)
  })

  it('uses PGlite only when chosen explicitly, and never in production', () => {
    const env = loadEnv({ DATABASE_PROVIDER: 'pglite' })
    expect(databaseConfig(env)).toEqual({ kind: 'pglite', dataDir: '.data/pglite' })
    expect(describeDatabase(env)).toBe('PGlite, offline (.data/pglite)')
    expect(() => loadEnv({ DATABASE_PROVIDER: 'pglite', NODE_ENV: 'production' })).toThrow(/cannot be used in production/)
  })
})

describe('loadEnv: other settings', () => {
  it('has safe defaults and validates values', () => {
    expect(loadEnv(neon)).toMatchObject({ NODE_ENV: 'development', API_PORT: 8787 })
    expect(loadEnv({ ...neon, API_PORT: '9000' }).API_PORT).toBe(9000)
    expect(() => loadEnv({ ...neon, API_PORT: 'eighty' })).toThrow(/API_PORT/)
    expect(() => loadEnv({ ...neon, DEV_USER_ID: 'admin' })).toThrow(/DEV_USER_ID/)
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
