import type { InsightsReport } from '../../domain'

const ROWS = [
  { key: 'done', label: 'Completed', className: 'bg-status-done' },
  { key: 'inProgress', label: 'In progress', className: 'bg-line-sky' },
  { key: 'todo', label: 'To do', className: 'bg-line-lav' },
  { key: 'overdue', label: 'Overdue', className: 'bg-danger' },
] as const

/** Current task status as one stacked bar and a legend with counts; each task counted once. */
export function StatusBreakdown({ status }: { status: InsightsReport['status'] }) {
  const percent = (value: number) => (status.total ? Math.round((value / status.total) * 100) : 0)
  return (
    <div>
      <div aria-hidden="true" className="flex h-3.5 gap-0.5 overflow-hidden rounded-full bg-raised">
        {ROWS.filter((row) => status[row.key] > 0).map((row) => (
          <i key={row.key} className={`block h-full min-w-1 ${row.className}`} style={{ flex: status[row.key] }} />
        ))}
      </div>
      <ul className="mt-4 divide-y divide-line text-sm">
        {ROWS.map((row) => (
          <li key={row.key} className="grid grid-cols-[0.75rem_minmax(0,1fr)_auto_2.75rem] items-center gap-3 py-2">
            <i aria-hidden="true" className={`size-3 rounded-[3px] ${row.className}`} />
            <span className="text-ink">{row.label}</span>
            <span className="font-semibold tabular-nums text-ink">{status[row.key]}</span>
            <span className="text-right font-mono text-xs text-ink-subtle">{percent(status[row.key])}%</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-subtle">Overdue: not done and past the due date. Those tasks are not also counted as "In progress" or "To do".</p>
    </div>
  )
}
