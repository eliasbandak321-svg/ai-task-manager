import type { ReactNode } from 'react'

interface EmptyProps {
  title: string
  children?: ReactNode
  action?: ReactNode
}

/** Shown when there is nothing to list, with a hint about what to do next. */
export function EmptyMessage({ title, children, action }: EmptyProps) {
  return (
    <div className="rounded-card border border-dashed border-line-strong p-8 text-center">
      <p className="font-display font-semibold text-ink">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-ink-muted">{children}</div>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}
