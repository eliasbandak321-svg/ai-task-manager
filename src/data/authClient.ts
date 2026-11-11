import { z } from 'zod'
import { RepositoryError } from './errors'

/*
  Authentication from the browser's point of view. Like TaskRepository, components never
  call fetch: they use this interface through the hooks in src/hooks/auth.ts.

  HttpAuthClient talks to Better Auth's endpoints on our own origin (/api/auth). The session
  itself lives in an HttpOnly cookie that JavaScript can't read; the browser sends it
  automatically, and this client only ever sees the public user details.
*/

const LIMITS = { name: 80, email: 254, passwordMin: 8, passwordMax: 128 } as const

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(LIMITS.email, 'Email is too long')
  .pipe(z.email('Enter a valid email address'))

export const signUpInputSchema = z.strictObject({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(LIMITS.name, `Name must be at most ${LIMITS.name} characters`),
  email: emailSchema,
  password: z
    .string()
    .min(LIMITS.passwordMin, `Password must be at least ${LIMITS.passwordMin} characters`)
    .max(LIMITS.passwordMax, `Password must be at most ${LIMITS.passwordMax} characters`),
})

export const signInInputSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(LIMITS.passwordMax, 'Password is too long'),
})

export type SignUpInput = z.input<typeof signUpInputSchema>
export type SignInInput = z.input<typeof signInInputSchema>

/** The signed-in user, as the UI sees them. */
export const sessionUserSchema = z.object({ id: z.string(), name: z.string(), email: z.string() })
export type SessionUser = z.infer<typeof sessionUserSchema>

export interface AuthClient {
  /** The signed-in user, or null when signed out. */
  getSession(): Promise<SessionUser | null>
  signUp(input: SignUpInput): Promise<SessionUser>
  signIn(input: SignInInput): Promise<SessionUser>
  signOut(): Promise<void>
}

/** A sign-up, sign-in or sign-out that failed, with a message for people. */
export class AuthError extends RepositoryError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'AuthError'
  }
}

export const AUTH_MESSAGES = {
  invalidCredentials: 'Incorrect email or password.',
  emailTaken: 'An account with this email already exists. Sign in instead.',
  tooManyAttempts: 'Too many attempts. Please wait a minute and try again.',
  blocked: 'This request was blocked for your security. Reload the page and try again.',
  offline: "Couldn't reach the server. Check your connection and try again.",
  server: 'Something went wrong on the server. Please try again.',
} as const

const userResponseSchema = z.object({ user: sessionUserSchema })
const sessionResponseSchema = z.object({ user: sessionUserSchema }).nullable()
const errorResponseSchema = z.object({ message: z.string().optional() }).loose()
const apiErrorSchema = z.object({ error: z.object({ code: z.string(), message: z.string() }) })

export class HttpAuthClient implements AuthClient {
  private readonly baseUrl: string
  private readonly fetchImpl: typeof globalThis.fetch

  constructor({ baseUrl = '/api/auth', fetch = (...args) => globalThis.fetch(...args) }: { baseUrl?: string; fetch?: typeof globalThis.fetch } = {}) {
    this.baseUrl = baseUrl
    this.fetchImpl = fetch
  }

  async getSession(): Promise<SessionUser | null> {
    const json = await this.request('GET', '/get-session')
    const parsed = sessionResponseSchema.safeParse(json)
    if (!parsed.success) throw new AuthError(AUTH_MESSAGES.server, { cause: parsed.error })
    return parsed.data ? pickUser(parsed.data.user) : null
  }

  async signUp(input: SignUpInput): Promise<SessionUser> {
    const body = signUpInputSchema.parse(input)
    return this.userFrom(await this.request('POST', '/sign-up/email', body))
  }

  async signIn(input: SignInInput): Promise<SessionUser> {
    const body = { ...signInInputSchema.parse(input), rememberMe: true }
    return this.userFrom(await this.request('POST', '/sign-in/email', body))
  }

  async signOut(): Promise<void> {
    await this.request('POST', '/sign-out', {})
  }

  private userFrom(json: unknown): SessionUser {
    const parsed = userResponseSchema.safeParse(json)
    if (!parsed.success) throw new AuthError(AUTH_MESSAGES.server, { cause: parsed.error })
    return pickUser(parsed.data.user)
  }

  private async request(method: 'GET' | 'POST', path: string, body?: unknown): Promise<unknown> {
    let response: Response
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method,
        headers: body === undefined ? { Accept: 'application/json' } : { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        credentials: 'same-origin',
      })
    } catch (error) {
      throw new AuthError(AUTH_MESSAGES.offline, { cause: error })
    }

    const json: unknown = await response.json().catch(() => null)
    if (response.ok) return json
    throw toAuthError(response.status, json)
  }
}

/** Only the public fields; Better Auth also returns e.g. timestamps the UI doesn't need. */
function pickUser(user: SessionUser): SessionUser {
  return { id: user.id, name: user.name, email: user.email }
}

function toAuthError(status: number, json: unknown): AuthError {
  if (status === 401) return new AuthError(AUTH_MESSAGES.invalidCredentials)
  if (status === 422) return new AuthError(AUTH_MESSAGES.emailTaken)
  if (status === 429) return new AuthError(AUTH_MESSAGES.tooManyAttempts)
  if (status === 403) {
    // Our API's origin check explains itself (in development it names the right address).
    const apiError = apiErrorSchema.safeParse(json).data?.error
    return new AuthError(apiError?.code === 'FORBIDDEN_ORIGIN' ? apiError.message : AUTH_MESSAGES.blocked)
  }
  if (status >= 400 && status < 500) {
    const message = errorResponseSchema.safeParse(json).data?.message
    if (message) return new AuthError(message)
  }
  return new AuthError(AUTH_MESSAGES.server, { cause: status })
}
