import { LogOut } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useSession, useSignOut } from '../../hooks/auth'
import { useToast } from '../../hooks/toast'
import { errorMessage } from '../../lib/format'
import { Button } from '../ui/Button'

/** Who is signed in, and the way out. Shown in the dashboard header. */
export function AccountMenu() {
  const { data: user } = useSession()
  const signOut = useSignOut()
  const navigate = useNavigate()
  const toast = useToast()

  if (!user) return null

  async function handleSignOut() {
    try {
      await signOut.mutateAsync()
      navigate('/login', { replace: true })
    } catch (error) {
      toast(errorMessage(error), 'error')
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-3">
      <p className="hidden min-w-0 text-right text-sm leading-tight sm:block">
        <span className="block truncate font-medium text-ink">{user.name}</span>
        <span className="block truncate text-ink-subtle">{user.email}</span>
      </p>
      <Button variant="secondary" onClick={() => void handleSignOut()} disabled={signOut.isPending}>
        <LogOut aria-hidden="true" className="size-4" />
        {signOut.isPending ? 'Signing out…' : 'Sign out'}
      </Button>
    </div>
  )
}
