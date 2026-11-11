import { describe, expect, it } from 'vitest'
import { assertNeonBranch } from './client'

const answering = (branch: string | null) => async () => ({ rows: [{ branch }] })

describe('assertNeonBranch', () => {
  it('accepts the expected Neon branch', async () => {
    await expect(assertNeonBranch(answering('br-dev-1'), 'br-dev-1')).resolves.toBeUndefined()
  })

  it('refuses another branch, e.g. production by mistake', async () => {
    await expect(assertNeonBranch(answering('br-prod-9'), 'br-dev-1')).rejects.toThrow(
      'Refusing to use this database: NEON_BRANCH_ID is br-dev-1, but the connection points to br-prod-9.',
    )
  })

  it('refuses a database that is not a Neon branch at all', async () => {
    await expect(assertNeonBranch(answering(null), 'br-dev-1')).rejects.toThrow(/not a Neon branch/)
  })
})
