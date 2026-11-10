/**
 * Everything a pure function needs to create an entity, without doing I/O itself.
 *
 * Generating ids and reading the clock are side effects, so the caller (the repository in M5,
 * the API in M6) supplies them. That keeps domain functions deterministic and easy to test:
 * the same inputs always give the same output.
 *
 * `userId` always comes from the authenticated session, never from user input.
 */
export interface CreateContext {
  id: string
  userId: string
  now: Date
}
