import { CalendarPlus, Check, Pencil, RefreshCcw, Wand2 } from 'lucide-react'
import { lazy, Suspense, useMemo, useState } from 'react'
import type { TimeChange } from '../components/workspace/CalendarView'
import { EventDialog, type EventDialogState } from '../components/workspace/EventDialog'
import { ProposalCard } from '../components/workspace/ProposalCard'
import { ScopeDialog } from '../components/workspace/ScopeDialog'
import { Button } from '../components/ui/Button'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { LoadingMessage } from '../components/ui/LoadingMessage'
import { addDays, EVENT_CATEGORY_LABELS, WORK_CATEGORIES, weekdayOfDate, zonedParts, zonedToUtc, type EditScope, type Occurrence, type Proposal, type SessionStatus } from '../domain'
import { useTasksQuery } from '../hooks/queries'
import { useToast } from '../hooks/toast'
import { useNow } from '../hooks/useNow'
import { useToday } from '../hooks/useToday'
import {
  browserTimeZone,
  useCalendarQuery,
  useInsightsQuery,
  usePreferencesQuery,
  useProposalsQuery,
  useProposeSchedule,
  useUpdateEvent,
  useUserTimeZone,
} from '../hooks/workspaceQueries'
import { errorMessage } from '../lib/format'
import { CATEGORY_CLASSES, formatClock, formatDayHeading, formatMinutes, zonedDate, zonedDayRange } from '../lib/time'

// The calendar library is only downloaded when this page opens.
const CalendarView = lazy(() => import('../components/workspace/CalendarView'))

const NONE: never[] = []

/** Monday 00:00 of the current week until the next Monday, in the user's zone (initial range). */
function currentWeek(today: string, timeZone: string): { from: string; to: string } {
  const monday = addDays(today, -((weekdayOfDate(today) + 6) % 7))
  return zonedDayRange(monday, addDays(monday, 6), timeZone)
}

