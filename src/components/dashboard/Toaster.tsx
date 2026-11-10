import { CircleAlert, CircleCheck, X } from 'lucide-react'
import { useCallback, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type ShowToast, type ToastMessage } from '../../hooks/toast'

const DISMISS_AFTER_MS = { success: 4000, error: 8000 } as const

/**
 * Provides useToast() and renders the notifications. The container is a live region that
 * exists from the start, so screen readers announce each new message ("Task deleted").
 *
 * Placement keeps notifications off interactive controls: only the latest one is shown; on
 * large screens it sits in the bottom-left corner, beside the project sidebar and never over
 * the task list; on small screens it sits at the bottom, and AppShell adds bottom padding so
 * the last controls on the page can always be scrolled clear of it.
 */
export function Toaster({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), [])

  const show = useCallback<ShowToast>(
    (message, tone = 'success') => {
      nextId.current += 1
      const id = nextId.current
      setToasts([{ id, message, tone }])
      window.setTimeout(() => dismiss(id), DISMISS_AFTER_MS[tone])
    },
    [dismiss],
  )

  return (
    <ToastContext value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 lg:right-auto lg:w-64 lg:items-stretch"
      >
        {toasts.map((toast) => {
          const Icon = toast.tone === 'error' ? CircleAlert : CircleCheck
          return (
            <div
              key={toast.id}
              className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-control border border-line-strong bg-raised py-1 pl-4 pr-1 text-sm text-ink shadow-card"
            >
              <Icon
                aria-hidden="true"
                className={`size-4.5 shrink-0 ${toast.tone === 'error' ? 'text-danger' : 'text-status-done'}`}
              />
              <p className="flex-1 py-2">{toast.message}</p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
                className="grid size-11 shrink-0 place-items-center rounded-full text-ink-muted hover:text-ink"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext>
  )
}
