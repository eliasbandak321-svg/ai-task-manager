import { CalendarClock, Settings, Sparkles } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ButtonLink } from '../components/ButtonLink'
import { DueBadge } from '../components/dashboard/DueBadge'
import { ProposalCard } from '../components/workspace/ProposalCard'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { LoadingMessage } from '../components/ui/LoadingMessage'
import { ProgressBar } from '../components/ui/ProgressBar'
import { addDays, EVENT_CATEGORY_LABELS, getDeadlineStatus } from '../domain'
import { useProjectsQuery, useTasksQuery } from '../hooks/queries'
import { useNow } from '../hooks/useNow'
import { useToday } from '../hooks/useToday'
import { useCalendarQuery, useInsightsQuery, usePreferencesQuery, useProposalsQuery, useUserTimeZone } from '../hooks/workspaceQueries'
import { dueLabel, errorMessage, pluralize } from '../lib/format'
import { formatSpan, zonedDayRange } from '../lib/time'

function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-h3 font-semibold text-ink">{title}</h2>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}

const linkClass = 'text-sm font-medium text-glow underline-offset-4 hover:underline'

/** The home page: what matters today, what's coming up, and how things are going. */
export function OverviewPage() {
  const today = useToday()
  const now = useNow()
  const tasksQuery = useTasksQuery()
  const projectsQuery = useProjectsQuery()
  const insightsQuery = useInsightsQuery()
  const preferencesQuery = usePreferencesQuery()
  const proposalsQuery = useProposalsQuery()
  const timeZone = useUserTimeZone()
  // Today and the next 6 days in the user's zone (stable for the day: the query key doesn't churn).
  const range = useMemo(() => zonedDayRange(today, addDays(today, 6), timeZone), [today, timeZone])
  const calendarQuery = useCalendarQuery(range.from, range.to)

  if (tasksQuery.isPending || projectsQuery.isPending) return <LoadingMessage label="Loading your dashboard…" />
  if (tasksQuery.isError) return <ErrorMessage title="Your tasks couldn't be loaded" message={errorMessage(tasksQuery.error)} onRetry={() => tasksQuery.refetch()} />

  const tasks = tasksQuery.data
  const open = tasks.filter((task) => task.status !== 'done')
  const focus = open.filter((task) => {
    const status = getDeadlineStatus(task, today)
    return status === 'overdue' || status === 'due_today'
  })
  const deadlines = open
    .filter((task) => task.dueDate !== null && task.dueDate > today && task.dueDate <= addDays(today, 7))
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
  const sessions = (calendarQuery.data?.occurrences ?? []).filter((occurrence) => occurrence.end > now).slice(0, 6)
  const projectName = new Map((projectsQuery.data ?? []).map((project) => [project.id, project.name]))
  const insights = insightsQuery.data
  const pending = proposalsQuery.data ?? []

  return (
    <div className="space-y-6">
      <title>Dashboard · AI Task Manager</title>
      <div>
        <h1 className="font-display text-h2 font-semibold text-ink">Dashboard</h1>
        <p className="mt-1 text-ink-muted">Plan smarter. Organize better. Get things done.</p>
      </div>

      {preferencesQuery.data && !preferencesQuery.data.saved && (
        <div className="flex flex-col gap-3 rounded-card border border-glow/40 bg-raised p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink">
            Tell the scheduler when you work: your time zone, working days and hours. It uses them to plan sessions around your calendar.
          </p>
          <ButtonLink to="/app/settings" className="shrink-0">
            <Settings aria-hidden="true" className="size-4" /> Set availability
          </ButtonLink>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Today" action={<Link to="/app/projects" className={linkClass}>All tasks</Link>}>
          {focus.length === 0 ? (
            <p className="text-sm text-ink-muted">Nothing is due today or overdue.</p>
          ) : (
            <ul className="space-y-2">
              {focus.map((task) => (
                <li key={task.id} className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-line p-3">
                  <Link to={`/app/projects/${task.projectId}`} className="min-w-0 truncate text-sm text-ink hover:underline">
                    {task.title}
                  </Link>
                  <DueBadge label={dueLabel(task, today)!} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Upcoming sessions" action={<Link to="/app/calendar" className={linkClass}>Calendar</Link>}>
          {calendarQuery.isError ? (
            <p role="alert" className="text-sm text-danger">The calendar couldn't be loaded.</p>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-ink-muted">
              Nothing planned for the next 7 days.{' '}
              <Link to="/app/calendar" className={linkClass}>Plan your week</Link>
            </p>
          ) : (
            <ul className="space-y-2">
              {sessions.map((occurrence) => (
                <li key={`${occurrence.eventId}-${occurrence.occurrenceStart}`} className="flex items-start gap-3 rounded-control border border-line p-3 text-sm">
                  <CalendarClock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-glow" />
                  <span className="min-w-0">
                    <span className="block truncate text-ink">{occurrence.title}</span>
                    <span className="text-ink-muted">
                      {formatSpan(occurrence.start, occurrence.end, timeZone)} · {EVENT_CATEGORY_LABELS[occurrence.category]}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Deadlines this week">
          {deadlines.length === 0 ? (
            <p className="text-sm text-ink-muted">No deadlines in the next 7 days.</p>
          ) : (
            <ul className="space-y-2">
              {deadlines.map((task) => (
                <li key={task.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 truncate text-ink">
                    {task.title} <span className="text-ink-subtle">· {projectName.get(task.projectId)}</span>
                  </span>
                  <DueBadge label={dueLabel(task, today)!} />
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Progress" action={<Link to="/app/insights" className={linkClass}>Insights</Link>}>
          {insights ? (
            <div className="space-y-3 text-sm">
              <ProgressBar
                value={insights.completionPercent}
                label="Tasks completed"
                valueText={`${insights.counts.completed} of ${insights.counts.total} tasks done`}
              />
              <p className="text-ink-muted">
                {insights.counts.completed} of {pluralize(insights.counts.total, 'task')} done · {insights.counts.completedLast7Days} completed in the last 7 days ·{' '}
                {insights.scheduling.unscheduled} open without a planned session
              </p>
            </div>
          ) : insightsQuery.isError ? (
            <p role="alert" className="text-sm text-danger">Insights couldn't be loaded.</p>
          ) : (
            <p className="text-sm text-ink-muted">Loading…</p>
          )}
        </Panel>
      </div>

      {pending.length > 0 && (
        <section aria-label="Suggestions waiting for approval" className="space-y-3">
          <h2 className="flex items-center gap-2 font-display text-h3 font-semibold text-ink">
            <Sparkles aria-hidden="true" className="size-5 text-glow" /> Waiting for your approval
          </h2>
          {pending
            .filter((proposal) => proposal.kind !== 'plan')
            .slice(0, 3)
            .map((proposal) => (
              <ProposalCard key={proposal.id} proposal={proposal} />
            ))}
          {pending.some((proposal) => proposal.kind === 'plan') && (
            <p className="text-sm text-ink-muted">
              You have an unsaved project plan. <Link to="/app/assistant/plan" className={linkClass}>Open the plan builder</Link>
            </p>
          )}
        </section>
      )}
    </div>
  )
}
