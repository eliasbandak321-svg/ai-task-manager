import {
  AUTH_MESSAGES,
  AuthError,
  requestPasswordResetInputSchema,
  signInInputSchema,
  signUpInputSchema,
  type AuthClient,
  type SessionUser,
} from '../data/authClient'

export const TEST_USER: SessionUser = { id: '00000000-0000-4000-8000-0000000000aa', name: 'Ada Lovelace', email: 'ada@example.test' }
export const TEST_PASSWORD = 'correct horse battery'
/** The only reset token the fake accepts (the real one comes from the email link). */
export const VALID_RESET_TOKEN = 'valid-reset-token'

interface Account {
  user: SessionUser
  password: string
  verified: boolean
}

/**
 * An in-memory AuthClient for UI tests: same interface and the same errors as HttpAuthClient,
 * with one existing, confirmed account (TEST_USER / TEST_PASSWORD). `signedIn` sets the
 * starting state. New sign-ups stay unconfirmed until `confirmEmail` (the link in the email).
 */
export function createFakeAuthClient({ signedIn = true }: { signedIn?: boolean } = {}) {
  const accounts = new Map<string, Account>([[TEST_USER.email, { user: TEST_USER, password: TEST_PASSWORD, verified: true }]])
  let current: SessionUser | null = signedIn ? TEST_USER : null
  let nextId = 0xbb
  const resetRequests: string[] = []

  const client: AuthClient & {
    readonly currentUser: SessionUser | null
    readonly resetRequests: readonly string[]
    accountFor(email: string): Account | undefined
    confirmEmail(email: string): void
    expireSession(): void
  } = {
    get currentUser() {
      return current
    },
    get resetRequests() {
      return resetRequests
    },
    accountFor(email) {
      return accounts.get(email)
    },
    confirmEmail(email) {
      const account = accounts.get(email)
      if (account) account.verified = true
    },
    expireSession() {
      current = null
    },
    async getSession() {
      return current
    },
    async signUp(input) {
      const parsed = signUpInputSchema.parse(input)
      if (accounts.has(parsed.email)) return // same answer as a new account (no enumeration)
      nextId += 1
      const user = { id: `00000000-0000-4000-8000-${nextId.toString(16).padStart(12, '0')}`, name: parsed.name, email: parsed.email }
      accounts.set(parsed.email, { user, password: parsed.password, verified: false })
    },
    async signIn(input) {
      const parsed = signInInputSchema.parse(input)
      const account = accounts.get(parsed.email)
      if (!account || account.password !== parsed.password) throw new AuthError(AUTH_MESSAGES.invalidCredentials)
      if (!account.verified) throw new AuthError(AUTH_MESSAGES.emailNotVerified)
      current = account.user
      return account.user
    },
    async signOut() {
      current = null
    },
    async requestPasswordReset(input) {
      resetRequests.push(requestPasswordResetInputSchema.parse(input).email)
    },
    async resetPassword({ token, newPassword }) {
      if (token !== VALID_RESET_TOKEN) throw new AuthError(AUTH_MESSAGES.invalidResetLink)
      const account = accounts.get(TEST_USER.email)
      if (account) account.password = newPassword
      current = null
    },
  }
  return client
}
