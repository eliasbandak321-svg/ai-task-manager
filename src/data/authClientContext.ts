import { createContext, useContext } from 'react'
import type { AuthClient } from './authClient'

/** Which AuthClient the app uses: HttpAuthClient in the app, a fake in UI tests. */
export const AuthClientContext = createContext<AuthClient | null>(null)

export function useAuthClient(): AuthClient {
  const client = useContext(AuthClientContext)
  if (!client) throw new Error('useAuthClient must be used inside an AuthClientContext provider')
  return client
}
