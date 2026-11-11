import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { sessionQueryKey } from '../hooks/auth'
import { AuthRequiredError } from './errors'

/**
 * The app's TanStack Query client. When any request reports that the session is gone
 * (expired, or signed out in another tab), the cached session is cleared, and RequireAuth
 * sends the user to the login page (and back to where they were afterwards).
 */
export function createQueryClient({ retry = true }: { retry?: boolean } = {}): QueryClient {
  const onError = (error: unknown) => {
    if (error instanceof AuthRequiredError) queryClient.setQueryData(sessionQueryKey, null)
  }
  const queryClient: QueryClient = new QueryClient({
    queryCache: new QueryCache({ onError }),
    mutationCache: new MutationCache({ onError }),
    defaultOptions: {
      // Retry once on network or server errors, never when signed out.
      // (Tests turn retries off, so a failure shows up immediately.)
      queries: { retry: (failures, error) => retry && !(error instanceof AuthRequiredError) && failures < 1 },
      mutations: { retry: false },
    },
  })
  return queryClient
}
