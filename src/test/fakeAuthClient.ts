import { AUTH_MESSAGES, AuthError, signInInputSchema, signUpInputSchema, type AuthClient, type SessionUser } from '../data/authClient'

export const TEST_USER: SessionUser = { id: '00000000-0000-4000-8000-0000000000aa', name: 'Ada Lovelace', email: 'ada@example.test' }
export const TEST_PASSWORD = 'correct horse battery'

/**
 * An in-memory AuthClient for UI tests: same interface and the same errors as HttpAuthClient,
 * with one existing account (TEST_USER / TEST_PASSWORD). `signedIn` sets the starting state.
 */
export function createFakeAuthClient({ signedIn = true }: { signedIn?: boolean } = {}) {
  const accounts = new Map<string, { user: SessionUser; password: string }>([
    [TEST_USER.email, { user: TEST_USER, password: TEST_PASSWORD }],
  ])
  let current: SessionUser | null = signedIn ? TEST_USER : null
  let nextId = 0xbb

  const client: AuthClient & { readonly currentUser: SessionUser | null; expireSession(): void } = {
    get currentUser() {
      return current
    },
    expireSession() {
      current = null
    },
    async getSession() {
      return current
    },
    async signUp(input) {
      const parsed = signUpInputSchema.parse(input)
      if (accounts.has(parsed.email)) throw new AuthError(AUTH_MESSAGES.emailTaken)
      nextId += 1
      const user = { id: `00000000-0000-4000-8000-${nextId.toString(16).padStart(12, '0')}`, name: parsed.name, email: parsed.email }
      accounts.set(parsed.email, { user, password: parsed.password })
      current = user
      return user
    },
    async signIn(input) {
      const parsed = signInInputSchema.parse(input)
      const account = accounts.get(parsed.email)
      if (!account || account.password !== parsed.password) throw new AuthError(AUTH_MESSAGES.invalidCredentials)
      current = account.user
      return account.user
    },
    async signOut() {
      current = null
    },
  }
  return client
}
