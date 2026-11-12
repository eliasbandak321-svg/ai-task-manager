import { Sparkles } from 'lucide-react'
import { useId, useState } from 'react'
import { TASK_ASSIST_KINDS, TASK_ASSIST_LABELS, type Proposal, type Task, type TaskAssistKind } from '../../domain'
import { useAssistTask } from '../../hooks/workspaceQueries'
import { errorMessage } from '../../lib/format'
import { Button } from '../ui/Button'
import { ProposalCard } from './ProposalCard'
import { SourceBadge } from './SourceBadge'

/**
 * Help with one task. The answer is advice only; suggested checklist items are added as
 * subtasks only if the user approves them.
 */
export function TaskAiHelp({ task }: { task: Task }) {
  const headingId = useId()
  const assist = useAssistTask()
  const [result, setResult] = useState<{ kind: TaskAssistKind; content: string; source: string; proposal: Proposal | null } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function ask(kind: TaskAssistKind) {
    setError(null)
    try {
      const response = await assist.mutateAsync({ taskId: task.id, kind })
      setResult({ kind, ...response })
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <section aria-labelledby={headingId} className="mt-6 border-t border-line pt-5">
      <h3 id={headingId} className="flex items-center gap-2 font-display font-semibold text-ink">
        <Sparkles aria-hidden="true" className="size-4 text-glow" /> AI help
      </h3>
      <div className="mt-3 flex flex-wrap gap-2">
        {TASK_ASSIST_KINDS.map((kind) => (
          <Button key={kind} onClick={() => ask(kind)} disabled={assist.isPending}>
            {TASK_ASSIST_LABELS[kind]}
          </Button>
        ))}
      </div>
      <div aria-live="polite">
        {assist.isPending && <p className="mt-3 text-sm text-ink-muted">Thinking…</p>}
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
        {result && !assist.isPending && (
          <div className="mt-3 space-y-3">
            <div className="rounded-control border border-line bg-raised p-3 text-sm text-ink">
              <div className="mb-1 flex items-center gap-2">
                <span className="font-medium">{TASK_ASSIST_LABELS[result.kind]}</span>
                <SourceBadge source={result.source} />
              </div>
              <p className="whitespace-pre-line">{result.content}</p>
            </div>
            {result.proposal && (
              <ProposalCard
                proposal={result.proposal}
                title="Add as subtasks?"
                onDecided={(decided) => setResult((current) => (current ? { ...current, proposal: decided } : current))}
              />
            )}
          </div>
        )}
      </div>
    </section>
  )
}
