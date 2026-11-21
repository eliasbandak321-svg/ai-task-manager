import { Lightbulb } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { BarChart } from '../components/insights/BarChart'
import { KpiCard } from '../components/insights/KpiCard'
import { StatusBreakdown } from '../components/insights/StatusBreakdown'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { LoadingMessage } from '../components/ui/LoadingMessage'
import { ProgressBar } from '../components/ui/ProgressBar'
import { addDays, computeInsightsReport, daysBetween, isIsoDate, type InsightsGranularity, type IsoDate, type Suggestion } from '../domain'
import { useProjectsQuery, useTasksQuery } from '../hooks/queries'
import { useNow } from '../hooks/useNow'
import { useToday } from '../hooks/useToday'
import { useCalendarQuery, usePreferencesQuery, useProposalsQuery, useUserTimeZone } from '../hooks/workspaceQueries'
import { errorMessage, formatIsoDate } from '../lib/format'
import { formatMinutes, zonedDayRange } from '../lib/time'

const PERIODS = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: 'custom', label: 'Custom' },
] as const
type Period = (typeof PERIODS)[number]['value']

const GRANULARITIES: { value: InsightsGranularity; label: string }[] = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' },
]

const segClass = (active: boolean) =>
  `min-h-9 rounded-full px-3.5 text-sm transition-colors duration-(--duration-fast) disabled:cursor-not-allowed disabled:opacity-40 ${active ? 'bg-btn text-btn-ink' : 'text-ink-muted hover:text-ink'}`

const hoursLabel = (minutes: number) => {
  const hours = Math.round(minutes / 6) / 10
  return `${hours} h`
}

function shortDate(date: IsoDate): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

function bucketLabels(bucket: { from: IsoDate; to: IsoDate }, granularity: InsightsGranularity) {
  if (granularity === 'day') return { label: shortDate(bucket.from), short: String(Number(bucket.from.slice(8))) }
  if (granularity === 'week') return { label: `${shortDate(bucket.from)} – ${shortDate(bucket.to)}`, short: shortDate(bucket.from) }
  const month = new Date(`${bucket.from}T12:00:00Z`)
  return { label: month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }), short: month.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }) }
}

