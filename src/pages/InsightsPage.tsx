import { Lightbulb } from 'lucide-react'
import { Link } from 'react-router'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { LoadingMessage } from '../components/ui/LoadingMessage'
import { ProgressBar } from '../components/ui/ProgressBar'
import { useInsightsQuery } from '../hooks/workspaceQueries'
import { useToday } from '../hooks/useToday'
import { errorMessage, formatIsoDate } from '../lib/format'
import { formatMinutes } from '../lib/time'

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="mt-1 font-display text-h3 font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  )
}

/** Progress and workload, computed from your real tasks and calendar (never estimated by AI). */
export function InsightsPage() {
  const today = useToday()
  const insightsQuery = useInsightsQuery()
  if (insightsQuery.isPending) return <LoadingMessage label="Loading insights…" />
  if (insightsQuery.isError) return <ErrorMessage title="Insights couldn't be loaded" message={errorMessage(insightsQuery.error)} onRetry={() => insightsQuery.refetch()} />
  const insights = insightsQuery.data
  const peak = Math.max(60, ...insights.workload.map((day) => Math.max(day.scheduledMinutes, day.capacityMinutes)))

  return (
    <div className="space-y-6">
      <title>Insights · AI Task Manager</title>
      <div>
        <h1 className="font-display text-h2 font-semibold text-ink">Insights</h1>
        <p className="mt-1 text-ink-muted">Calculated from your tasks and calendar. Ask the assistant if you'd like them explained.</p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Completed" value={insights.counts.completed} />
        <Stat label="Open" value={insights.counts.pending} />
        <Stat label="Overdue" value={insights.counts.overdue} />
        <Stat label="Due today" value={insights.counts.dueToday} />
        <Stat label="Due in 7 days" value={insights.counts.upcoming} />
        <Stat label="Done this week" value={insights.counts.completedLast7Days} />
      </dl>

      <section aria-labelledby="suggestions-heading" className="rounded-card border border-line bg-surface p-5">
        <h2 id="suggestions-heading" className="font-display text-h3 font-semibold text-ink">
          Suggestions
        </h2>
        {insights.suggestions.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">Nothing needs attention right now.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {insights.suggestions.map((suggestion) => (
              <li key={`${suggestion.kind}-${suggestion.date ?? ''}`} className="flex gap-3 rounded-control border border-line p-3 text-sm text-ink">
                <Lightbulb aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-priority-medium" />
                <span>
                  {suggestion.message}{' '}
                  {(suggestion.kind === 'unscheduled_urgent' || suggestion.kind === 'nothing_planned' || suggestion.kind === 'overloaded_day') && (
                    <Link to="/app/calendar" className="text-glow underline-offset-4 hover:underline">
                      Open calendar
                    </Link>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="workload-heading" className="rounded-card border border-line bg-surface p-5">
          <h2 id="workload-heading" className="font-display text-h3 font-semibold text-ink">
            Workload, next 7 days
          </h2>
          <p className="mt-1 text-sm text-ink-muted">Planned work sessions against your daily maximum.</p>
          <div aria-hidden="true" className="mt-4 flex h-40 items-end gap-2">
            {insights.workload.map((day) => (
              <div key={day.date} className="flex h-full flex-1 flex-col justify-end gap-1">
                <div className="relative flex-1">
                  {day.capacityMinutes > 0 && (
                    <div className="absolute inset-x-0 border-t border-dashed border-ink-subtle" style={{ bottom: `${(day.capacityMinutes / peak) * 100}%` }} />
                  )}
                  <div
                    className={`absolute inset-x-0 bottom-0 rounded-t ${day.scheduledMinutes > day.capacityMinutes && day.capacityMinutes > 0 ? 'bg-danger' : 'bg-glow'}`}
                    style={{ height: `${(day.scheduledMinutes / peak) * 100}%` }}
                  />
                </div>
                <span className="text-center text-xs text-ink-muted">{new Date(`${day.date}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' })}</span>
              </div>
            ))}
          </div>
          <table className="mt-4 w-full text-left text-sm">
            <caption className="sr-only">Planned work per day</caption>
            <thead className="text-ink-muted">
              <tr>
                <th scope="col" className="py-1 font-medium">Day</th>
                <th scope="col" className="py-1 font-medium">Planned</th>
                <th scope="col" className="py-1 font-medium">Max</th>
                <th scope="col" className="py-1 font-medium">Due</th>
              </tr>
            </thead>
            <tbody>
              {insights.workload.map((day) => (
                <tr key={day.date} className="border-t border-line">
                  <th scope="row" className="py-1 font-normal text-ink">{formatIsoDate(day.date, today)}</th>
                  <td className="py-1 tabular-nums text-ink">{formatMinutes(day.scheduledMinutes)}</td>
                  <td className="py-1 tabular-nums text-ink-muted">{day.capacityMinutes ? formatMinutes(day.capacityMinutes) : 'Day off'}</td>
                  <td className="py-1 tabular-nums text-ink-muted">{day.dueTasks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section aria-labelledby="projects-heading" className="space-y-4 rounded-card border border-line bg-surface p-5">
          <h2 id="projects-heading" className="font-display text-h3 font-semibold text-ink">
            Projects
          </h2>
          <ProgressBar value={insights.completionPercent} label="All tasks completed" valueText={`${insights.counts.completed} of ${insights.counts.total} tasks done`} />
          <p className="text-sm text-ink-muted">
            {insights.scheduling.scheduled} open task(s) have planned sessions, {insights.scheduling.unscheduled} don't.
          </p>
          <ul className="space-y-3">
            {insights.projects.map((project) => (
              <li key={project.projectId} className="space-y-1 text-sm">
                <div className="flex justify-between gap-2">
                  <Link to={`/app/projects/${project.projectId}`} className="truncate text-ink hover:underline">
                    {project.name}
                  </Link>
                  <span className="shrink-0 tabular-nums text-ink-muted">
                    {project.done}/{project.total}
                  </span>
                </div>
                <ProgressBar value={project.percent} label={`${project.name} progress`} valueText={`${project.done} of ${project.total} tasks done`} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
