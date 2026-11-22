import { ArrowLeft, LogOut, Settings } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useSession, useSignOut } from '../../hooks/auth'
import { useToast } from '../../hooks/toast'
import { errorMessage } from '../../lib/format'
import { useIsDemo } from '../../demo/demoContext'

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '?') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')).toUpperCase()
}

/**
 * The signed-in user's menu in the top bar (M10): who is signed in, Settings, back to the
 * website, and sign out. A menu button: Enter/Space/ArrowDown open it, arrows move, Escape closes.
 */
export function AccountMenu() {
  const { data: user } = useSession()
  const signOut = useSignOut()
  const isDemo = useIsDemo()
  const navigate = useNavigate()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    const onPointer = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node) && !buttonRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open])

  if (!user) return null

  async function handleSignOut() {
    setOpen(false)
    try {
      await signOut.mutateAsync()
      navigate('/login', { replace: true })
    } catch (error) {
      toast(errorMessage(error), 'error')
    }
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
    const index = items.indexOf(document.activeElement as HTMLElement)
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      items[(index + 1) % items.length]?.focus()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      items[(index - 1 + items.length) % items.length]?.focus()
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      setOpen(false)
      if (event.key === 'Escape') buttonRef.current?.focus()
    }
  }

  const itemClass = 'flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm text-ink hover:bg-raised focus-visible:bg-raised'

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={`Account: ${user.name}`}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            setOpen(true)
          }
        }}
        className="avatar-gradient grid size-10 place-items-center rounded-full text-xs font-semibold text-on-tint ring-1 ring-line"
      >
        {initials(user.name)}
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          tabIndex={-1}
          aria-label="Account"
          onKeyDown={onMenuKeyDown}
          className="animate-menu absolute right-0 top-[calc(100%+0.5rem)] z-50 w-64 rounded-2xl border border-line bg-surface p-1.5 shadow-card"
        >
          <div className="border-b border-line px-3 pt-2 pb-3 text-sm">
            <p className="truncate font-medium text-ink">{user.name}</p>
            <p className="truncate text-ink-subtle">{user.email}</p>
          </div>
          <div className="pt-1.5">
            <Link role="menuitem" to="/app/settings" className={itemClass} onClick={() => setOpen(false)}>
              <Settings aria-hidden="true" className="size-4" /> Settings
            </Link>
            <Link role="menuitem" to="/" className={itemClass} onClick={() => setOpen(false)}>
              <ArrowLeft aria-hidden="true" className="size-4" /> {isDemo ? 'Exit demo' : 'Back to website'}
            </Link>
            {/* The demo has no accounts to sign out of (M11). */}
            {!isDemo && (
              <button role="menuitem" type="button" className={itemClass} onClick={() => void handleSignOut()} disabled={signOut.isPending}>
                <LogOut aria-hidden="true" className="size-4" /> {signOut.isPending ? 'Signing out…' : 'Sign out'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
