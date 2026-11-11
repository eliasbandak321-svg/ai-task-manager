import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SessionUser, SignInInput, SignUpInput } from '../data/authClient'
import { useAuthClient } from '../data/authClientContext'

/*
  The session in TanStack Query, under one key. Signing in, up or out *replaces the whole
  cache*: data loaded for one user must never be shown to the next one on the same browser.
*/

export const sessionQueryKey = ['session'] as const

export function useSession() {
  const client = useAuthClient()
  return useQuery({ queryKey: sessionQueryKey, queryFn: () => client.getSession(), staleTime: 60_000 })
}

function useStartSession() {
  const queryClient = useQueryClient()
  return (user: SessionUser) => {
    queryClient.removeQueries()
    queryClient.setQueryData(sessionQueryKey, user)
  }
}

export function useSignIn() {
  const client = useAuthClient()
  const startSession = useStartSession()
  return useMutation({ mutationFn: (input: SignInInput) => client.signIn(input), onSuccess: startSession })
}

export function useSignUp() {
  const client = useAuthClient()
  const startSession = useStartSession()
  return useMutation({ mutationFn: (input: SignUpInput) => client.signUp(input), onSuccess: startSession })
}

export function useSignOut() {
  const client = useAuthClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => client.signOut(),
    onSuccess: () => {
      queryClient.removeQueries()
      queryClient.setQueryData(sessionQueryKey, null)
    },
  })
}
