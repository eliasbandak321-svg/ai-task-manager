import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { RequestPasswordResetInput, ResetPasswordInput, SessionUser, SignInInput, SignUpInput } from '../data/authClient'
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

/** Creates the account; the session starts later, when the confirmation link is opened. */
export function useSignUp() {
  const client = useAuthClient()
  return useMutation({ mutationFn: (input: SignUpInput) => client.signUp(input) })
}

export function useRequestPasswordReset() {
  const client = useAuthClient()
  return useMutation({ mutationFn: (input: RequestPasswordResetInput) => client.requestPasswordReset(input) })
}

/** A reset signs out every session, including this browser's: forget the cached data too. */
export function useResetPassword() {
  const client = useAuthClient()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ResetPasswordInput) => client.resetPassword(input),
    onSuccess: () => {
      queryClient.removeQueries()
      queryClient.setQueryData(sessionQueryKey, null)
    },
  })
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
