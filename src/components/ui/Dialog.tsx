import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Button } from './Button'

interface DialogProps {
  title: string
  /** Short text read out together with the title when the dialog opens. */
  description?: ReactNode
  onClose: () => void
  children: ReactNode
}

/**
 * A modal dialog built on the native <dialog> element. `showModal()` gives us, for free:
 * focus kept inside the dialog, the rest of the page made inert, Escape to close, and
 * correct screen reader semantics.
 *
 * Render it only while it's open ({open && <Dialog …/>}), so each opening starts with fresh
 * form state. Focus goes to the element marked `data-autofocus` (or the first focusable one),
 * and returns to where it was when the dialog closes.
 */
export function Dialog({ title, description, onClose, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog.showModal()
    dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus()

    return () => {
      if (dialog.open) dialog.close()
      // The opener may be gone (e.g. the deleted task's row); then fall back to the main region.
      const target = previous?.isConnected ? previous : document.getElementById('main')
      target?.focus()
    }
  }, [])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      // Escape fires "cancel". We let React state decide whether the dialog is open.
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      // Browsers may close a dialog without a cancelable "cancel" event (Chrome does after
      // repeated Escape presses). Reacting to "close" too keeps React state in sync.
      // The event arrives asynchronously, so only act if the dialog is still closed by then:
      // React's StrictMode closes and immediately reopens it during development.
      onClose={(event) => {
        if (!event.currentTarget.open) onClose()
      }}
      className="m-auto w-full max-w-lg bg-transparent p-4 text-ink backdrop:bg-night/80 backdrop:backdrop-blur-sm"
    >
      <div className="rounded-card border border-line-strong bg-surface p-5 shadow-card sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id={titleId} className="pt-2 font-display text-h3 font-semibold text-ink">
            {title}
          </h2>
          <Button variant="ghost" iconOnly aria-label="Close dialog" onClick={onClose} className="-mr-2 -mt-1">
            <X aria-hidden="true" className="size-5" />
          </Button>
        </div>
        {description && (
          <div id={descriptionId} className="mt-2 space-y-2 text-sm text-ink-muted">
            {description}
          </div>
        )}
        {children}
      </div>
    </dialog>
  )
}
