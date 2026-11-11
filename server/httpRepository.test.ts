import { describe, expect, it } from 'vitest'
import { AuthRequiredError, RepositoryError } from '../src/data/errors'
import { HttpRepository } from '../src/data/httpRepository'
import { describeRepositoryContract } from '../src/test/repositoryContract'
import { createApp } from './app'
import { createTestUser, setupTestDatabase } from './test/testDatabase'

const database = setupTestDatabase()

/**
 * An HttpRepository wired to the real Hono app in memory: browser adapter → HTTP → API →
 * database, end to end, without opening a network port.
 */
function connectedRepository(userId: string) {
  const app = createApp({ db: database(), resolveUserId: async () => userId, trustedOrigins: [] })
  return new HttpRepository({ baseUrl: 'http://app.test/api', fetch: async (input, init) => app.request(input, init) })
}

// The third adapter to pass the same contract, so the dashboard behaves identically on it.
describeRepositoryContract('HttpRepository → API → PostgreSQL', async () =>
  connectedRepository(await createTestUser(database())),
)

describe('HttpRepository failures', () => {
  it('reports an unreachable server with a friendly message', async () => {
    const repo = new HttpRepository({
      fetch: async () => {
        throw new TypeError('fetch failed')
      },
    })
    await expect(repo.listTasks()).rejects.toEqual(
      new RepositoryError("Couldn't reach the server. Check your connection and try again."),
    )
  })

  it('never shows server error details', async () => {
    const repo = new HttpRepository({
      fetch: async () => new Response('<html>502 Bad Gateway: upstream db-1 timeout</html>', { status: 502 }),
    })
    await expect(repo.listProjects()).rejects.toEqual(
      new RepositoryError('Something went wrong on the server. Please try again.'),
    )
  })

  it('refuses responses that don’t match the expected shape', async () => {
    const repo = new HttpRepository({ fetch: async () => Response.json([{ id: 1, title: 'Not a task' }]) })
    await expect(repo.listTasks()).rejects.toEqual(
      new RepositoryError('The server sent an unexpected response. Please reload the page.'),
    )
  })

  it('asks the user to sign in when the API says 401', async () => {
    const repo = new HttpRepository({
      fetch: async () => Response.json({ error: { code: 'UNAUTHENTICATED', message: 'x' } }, { status: 401 }),
    })
    const error = await repo.listTasks().catch((caught: unknown) => caught)
    // A RepositoryError subclass: the app reacts to it by showing the login page.
    expect(error).toBeInstanceOf(AuthRequiredError)
    expect(error).toBeInstanceOf(RepositoryError)
    expect((error as Error).message).toBe('Please sign in to continue.')
  })

  it('uses the API’s message for other client errors', async () => {
    const repo = new HttpRepository({
      fetch: async () => Response.json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Too large.' } }, { status: 413 }),
    })
    await expect(repo.listTasks()).rejects.toEqual(new RepositoryError('Too large.'))
  })

  it('sends JSON to the same-origin API path with the right method', async () => {
    const requests: { url: string; init?: RequestInit }[] = []
    const repo = new HttpRepository({
      fetch: async (input, init) => {
        requests.push({ url: String(input), init })
        return new Response(null, { status: 204 })
      },
    })
    await repo.deleteTask('00000000-0000-4000-8000-000000000001')
    expect(requests).toEqual([
      {
        url: '/api/tasks/00000000-0000-4000-8000-000000000001',
        init: expect.objectContaining({ method: 'DELETE', credentials: 'same-origin' }),
      },
    ])
  })
})
