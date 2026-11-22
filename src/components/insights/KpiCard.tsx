import type { ReactNode } from 'react'

interface KpiCardProps {
  label: string
  value: ReactNode
  /** What the figure covers: a period ("Last 30 days"), "Now", or "Next 7 days". */
  scope: string
  children?: ReactNode
  tone?: 'default' | 'warn'
}

/** A headline figure with its scope, so a period metric is never confused with a snapshot. */
export function KpiCard({ label, value, scope, children, tone = 'default' }: KpiCardProps) {
  return (
    <div className="flex flex-col gap-1.5 rounded-card border border-line bg-surface p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-sm text-ink-muted">
        <dt>{label}</dt>
        <span className="rounded-full bg-raised px-2 py-0.5 font-mono text-[0.625rem] tracking-[0.06em] text-ink-subtle uppercase">{scope}</span>
      </div>
      <dd className={`font-display text-[1.9rem] leading-tight font-semibold tracking-tight tabular-nums ${tone === 'warn' ? 'text-priority-medium' : 'text-ink'}`}>{value}</dd>
      {children && <p className="text-sm text-ink-subtle">{children}</p>}
    </div>
  )
}