export function CalendarPage() {
  const today = useToday()
  const timeZone = useUserTimeZone()
  const now = useNow()
  const [range, setRange] = useState(() => currentWeek(today, timeZone))
  const [dialog, setDialog] = useState<EventDialogState | null>(null)
  const [pendingChange, setPendingChange] = useState<TimeChange | null>(null)
  const [latestProposal, setLatestProposal] = useState<Proposal | null>(null)
  const calendarQuery = useCalendarQuery(range.from, range.to)
  const tasksQuery = useTasksQuery()
  const insightsQuery = useInsightsQuery()
  const preferencesQuery = usePreferencesQuery()
  const proposalsQuery = useProposalsQuery()
  const updateEvent = useUpdateEvent()
  const proposeSchedule = useProposeSchedule()
  const showToast = useToast()

  const occurrences = calendarQuery.data?.occurrences ?? NONE
  const events = calendarQuery.data?.events ?? NONE
  const tasks = tasksQuery.data ?? NONE
  const taskTitle = new Map(tasks.map((task) => [task.id, task.title]))
  const unscheduled = (insightsQuery.data?.scheduling.unscheduledTaskIds ?? NONE)
    .map((id) => tasks.find((task) => task.id === id))
    .filter((task) => task !== undefined)
  const pendingSchedules = (proposalsQuery.data ?? NONE).filter((proposal) => proposal.kind === 'schedule' && proposal.id !== latestProposal?.id)
  const deviceZone = browserTimeZone()

  const byDay = useMemo(() => {
    const groups = new Map<string, Occurrence[]>()
    for (const occurrence of occurrences) {
      const day = zonedDate(occurrence.start, timeZone)
      groups.set(day, [...(groups.get(day) ?? []), occurrence])
    }
    return [...groups.values()]
  }, [occurrences, timeZone])

  function openOccurrence(occurrence: Occurrence) {
    const event = events.find((candidate) => candidate.id === occurrence.eventId)
    if (event) setDialog({ mode: 'edit', event, occurrenceStart: occurrence.occurrenceStart, occurrenceEnd: occurrence.end })
  }

  function newEvent() {
    // The next full hour in the user's zone.
    const now = zonedParts(new Date(), timeZone)
    const start = zonedToUtc(now.date, (Math.floor(now.minutes / 60) + 1) * 60, timeZone)
    setDialog({ mode: 'create', start: start.toISOString(), end: new Date(start.getTime() + 3_600_000).toISOString() })
  }

  /** Work sessions for a task can be marked once they've started. */
  const isTrackable = (occurrence: Occurrence) =>
    occurrence.taskId !== null && WORK_CATEGORIES.includes(occurrence.category) && occurrence.start <= now

  async function setStatus(occurrence: Occurrence, sessionStatus: SessionStatus) {
    try {
      await updateEvent.mutateAsync({
        id: occurrence.eventId,
        // An occurrence of a repeating session is separated from its series first.
        change: { scope: 'occurrence', occurrenceStart: occurrence.occurrenceStart, changes: { sessionStatus } },
      })
      showToast(sessionStatus === 'completed' ? 'Marked as done' : sessionStatus === 'skipped' ? 'Marked as skipped' : 'Status cleared')
    } catch (error) {
      showToast(errorMessage(error), 'error')
    }
  }

  async function saveTimeChange(change: TimeChange, scope?: EditScope) {
    try {
      await updateEvent.mutateAsync({
        id: change.occurrence.eventId,
        change: { scope, occurrenceStart: change.occurrence.occurrenceStart, changes: { startAt: change.startAt, endAt: change.endAt } },
      })
      showToast('Event moved.')
    } catch (error) {
      change.revert()
      showToast(errorMessage(error), 'error')
    }
  }

  function handleTimeChange(change: TimeChange) {
    if (change.occurrence.isRecurring) setPendingChange(change)
    else void saveTimeChange(change)
  }

  async function plan(mode: 'fill' | 'replan', taskIds: string[] | null = null) {
    try {
      const proposal = await proposeSchedule.mutateAsync({ mode, from: today, to: addDays(today, taskIds ? 13 : 6), taskIds })
      setLatestProposal(proposal)
    } catch (error) {
      showToast(errorMessage(error), 'error')
    }
  }

  return (
    <div className="space-y-6">
      <title>Calendar · AI Task Manager</title>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-h2 font-semibold text-ink">Calendar</h1>
          <p className="mt-1 text-ink-muted">Drag to move, drag the bottom edge to resize, or select a time to add an event.</p>
        </div>
        <Button variant="primary" onClick={newEvent}>
          <CalendarPlus aria-hidden="true" className="size-4" /> New event
        </Button>
      </div>

      <p className="text-sm text-ink-muted">
        Times are shown in <strong className="font-medium text-ink">{timeZone}</strong>
        {preferencesQuery.data?.saved ? ' (your settings)' : ' (your device; set your time zone in Settings)'}.
        {timeZone !== deviceZone && ` Your device is set to ${deviceZone}.`}
      </p>

      {calendarQuery.isError && (
        <ErrorMessage title="The calendar couldn't be loaded" message={errorMessage(calendarQuery.error)} onRetry={() => calendarQuery.refetch()} />
      )}

      <div className="rounded-card border border-line bg-surface p-3 sm:p-4">
        <Suspense fallback={<LoadingMessage label="Loading calendar…" />}>
          <CalendarView
            timeZone={timeZone}
            occurrences={occurrences}
            onRangeChange={(from, to) => setRange((current) => (current.from === from && current.to === to ? current : { from, to }))}
            onSelectSlot={(start, end) => setDialog({ mode: 'create', start, end })}
            onOpen={openOccurrence}
            onTimeChange={handleTimeChange}
          />
        </Suspense>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,24rem)]">
        <section aria-labelledby="agenda-heading" className="rounded-card border border-line bg-surface p-5">
          <h2 id="agenda-heading" className="font-display text-h3 font-semibold text-ink">
            Agenda
          </h2>
          <p className="mt-1 text-sm text-ink-muted">Everything in the visible range. Edit an event to change its time without dragging.</p>
          {calendarQuery.isPending ? (
            <p className="mt-3 text-sm text-ink-muted">Loading…</p>
          ) : byDay.length === 0 ? (
            <p className="mt-3 text-sm text-ink-muted">No events in this range.</p>
          ) : (
            <div className="mt-3 space-y-4">
              {byDay.map((day) => (
                <div key={day[0].start}>
                  <h3 className="text-sm font-semibold text-ink">{formatDayHeading(day[0].start, timeZone)}</h3>
                  <ul className="mt-2 space-y-2">
                    {day.map((occurrence) => (
                      <li key={`${occurrence.eventId}-${occurrence.occurrenceStart}`} className="flex items-center gap-3 rounded-control border border-line p-2 pl-3 text-sm">
                        <span className="w-24 shrink-0 tabular-nums text-ink-muted">
                          {formatClock(occurrence.start, timeZone)}–{formatClock(occurrence.end, timeZone)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-ink">
                            {occurrence.title}
                            {occurrence.isRecurring && <span className="text-ink-subtle"> · repeats</span>}
                          </span>
                          <span className="flex flex-wrap items-center gap-2 text-xs">
                            <span className={`rounded-full px-2 py-0.5 ${CATEGORY_CLASSES[occurrence.category]}`}>{EVENT_CATEGORY_LABELS[occurrence.category]}</span>
                            {occurrence.taskId && <span className="text-ink-muted">Task: {taskTitle.get(occurrence.taskId) ?? 'linked task'}</span>}
                            {occurrence.sessionStatus !== 'planned' && (
                              <span className="rounded-full border border-line-strong px-2 py-0.5 text-ink">{occurrence.sessionStatus === 'completed' ? '✓ Done' : 'Skipped'}</span>
                            )}
                          </span>
                        </span>
                        {isTrackable(occurrence) &&
                          (occurrence.sessionStatus === 'planned' ? (
                            <span className="flex shrink-0 gap-1">
                              <Button
                                className="px-3"
                                aria-label={`Mark ${occurrence.title} at ${formatClock(occurrence.start, timeZone)} as done`}
                                onClick={() => setStatus(occurrence, 'completed')}
                              >
                                <Check aria-hidden="true" className="size-4" /> Done
                              </Button>
                              <Button
                                variant="ghost"
                                className="px-3"
                                aria-label={`Mark ${occurrence.title} at ${formatClock(occurrence.start, timeZone)} as skipped`}
                                onClick={() => setStatus(occurrence, 'skipped')}
                              >
                                Skipped
                              </Button>
                            </span>
                          ) : (
                            <Button variant="ghost" className="px-3" onClick={() => setStatus(occurrence, 'planned')}>
                              Undo
                            </Button>
                          ))}
                        <Button variant="ghost" iconOnly aria-label={`Edit ${occurrence.title} at ${formatClock(occurrence.start, timeZone)}`} onClick={() => openOccurrence(occurrence)}>
                          <Pencil aria-hidden="true" className="size-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="unscheduled-heading" className="space-y-4 rounded-card border border-line bg-surface p-5">
          <div>
            <h2 id="unscheduled-heading" className="font-display text-h3 font-semibold text-ink">
              Unscheduled tasks
            </h2>
            <p className="mt-1 text-sm text-ink-muted">Open tasks without an upcoming work session. The scheduler fits them into your working hours.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => plan('fill')} disabled={proposeSchedule.isPending}>
              <Wand2 aria-hidden="true" className="size-4" /> Plan my week
            </Button>
            <Button onClick={() => plan('replan')} disabled={proposeSchedule.isPending}>
              <RefreshCcw aria-hidden="true" className="size-4" /> Replan my week
            </Button>
          </div>
          {proposeSchedule.isPending && <output className="block text-sm text-ink-muted">Calculating a schedule…</output>}

          {latestProposal && (
            <ProposalCard
              proposal={latestProposal}
              onDecided={(decided) => setLatestProposal(decided)}
              onRefresh={() => {
                const payload = latestProposal.payload
                if (payload.kind === 'schedule') void plan(payload.mode)
              }}
            />
          )}
          {pendingSchedules.map((proposal) => (
            <ProposalCard key={proposal.id} proposal={proposal} />
          ))}

          {unscheduled.length === 0 ? (
            <p className="text-sm text-ink-muted">Every open task has time reserved.</p>
          ) : (
            <ul className="space-y-2">
              {unscheduled.map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-3 rounded-control border border-line p-3 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate text-ink">{task.title}</span>
                    <span className="text-ink-muted">
                      {task.estimatedMinutes ? formatMinutes(task.estimatedMinutes) : 'No estimate'}
                      {task.dueDate ? ` · due ${task.dueDate}` : ''}
                    </span>
                  </span>
                  <Button onClick={() => plan('fill', [task.id])} disabled={proposeSchedule.isPending} aria-label={`Schedule ${task.title}`}>
                    Schedule
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {dialog && <EventDialog state={dialog} tasks={tasks} onClose={() => setDialog(null)} />}
      {pendingChange && (
        <ScopeDialog
          title={`Move "${pendingChange.occurrence.title}"`}
          onChoose={(scope) => {
            const change = pendingChange
            setPendingChange(null)
            void saveTimeChange(change, scope)
          }}
          onCancel={() => {
            pendingChange.revert()
            setPendingChange(null)
          }}
        />
      )}
    </div>
  )
}
