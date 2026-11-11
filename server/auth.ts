import type { Context } from 'hono'

/*
  Who is making the request? The API asks a `ResolveUserId` function and nothing else.
  The user id never comes from the request body or the URL (docs/architecture.md §6).

  - M6: `developmentUser` always answers with the one local development user.
  - M7: replaced by a resolver that reads the Better Auth session cookie.
  Tests pass their own resolver to act as different users.
*/

export type ResolveUserId = (c: Context) => Promise<string | null>

/**
 * The single-user stand-in used until accounts exist. It refuses to run in production,
 * so a deployment can never accidentally serve everyone the same data.
 */
export function developmentUser(userId: string, nodeEnv: string): ResolveUserId {
  if (nodeEnv === 'production') {
    throw new Error('The development user must never be used in production. Configure real authentication.')
  }
  return async () => userId
}
