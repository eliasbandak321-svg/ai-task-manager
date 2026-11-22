import { AuthError, type AuthClient, type SessionUser } from '../data/authClient'
import { LOCAL_USER_ID } from './inMemoryWorkspace'

/** The fictional visitor the demo is "signed in" as. example.com is reserved for examples. */
export const DEMO_USER: SessionUser = { id: LOCAL_USER_ID, name: 'Demo visitor', email: 'demo@example.com' }

export const DEMO_ACCOUNTS_MESSAGE = 'Accounts aren’t available in the demo. Everything you see is sample data in this browser tab.'

/**
 * The demo's AuthClient (M11, VITE_DEMO=1): there are no accounts and no server, so the visitor
 * is always the demo user. Real authentication lives in HttpAuthClient and is untouched; the
 * demo build simply never talks to an API.
 */
export function createDemoAuthClient(): AuthClient {
  const unavailable = async (): Promise<never> => {
    throw new AuthError(DEMO_ACCOUNTS_MESSAGE)
  }
  return {
    getSession: async () => DEMO_USER,
    signUp: unavailable,
    signIn: unavailable,
    // "Exit demo" leaves for the landing page; the demo user stays signed in.
    signOut: async () => undefined,
    requestPasswordReset: unavailable,
    resetPassword: unavailable,
  }
}
