import { useId } from 'react'
import { PRIORITY_LABELS, STATUS_LABELS, TASK_PRIORITIES, TASK_STATUSES, type TaskStats } from '../../domain'
import { pluralize } from '../../lib/format'
import { ProgressBar } from '../ui/ProgressBar'

interface StatsPanelProps {
  title: string
  stats: TaskStats
}

const statusDot = { todo: 'bg-status-todo', in_progress: 'bg-status-progress', done: 'bg-status-done' } as const

/** Completion progress and counts, all computed by the domain's computeTaskStats. */
export function StatsPanel({ title, stats }: StatsPanelProps) {
  const headingId = useId()
  const done = stats.byStatus.done
  const openTotal = stats.total - done

  const deadlines = [
    { label: 'Overdue', value: stats.overdue, alert: stats.overdue > 0 },
    { label: 'Due today', value: stats.dueToday, alert: false },
    { label: 'Due in 3 days', value: stats.dueSoon, alert: false },
  ]

  return (
    <section aria-labelledby={headingId} className="rounded-card border border-line bg-surface p-5 shadow-card">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={headingId} className="text-sm font-semibold text-ink">
          {title}
        </h2>
        <p className="font-display text-h3 font-semibold tabular-nums text-ink" aria-hidden="true">
          {stats.completionPercent}%
        </p>
      </div>
      <ProgressBar
        value={stats.completionPercent}
        label={title}
        valueText={`${stats.completionPercent}%: ${done} of ${pluralize(stats.total, 'task')} done`}
        className="mt-3"
      />
      <p className="mt-2 text-sm text-ink-muted">
        {done} of {pluralize(stats.total, 'task')} done
      </p>

      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {TASK_STATUSES.map((status) => (
          <div key={status} className="rounded-control bg-raised px-3 py-2">
            <dt className="flex items-center gap-2 text-xs text-ink-muted">
              <span aria-hidden="true" className={`size-2 rounded-full ${statusDot[status]}`} />
              {STATUS_LABELS[status]}
            </dt>
            <dd className="font-display text-h3 font-semibold tabular-nums text-ink">{stats.byStatus[status]}</dd>
          </div>
        ))}
        {deadlines.map(({ label, value, alert }) => (
          <div key={label} className="rounded-control bg-raised px-3 py-2">
            <dt className={`text-xs ${alert ? 'text-danger' : 'text-ink-muted'}`}>{label}</dt>
            <dd className={`font-display text-h3 font-semibold tabular-nums ${alert ? 'text-danger' : 'text-ink'}`}>
              {value}
            </dd>
          </div>
        ))}
      </dl>

      {openTotal > 0 && (
        <p className="mt-4 text-sm text-ink-muted">
          Open by priority:{' '}
          {[...TASK_PRIORITIES]
            .reverse()
            .map((priority) => `${PRIORITY_LABELS[priority]} ${stats.openByPriority[priority]}`)
            .join(' · ')}
        </p>
      )}
    </section>
  )
}
