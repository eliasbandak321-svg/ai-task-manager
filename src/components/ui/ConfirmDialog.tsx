import type { ReactNode } from 'react'
import { Button } from './Button'
import { Dialog } from './Dialog'

interface ConfirmDialogProps {
  title: string
  /** What will happen, in plain words. Announced with the title. */
  description: ReactNode
  confirmLabel: string
  pendingLabel?: string
  onConfirm: () => void
  onCancel: () => void
  pending?: boolean
  error?: string | null
}

/**
 * Confirmation for destructive actions. Focus starts on Cancel, so pressing Enter by
 * reflex never deletes anything; Escape and the close button also cancel.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  pendingLabel = 'Deleting…',
  onConfirm,
  onCancel,
  pending = false,
  error = null,
}: ConfirmDialogProps) {
  return (
    <Dialog title={title} description={description} onClose={onCancel}>
      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button variant="secondary" data-autofocus onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={pending}>
          {pending ? pendingLabel : confirmLabel}
        </Button>
      </div>
    </Dialog>
  )
}
