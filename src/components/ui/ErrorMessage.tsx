import { AlertTriangle } from 'lucide-react'
import { Button } from './Button'

interface ErrorProps {
  title: string
  message: string
  onRetry?: () => void
}

/** Shown when loading fails. `role="alert"` announces it immediately. */
export function ErrorMessage({ title, message, onRetry }: ErrorProps) {
  return (
    <div role="alert" className="rounded-card border border-danger/40 bg-surface p-6">
      <div className="flex items-start gap-3">
        <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-danger" />
        <div className="space-y-1">
          <p className="font-semibold text-ink">{title}</p>
          <p className="text-sm text-ink-muted">{message}</p>
        </div>
      </div>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry} className="mt-4">
          Try again
        </Button>
      )}
    </div>
  )
}
