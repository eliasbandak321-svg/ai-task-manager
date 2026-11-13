import { AlertTriangle, ArrowRight, Check, X } from 'lucide-react'
import { useId, useState } from 'react'
import { isDomainError, type Proposal, type ScheduleItem } from '../../domain'
import { useApplyProposal, useRejectProposal, useUserTimeZone } from '../../hooks/workspaceQueries'
import { errorMessage } from '../../lib/format'
import { formatInstant, formatSpan } from '../../lib/time'
import { useToast } from '../../hooks/toast'
import { Button } from '../ui/Button'
import { checkboxClass } from '../ui/styles'
import { SourceBadge } from './SourceBadge'

interface ProposalCardProps {
  proposal: Proposal
  /** Shown above the items, e.g. "Proposed schedule". */
  title?: string
  /** Called after the proposal was applied or rejected. */
  onDecided?: (proposal: Proposal) => void
  /** For stale previews of a schedule: create a fresh one. */
  onRefresh?: () => void
}

interface Row {
  text: string
  detail?: string
  /** For moved sessions: the old time (shown before an arrow). */
  before?: string
}

function itemLabel(item: ScheduleItem, timeZone: string): Row {
  if (item.type === 'create') return { text: `New session: ${item.title}`, detail: formatSpan(item.startAt, item.endAt, timeZone) }
  if (item.type === 'move') {
    return { text: `Move: ${item.title}`, before: formatSpan(item.fromStartAt, item.fromEndAt, timeZone), detail: formatSpan(item.startAt, item.endAt, timeZone) }
  }
  return { text: `Remove: ${item.title}`, detail: formatSpan(item.fromStartAt, item.fromEndAt, timeZone) }
}

const UNSCHEDULED_TEXT = {
  not_enough_time: (minutes: number) => `${Math.round(minutes)} min missing`,
  deadline_passed: () => 'deadline has passed',
  blocked_by_dependency: () => 'waits for a prerequisite that doesn’t fit',
  dependency_cycle: () => 'circular dependency',
} as const

/**
 * A suggested change waiting for the user's decision. Nothing happens until "Approve";
 * individual items can be left out. The server re-checks everything when approving.
 */
export function ProposalCard({ proposal, title, onDecided, onRefresh }: ProposalCardProps) {
  const timeZone = useUserTimeZone()
  const headingId = useId()
  const payload = proposal.payload
  const rows: Row[] =
    payload.kind === 'schedule' ? payload.items.map((item) => itemLabel(item, timeZone)) : payload.kind === 'changes' ? payload.labels.map((text) => ({ text })) : []
  const [included, setIncluded] = useState<boolean[]>(() => rows.map(() => true))
  const [problem, setProblem] = useState<{ message: string; stale: boolean } | null>(null)
  const apply = useApplyProposal()
  const reject = useRejectProposal()
  const showToast = useToast()
  const busy = apply.isPending || reject.isPending
  const decided = proposal.status !== 'pending'
  const selected = included.flatMap((value, index) => (value ? [index] : []))

  async function approve() {
    setProblem(null)
    try {
      const result = await apply.mutateAsync({
        id: proposal.id,
        input: selected.length === rows.length ? {} : { include: selected },
      })
      showToast('Changes applied.')
      onDecided?.(result)
    } catch (error) {
      const stale = isDomainError(error, 'PROPOSAL_STALE') || isDomainError(error, 'SCHEDULE_CONFLICT') || isDomainError(error, 'PROPOSAL_EXPIRED')
      setProblem({ message: errorMessage(error), stale })
    }
  }

  async function dismiss() {
    setProblem(null)
    try {
      const result = await reject.mutateAsync(proposal.id)
      onDecided?.(result)
    } catch (error) {
      setProblem({ message: errorMessage(error), stale: false })
    }
  }

  return (
    <section aria-labelledby={headingId} className="rounded-card border border-line-strong bg-raised p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={headingId} className="font-display font-semibold text-ink">
          {title ?? (payload.kind === 'schedule' ? (payload.mode === 'replan' ? 'Proposed replan' : 'Proposed schedule') : 'Suggested changes')}
        </h3>
        <SourceBadge source={proposal.source} />
      </div>

      {payload.kind === 'schedule' && (
        <ul className="mt-2 space-y-1 text-sm text-ink-muted">
          {payload.explanation.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}

      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-ink-muted">Nothing to change.</p>
      ) : (
        <fieldset className="mt-3" disabled={decided || busy}>
          <legend className="sr-only">Items to apply</legend>
          <ul className="space-y-2">
            {rows.map((row, index) => (
              <li key={`${row.text}-${index}`}>
                <label className="flex items-start gap-3 rounded-control border border-line p-3 text-sm">
                  <input
                    type="checkbox"
                    className={`${checkboxClass} mt-0.5`}
                    checked={included[index]}
                    onChange={(event) => setIncluded((current) => current.map((value, i) => (i === index ? event.target.checked : value)))}
                  />
                  <span className="min-w-0">
                    <span className="block text-ink">{row.text}</span>
                    {row.detail && (
                      <span className="mt-0.5 flex flex-wrap items-center gap-1 text-ink-muted">
                        {row.before && (
                          <>
                            <span>{row.before}</span>
                            <ArrowRight aria-hidden="true" className="size-3.5" />
                            <span className="sr-only">to</span>
                          </>
                        )}
                        <span>{row.detail}</span>
                      </span>
                    )}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      {payload.kind === 'schedule' && payload.unscheduled.length > 0 && (
        <div className="mt-3 rounded-control border border-priority-medium/50 p-3 text-sm">
          <p className="flex items-center gap-2 font-medium text-priority-medium">
            <AlertTriangle aria-hidden="true" className="size-4" /> Not everything fits
          </p>
          <ul className="mt-1 space-y-0.5 text-ink-muted">
            {payload.unscheduled.map((entry) => (
              <li key={entry.taskId}>
                {entry.title}: {UNSCHEDULED_TEXT[entry.reason](entry.missingMinutes)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {problem && (
        <div role="alert" className="mt-3 rounded-control border border-danger/50 p-3 text-sm text-ink">
          {problem.message}
          {problem.stale && onRefresh && (
            <Button variant="secondary" className="mt-2" onClick={onRefresh}>
              Create a new preview
            </Button>
          )}
        </div>
      )}

      {decided ? (
        <p className="mt-3 text-sm text-ink-muted">
          {proposal.status === 'applied' ? 'Applied' : 'Dismissed'}
          {proposal.decidedAt ? ` · ${formatInstant(proposal.decidedAt, timeZone)}` : ''}
        </p>
      ) : (
        rows.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" onClick={approve} disabled={busy || selected.length === 0}>
              <Check aria-hidden="true" className="size-4" />
              {apply.isPending ? 'Applying…' : selected.length === rows.length ? 'Approve' : `Approve ${selected.length} of ${rows.length}`}
            </Button>
            <Button variant="ghost" onClick={dismiss} disabled={busy}>
              <X aria-hidden="true" className="size-4" />
              Dismiss
            </Button>
          </div>
        )
      )}
    </section>
  )
}
