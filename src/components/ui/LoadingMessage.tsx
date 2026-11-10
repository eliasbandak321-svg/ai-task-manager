import { LoaderCircle } from 'lucide-react'

interface LoadingProps {
  label: string
}

/** Shown while data loads. `role="status"` lets screen readers announce it politely. */
export function LoadingMessage({ label }: LoadingProps) {
  return (
    <output className="flex items-center gap-3 rounded-card border border-line bg-surface p-6 text-sm text-ink-muted">
      <LoaderCircle aria-hidden="true" className="size-5 motion-safe:animate-spin" />
      {label}
    </output>
  )
}
