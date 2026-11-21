import { ArrowRight, CalendarClock, Settings, Sparkles } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ButtonLink } from '../components/ButtonLink'
import { DueBadge } from '../components/dashboard/DueBadge'
import { ProposalCard } from '../components/workspace/ProposalCard'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { LoadingMessage } from '../components/ui/LoadingMessage'
import { ProgressBar } from '../components/ui/ProgressBar'
import { addDays, EVENT_CATEGORY_LABELS, getDeadlineStatus, WORK_CATEGORIES } from '../domain'
import { useProjectsQuery, useTasksQuery } from '../hooks/queries'
import { useNow } from '../hooks/useNow'
import { useToday } from '../hooks/useToday'
import { useCalendarQuery, useInsightsQuery, usePreferencesQuery, useProposalsQuery, useUserTimeZone } from '../hooks/workspaceQueries'
import { dueLabel, errorMessage, pluralize } from '../lib/format'
import { formatSpan, zonedDayRange } from '../lib/time'

function Panel({ title, children, action, className = '' }: { title: string; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <section className={`rounded-card border border-line bg-surface p-5 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-mono text-xs font-medium tracking-[0.08em] text-ink-subtle uppercase">{title}</h2>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}

const linkClass = 'text-sm font-medium text-glow underline-offset-4 hover:underline'

function minutesUntil(start: string, now: string): number {
  return Math.round((Date.parse(start) - Date.parse(now)) / 60_000)
}

function startsIn(minutes: number): string {
  if (minutes <= 0) return 'now'
  if (minutes < 60) return `in ${minutes} min`
  const hours = Math.floor(minutes / 60)
  return hours < 24 ? `in ${hours} h${minutes % 60 ? ` ${minutes % 60} min` : ''}` : `in ${Math.round(hours / 24)} d`
}

/** Today (M10): what matters today, the next work session, what's coming up, and how things are going. */
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
  const upcoming = (calendarQuery.data?.occurrences ?? []).filter((occurrence) => occurrence.end > now)
  const sessions = upcoming.slice(0, 6)
  const next = upcoming.find((occurrence) => WORK_CATEGORIES.includes(occurrence.category) && occurrence.sessionStatus !== 'skipped')
  const nextTask = next?.taskId ? tasks.find((task) => task.id === next.taskId) : undefined
  const projectName = new Map((projectsQuery.data ?? []).map((project) => [project.id, project.name]))
  const insights = insightsQuery.data
  const pending = proposalsQuery.data ?? []
  const todayDate = new Date(`${today}T12:00:00`)
  const weekday = todayDate.toLocaleDateString('en-GB', { weekday: 'long' })
  const dayMonth = todayDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })

  return (
    <div className="space-y-6">
      <title>Today · AI Task Manager</title>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[clamp(1.6rem,2.6vw,2.1rem)] leading-tight font-semibold tracking-tight text-ink">
            <span className="sr-only">Today, </span>
            {weekday}, <span className="text-glow">{dayMonth}</span>
          </h1>
          <p className="mt-1.5 text-ink-muted">
            {focus.length === 0 ? 'Nothing due today' : `${pluralize(focus.length, 'task')} due today or overdue`}
            {next && ` · next session ${startsIn(minutesUntil(next.start, now))}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink to="/app/calendar" variant="secondary">View calendar</ButtonLink>
          <ButtonLink to="/app/assistant" variant="secondary">Ask assistant</ButtonLink>
        </div>
      </div>

      {preferencesQuery.data && !preferencesQuery.data.saved && (
        <div className="flex flex-col gap-3 rounded-card border border-glow/40 bg-accent-soft p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink">
            Tell the scheduler when you work: your time zone, working days and hours. It uses them to plan sessions around your calendar.
          </p>
          <ButtonLink to="/app/settings" className="shrink-0">
            <Settings aria-hidden="true" className="size-4" /> Set availability
          </ButtonLink>
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <section aria-label="Next session" className="next-session relative overflow-hidden rounded-[1.125rem] border border-line p-5 md:p-6">
            {next ? (
              <>
                <p className="font-mono text-xs tracking-wide text-glow uppercase">
                  Next · {formatSpan(next.start, next.end, timeZone)} · {startsIn(minutesUntil(next.start, now))}
                </p>
                <p className="mt-1.5 font-display text-xl font-semibold tracking-tight text-ink">{next.title}</p>
                <p className="mt-1 text-sm text-ink-muted">
                  {EVENT_CATEGORY_LABELS[next.category]}
                  {nextTask && <> · {projectName.get(nextTask.projectId)}</>}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {nextTask && <ButtonLink to={`/app/projects/${nextTask.projectId}`}>Open task</ButtonLink>}
                  <ButtonLink to="/app/calendar" variant="secondary">Open calendar</ButtonLink>
                </div>
              </>
            ) : (
              <>
                <p className="font-mono text-xs tracking-wide text-glow uppercase">Next session</p>
                <p className="mt-1.5 font-display text-lg font-semibold text-ink">No work sessions planned for the next 7 days</p>
                <div className="mt-4">
                  <ButtonLink to="/app/calendar">Plan your week</ButtonLink>
                </div>
              </>
            )}
          </section>

          <Panel title="Due today" action={<Link to="/app/projects" className={linkClass}>All tasks</Link>}>
            {focus.length === 0 ? (
              <p className="text-sm text-ink-muted">Nothing is due today or overdue.</p>
            ) : (
              <ul className="divide-y divide-line">
                {focus.map((task) => (
                  <li key={task.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                    <Link to={`/app/projects/${task.projectId}`} className="group min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink group-hover:underline">{task.title}</span>
                      <span className="block truncate text-xs text-ink-subtle">{projectName.get(task.projectId)}</span>
                    </Link>
                    <DueBadge label={dueLabel(task, today)!} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Progress" action={<Link to="/app/insights" className={linkClass}>Insights</Link>}>
            {insights ? (
              <div className="space-y-4 text-sm">
                {[
                  { key: 'all', label: 'All tasks', percent: insights.completionPercent, text: `${insights.counts.completed} of ${insights.counts.total} tasks done` },
                  ...insights.projects
                    .filter((project) => project.total > 0)
                    .slice(0, 4)
                    .map((project) => ({ key: project.projectId, label: project.name, percent: project.percent, text: `${project.done} of ${project.total} tasks done` })),
                ].map((row) => (
                  <div key={row.key}>
                    <div className="mb-1.5 flex justify-between gap-3">
                      <span className="truncate text-ink">{row.label}</span>
                      <span className="shrink-0 font-mono text-xs text-ink-muted">{row.percent}%</span>
                    </div>
                    <ProgressBar value={row.percent} label={row.key === 'all' ? 'Tasks completed' : row.label} valueText={row.text} />
                  </div>
                ))}
              </div>
            ) : insightsQuery.isError ? (
              <p role="alert" className="text-sm text-danger">Insights couldn't be loaded.</p>
            ) : (
              <p className="text-sm text-ink-muted">Loading…</p>
            )}
          </Panel>

          {insights && insights.suggestions.length > 0 && (
            <section aria-label="Suggestion" className="hint-card rounded-card border border-line p-5">
              <p className="font-mono text-xs tracking-wide text-ink-subtle uppercase">Suggestion</p>
              <p className="mt-2 text-sm text-ink">{insights.suggestions[0].message}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <ButtonLink to="/app/insights" variant="secondary">
                  See all suggestions <ArrowRight aria-hidden="true" className="size-4" />
                </ButtonLink>
              </div>
            </section>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Upcoming sessions" action={<Link to="/app/calendar" className={linkClass}>Calendar</Link>}>
          {calendarQuery.isError ? (
            <p role="alert" className="text-sm text-danger">The calendar couldn't be loaded.</p>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-ink-muted">
              Nothing planned for the next 7 days. <Link to="/app/calendar" className={linkClass}>Plan your week</Link>
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {sessions.map((occurrence) => (
                <li key={`${occurrence.eventId}-${occurrence.occurrenceStart}`} className="flex items-start gap-3 py-2.5 text-sm first:pt-0 last:pb-0">
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
            <ul className="divide-y divide-line">
              {deadlines.map((task) => (
                <li key={task.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm first:pt-0 last:pb-0">
                  <span className="min-w-0 truncate text-ink">
                    {task.title} <span className="text-ink-subtle">· {projectName.get(task.projectId)}</span>
                  </span>
                  <DueBadge label={dueLabel(task, today)!} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {insights && (
        <section aria-label="Summary" className="grid grid-cols-2 overflow-hidden rounded-card border border-line bg-surface md:grid-cols-4">
          {[
            [insights.counts.completed, 'Completed tasks'],
            [insights.counts.completedLast7Days, 'Done in the last 7 days'],
            [insights.counts.overdue, 'Overdue'],
            [insights.counts.pending, 'Open tasks'],
          ].map(([value, label], index) => (
            <div key={label} className={`border-line p-4 md:p-5 ${index % 2 === 1 ? 'border-l' : ''} ${index >= 2 ? 'border-t md:border-t-0' : ''} ${index === 2 ? 'md:border-l' : ''}`}>
              <p className={`font-display text-2xl font-semibold tracking-tight ${label === 'Overdue' && Number(value) > 0 ? 'text-priority-medium' : 'text-ink'}`}>{value}</p>
              <p className="text-sm text-ink-muted">{label}</p>
            </div>
          ))}
        </section>
      )}

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
