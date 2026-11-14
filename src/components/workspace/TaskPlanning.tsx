import { GitBranch } from 'lucide-react'
import { useId, useState } from 'react'
import type { Task } from '../../domain'
import { useToast } from '../../hooks/toast'
import { useDependenciesQuery, useEffortQuery, useSetDependencies } from '../../hooks/workspaceQueries'
import { errorMessage } from '../../lib/format'
import { formatMinutes } from '../../lib/time'
import { Button } from '../ui/Button'
import { checkboxClass } from '../ui/styles'

interface TaskPlanningProps {
  task: Task
  /** All of the user's tasks, to choose prerequisites from. */
  tasks: readonly Task[]
}

/**
 * Effort (estimated, done, planned, remaining) and prerequisites of one task. Prerequisites
 * are saved separately from the task form and checked for circular dependencies.
 */
export function TaskPlanning({ task, tasks }: TaskPlanningProps) {
  const headingId = useId()
  const effortQuery = useEffortQuery()
  const dependenciesQuery = useDependenciesQuery()
  const setDependencies = useSetDependencies()
  const showToast = useToast()
  const saved = (dependenciesQuery.data ?? []).filter((edge) => edge.taskId === task.id).map((edge) => edge.dependsOnId)
  const [selected, setSelected] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const current = selected ?? saved
  const candidates = tasks.filter((other) => other.id !== task.id && (other.status !== 'done' || current.includes(other.id)))
  const effort = effortQuery.data?.[task.id]
  const changed = selected !== null && [...selected].sort().join() !== [...saved].sort().join()

  async function save() {
    setError(null)
    try {
      await setDependencies.mutateAsync({ taskId: task.id, dependsOn: current })
      setSelected(null)
      showToast('Dependencies saved')
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  return (
    <section aria-labelledby={headingId} className="mt-6 border-t border-line pt-5">
      <h3 id={headingId} className="flex items-center gap-2 font-display font-semibold text-ink">
        <GitBranch aria-hidden="true" className="size-4 text-glow" /> Planning
      </h3>

      {effort && (
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {[
            ['Estimated', effort.estimatedMinutes === null ? 'Not set' : formatMinutes(effort.estimatedMinutes)],
            ['Done', formatMinutes(effort.completedMinutes)],
            ['Planned', formatMinutes(effort.plannedMinutes)],
            ['Remaining', effort.remainingMinutes === null ? '—' : formatMinutes(effort.remainingMinutes)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-control border border-line p-2">
              <dt className="text-ink-muted">{label}</dt>
              <dd className="font-medium tabular-nums text-ink">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {effort && effort.missedMinutes > 0 && (
        <p className="mt-2 text-sm text-priority-medium">
          {formatMinutes(effort.missedMinutes)} of past sessions aren't marked. Mark them done or skipped in the calendar agenda, so remaining effort is right.
        </p>
      )}

      <fieldset className="mt-4">
        <legend className="text-sm font-medium text-ink">Depends on</legend>
        <p className="text-sm text-ink-subtle">The scheduler starts this task only after these are finished.</p>
        {candidates.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">No other open tasks.</p>
        ) : (
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto pr-1">
            {candidates.map((other) => (
              <li key={other.id}>
                <label className="flex min-h-11 items-center gap-3 rounded-control px-2 text-sm text-ink hover:bg-raised">
                  <input
                    type="checkbox"
                    className={checkboxClass}
                    checked={current.includes(other.id)}
                    onChange={(event) => setSelected(event.target.checked ? [...current, other.id] : current.filter((id) => id !== other.id))}
                  />
                  <span className="truncate">{other.title}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </fieldset>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
      {changed && (
        <Button className="mt-3" onClick={save} disabled={setDependencies.isPending}>
          {setDependencies.isPending ? 'Saving…' : 'Save dependencies'}
        </Button>
      )}
    </section>
  )
}