function Card({ title, description, aside, children, labelledBy }: { title: string; description?: string; aside?: ReactNode; children: ReactNode; labelledBy: string }) {
  return (
    <section aria-labelledby={labelledBy} className="rounded-card border border-line bg-surface p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={labelledBy} className="font-display text-lg font-semibold tracking-tight text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-ink-subtle">{description}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  )
}

/** Where a suggestion's action button leads. */
function suggestionLink(suggestion: Suggestion): { to: string; label: string } | null {
  switch (suggestion.kind) {
    case 'unscheduled_urgent':
    case 'nothing_planned':
    case 'overloaded_day':
    case 'unmarked_sessions':
      return { to: '/app/calendar', label: 'Open calendar' }
    case 'stale_project':
      return suggestion.projectId ? { to: `/app/projects/${suggestion.projectId}`, label: 'Open project' } : null
    case 'overdue':
    case 'missing_estimate':
      return { to: '/app/projects', label: 'Open tasks' }
  }
}

/**
 * Insights (M10): progress, completion trends and focus figures for a chosen period and
 * project. Computed in the browser from the user's own tasks, projects and calendar
 * (computeInsightsReport); nothing here is estimated by AI. Filters live in the URL.
 */
export function InsightsPage() {
  const today = useToday()
  const now = useNow()
  const timeZone = useUserTimeZone()
  const [params, setParams] = useSearchParams()
  const period: Period = (PERIODS.find((option) => option.value === params.get('period'))?.value ?? '30') as Period
  const projectId = params.get('project')
  const customFrom = params.get('from')
  const customTo = params.get('to')

  let from: IsoDate = addDays(today, -29)
  let to: IsoDate = today
  let rangeError: string | null = null
  if (period === 'custom') {
    if (customFrom && customTo && isIsoDate(customFrom) && isIsoDate(customTo) && customFrom <= customTo) {
      from = customFrom
      to = customTo > today ? today : customTo
    } else if (customFrom || customTo) rangeError = 'Choose a start date on or before the end date.'
  } else from = addDays(today, -(Number(period) - 1))
  const days = daysBetween(from, to) + 1
  const requested = params.get('by') as InsightsGranularity | null
  const granularity: InsightsGranularity = requested && GRANULARITIES.some((option) => option.value === requested) ? (requested === 'day' && days > 62 ? 'week' : requested) : days > 62 ? 'week' : 'day'

  const tasksQuery = useTasksQuery()
  const projectsQuery = useProjectsQuery()
  const preferencesQuery = usePreferencesQuery()
  const proposalsQuery = useProposalsQuery()
  const range = zonedDayRange(from, addDays(today, 7), timeZone)
  const calendarQuery = useCalendarQuery(range.from, range.to)

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key)
      else next.set(key, value)
    }
    setParams(next, { replace: true })
  }

  if (tasksQuery.isPending || projectsQuery.isPending || preferencesQuery.isPending || calendarQuery.isPending) return <LoadingMessage label="Loading insights…" />
  const failed = [tasksQuery, projectsQuery, preferencesQuery, calendarQuery].find((query) => query.isError)
  if (failed) return <ErrorMessage title="Insights couldn't be loaded" message={errorMessage(failed.error)} onRetry={() => void Promise.all([tasksQuery.refetch(), projectsQuery.refetch(), calendarQuery.refetch()])} />

  const projects = projectsQuery.data ?? []
  const selected = projectId ? projects.find((project) => project.id === projectId) : undefined
  const report = computeInsightsReport({
    tasks: tasksQuery.data ?? [],
    projects,
    occurrences: calendarQuery.data?.occurrences ?? [],
    prefs: preferencesQuery.data!.preferences,
    now: new Date(now),
    from,
    to,
    projectId: selected?.id ?? null,
    granularity,
  })
  const periodLabel = period === 'custom' ? `${shortDate(from)} – ${shortDate(to)}` : `Last ${period} days`
  const scheduleProposals = (proposalsQuery.data ?? []).filter((proposal) => proposal.payload.kind === 'schedule')
  const pendingSessions = scheduleProposals.reduce((sum, proposal) => sum + (proposal.payload.kind === 'schedule' ? proposal.payload.items.filter((item) => item.type === 'create').length : 0), 0)
  const diff = report.completed.inRange - report.completed.previousRange
  const columns = report.completed.series.map((bucket) => bucketLabels(bucket, granularity))
  const openTasks = report.status.total - report.status.done

  return (
    <div className="space-y-6">
      <title>Insights · AI Task Manager</title>
      <div>
        <h1 className="font-display text-page font-semibold text-ink">Insights</h1>
        <p className="mt-1 text-ink-muted">Calculated from your tasks and calendar. Nothing here is estimated by AI.</p>
      </div>

      <section aria-label="Filters" className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card border border-line bg-surface px-4 py-3">
        <fieldset className="inline-flex flex-wrap gap-0.5 rounded-full border border-line bg-surface p-1">
          <legend className="sr-only">Period</legend>
          {PERIODS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={period === option.value}
              className={segClass(period === option.value)}
              onClick={() => update(option.value === 'custom' ? { period: 'custom', from: customFrom ?? from, to: customTo ?? to } : { period: option.value, from: null, to: null })}
            >
              {option.label}
            </button>
          ))}
        </fieldset>
        {period === 'custom' && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
            <label htmlFor="insights-from">From</label>
            <input id="insights-from" type="date" max={today} value={customFrom ?? from} onChange={(event) => update({ from: event.target.value })} className="min-h-9 rounded-full border border-line-input bg-surface px-3 text-ink" />
            <label htmlFor="insights-to">to</label>
            <input id="insights-to" type="date" max={today} value={customTo ?? to} onChange={(event) => update({ to: event.target.value })} className="min-h-9 rounded-full border border-line-input bg-surface px-3 text-ink" />
          </div>
        )}
        <label className="ml-auto flex items-center gap-2 text-sm text-ink-muted" htmlFor="insights-project">
          Project
          <select id="insights-project" value={selected?.id ?? 'all'} onChange={(event) => update({ project: event.target.value === 'all' ? null : event.target.value })} className="min-h-9 rounded-full border border-line-input bg-surface px-3 text-ink">
            <option value="all">All projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </label>
        <p aria-live="polite" className="w-full text-sm text-ink-subtle">
          {rangeError ? (
            <span className="text-danger">{rangeError}</span>
          ) : (
            <>
              Showing <span className="font-medium text-ink">{shortDate(from)} – {shortDate(to)}</span> · {selected?.name ?? 'All projects'}. Period figures use completion dates; "Now" figures are the current state.
            </>
          )}
        </p>
      </section>

      {report.status.total === 0 ? (
        <div className="rounded-card border border-line bg-surface p-10 text-center">
          <h2 className="font-display text-lg font-semibold text-ink">No tasks {selected ? `in ${selected.name}` : 'yet'}</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">There is nothing to measure yet. Add tasks and their progress will appear here.</p>
          <Link to={selected ? `/app/projects/${selected.id}` : '/app/projects'} className="mt-4 inline-flex min-h-11 items-center rounded-full bg-btn px-5 text-sm font-medium text-btn-ink hover:bg-btn-hover">
            {selected ? 'Open project' : 'Go to your tasks'}
          </Link>
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <KpiCard label="Completed tasks" value={report.completed.inRange} scope={periodLabel}>
              {diff === 0 ? 'Same as' : `${diff > 0 ? '+' : ''}${diff} vs`} the previous {report.range.days} days ({report.completed.previousRange})
            </KpiCard>
            <KpiCard label="Completion rate" value={`${report.status.completionPercent}%`} scope="Now">
              {report.status.done} of {report.status.total} tasks done
            </KpiCard>
            <KpiCard label="Overdue tasks" value={report.status.overdue} scope="Now" tone={report.status.overdue > 0 ? 'warn' : 'default'}>
              {report.status.overdue > 0 ? 'Past their due date and not done' : 'Nothing past its due date'}
            </KpiCard>
            <KpiCard label="Planned focus" value={hoursLabel(report.focus.plannedNext7Minutes)} scope="Next 7 days">
              {report.focus.upcomingSessions} upcoming work session{report.focus.upcomingSessions === 1 ? '' : 's'}
            </KpiCard>
            <KpiCard label="Focus marked done" value={hoursLabel(report.focus.completedMinutes)} scope={periodLabel}>
              Sessions you marked done · {report.focus.unmarkedSessions} not marked
            </KpiCard>
            <KpiCard label="Active projects" value={report.projects.filter((project) => project.total > project.done).length} scope="Now">
              {openTasks} open task{openTasks === 1 ? '' : 's'}
            </KpiCard>
          </dl>

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Card
              labelledBy="trend-heading"
              title="Completed tasks over time"
              description={`By the date each task was marked done · ${periodLabel}`}
              aside={
                <fieldset className="inline-flex gap-0.5 rounded-full border border-line p-1">
                  <legend className="sr-only">Group by</legend>
                  {GRANULARITIES.map((option) => (
                    <button key={option.value} type="button" aria-pressed={granularity === option.value} disabled={option.value === 'day' && days > 62} className={segClass(granularity === option.value)} onClick={() => update({ by: option.value })}>
                      {option.label}
                    </button>
                  ))}
                </fieldset>
              }
            >
              {report.completed.inRange === 0 ? (
                <p className="py-8 text-center text-sm text-ink-muted">No tasks were completed in this period.</p>
              ) : (
                <BarChart title="Completed tasks" columns={columns} series={[{ label: 'Completed', className: 'bar-done', values: report.completed.series.map((bucket) => bucket.count) }]} />
              )}
            </Card>
            <Card labelledBy="status-heading" title="Task status" description={`${report.status.total} tasks · current state`}>
              <StatusBreakdown status={report.status} />
            </Card>
          </div>

          <div className="grid items-start gap-5 lg:grid-cols-2">
            <Card labelledBy="projects-heading" title="Project progress" description="Completed ÷ total tasks, right now">
              <ul className="space-y-1">
                {report.projects.map((project) => (
                  <li key={project.projectId} className="rounded-xl p-2 text-sm hover:bg-raised">
                    <div className="mb-1.5 flex items-center justify-between gap-3">
                      <Link to={`/app/projects/${project.projectId}`} className="truncate font-medium text-ink hover:underline">{project.name}</Link>
                      <span className="shrink-0 font-mono text-xs text-ink-muted">{project.done}/{project.total} · {project.percent}%</span>
                    </div>
                    <ProgressBar value={project.percent} label={`${project.name} progress`} valueText={`${project.done} of ${project.total} tasks done`} />
                    {selected && (
                      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg bg-raised p-2.5"><dt className="text-ink-muted">Estimated work left</dt><dd className="font-semibold text-ink">{formatMinutes(project.openEstimateMinutes)}{project.unestimatedOpen > 0 && ` (+${project.unestimatedOpen} without estimate)`}</dd></div>
                        <div className="rounded-lg bg-raised p-2.5"><dt className="text-ink-muted">Last task completed</dt><dd className="font-semibold text-ink">{project.lastCompletedOn ? formatIsoDate(project.lastCompletedOn, today) : 'None yet'}</dd></div>
                      </dl>
                    )}
                  </li>
                ))}
              </ul>
              {!selected && projects.length > 1 && <p className="mt-2 text-xs text-ink-subtle">Choose a project above to inspect it.</p>}
            </Card>

            <Card labelledBy="suggestions-heading" title="Worth a look" description="Rules applied to your data, each with its reason">
              {report.suggestions.length === 0 ? (
                <p className="text-sm text-ink-muted">Nothing needs attention right now.</p>
              ) : (
                <ul className="space-y-2.5">
                  {report.suggestions.map((suggestion) => {
                    const link = suggestionLink(suggestion)
                    return (
                      <li key={`${suggestion.kind}-${suggestion.date ?? ''}-${suggestion.projectId ?? ''}`} className="flex gap-3 rounded-xl border border-line p-3 text-sm text-ink">
                        <Lightbulb aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-priority-medium" />
                        <div className="min-w-0">
                          <p>{suggestion.message}</p>
                          {link && (
                            <Link to={link.to} className="mt-1.5 inline-block text-sm font-medium text-glow underline-offset-4 hover:underline">
                              {link.label}
                            </Link>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>
          </div>

          <Card labelledBy="focus-heading" title="Focus and scheduling" description='From work sessions on your calendar. "Done" means you marked the session done; there is no timer, and planning a session never counts as doing it.'>
            <div className="grid gap-8 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
              <div>
                <p className="mb-3 text-sm font-medium text-ink">Focus hours · {periodLabel}</p>
                {report.focus.completedMinutes + report.focus.unmarkedMinutes === 0 ? (
                  <p className="py-6 text-center text-sm text-ink-muted">No work sessions in this period.</p>
                ) : (
                  <BarChart
                    title="Focus hours"
                    columns={columns}
                    formatValue={(value) => `${Math.round(value * 10) / 10}`}
                    series={[
                      { label: 'Marked done (h)', className: 'bar-focus', values: report.focus.series.map((bucket) => bucket.completedMinutes / 60) },
                      { label: 'Not marked (h)', className: 'bar-unmarked', values: report.focus.series.map((bucket) => bucket.unmarkedMinutes / 60) },
                    ]}
                  />
                )}
                <p className="mt-3 text-xs text-ink-subtle">
                  {hoursLabel(report.focus.completedMinutes)} marked done · {hoursLabel(report.focus.unmarkedMinutes)} not marked · {report.focus.skippedSessions} skipped (excluded)
                </p>
              </div>
              <div>
                <p className="mb-3 text-sm font-medium text-ink">Planned work, next 7 days</p>
                <BarChart
                  title="Planned work per day (chart)"
                  height={8.5}
                  formatValue={(value) => `${Math.round(value * 10) / 10}`}
                  columns={report.workload.map((day) => ({ label: formatIsoDate(day.date, today), short: new Date(`${day.date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }), capacity: day.capacityMinutes / 60 }))}
                  series={[{ label: 'Planned (h)', className: 'bar-planned', values: report.workload.map((day) => day.scheduledMinutes / 60) }]}
                />
                <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <div className="rounded-xl bg-raised p-3"><dd className="font-display text-xl font-semibold text-ink">{report.focus.upcomingSessions}</dd><dt className="text-xs text-ink-muted">Upcoming sessions</dt></div>
                  <div className="rounded-xl bg-raised p-3"><dd className="font-display text-xl font-semibold text-ink">{report.focus.openWithSession}/{openTasks}</dd><dt className="text-xs text-ink-muted">Open tasks with a session</dt></div>
                  <div className="rounded-xl bg-raised p-3"><dd className="font-display text-xl font-semibold text-ink">{pendingSessions}</dd><dt className="text-xs text-ink-muted">Proposed, awaiting approval</dt></div>
                </dl>
                <table className="mt-4 w-full text-left text-sm">
                  <caption className="sr-only">Planned work per day</caption>
                  <thead className="text-xs text-ink-muted">
                    <tr>
                      <th scope="col" className="py-1 font-medium">Day</th>
                      <th scope="col" className="py-1 font-medium">Planned</th>
                      <th scope="col" className="py-1 font-medium">Max</th>
                      <th scope="col" className="py-1 font-medium">Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.workload.map((day) => (
                      <tr key={day.date} className="border-t border-line">
                        <th scope="row" className="py-1 font-normal text-ink">{formatIsoDate(day.date, today)}</th>
                        <td className={`py-1 tabular-nums ${day.capacityMinutes > 0 && day.scheduledMinutes > day.capacityMinutes ? 'font-semibold text-danger' : 'text-ink'}`}>{formatMinutes(day.scheduledMinutes)}</td>
                        <td className="py-1 tabular-nums text-ink-muted">{day.capacityMinutes ? formatMinutes(day.capacityMinutes) : 'Day off'}</td>
                        <td className="py-1 tabular-nums text-ink-muted">{day.dueTasks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
