import { ArrowDown, ArrowUp, Plus, RefreshCcw, Trash2, Wand2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { z } from 'zod'
import { SourceBadge } from '../components/workspace/SourceBadge'
import { Button } from '../components/ui/Button'
import { Field } from '../components/ui/Field'
import { controlClass } from '../components/ui/styles'
import { AI_LIMITS, projectPlanSchema, TASK_PRIORITIES, type PlanPayload, type Proposal, type ProjectPlan, type TaskPriority } from '../domain'
import { useToast } from '../hooks/toast'
import { useToday } from '../hooks/useToday'
import { useApplyProposal, useGeneratePlan, useProposalsQuery, useRejectProposal } from '../hooks/workspaceQueries'
import { errorMessage } from '../lib/format'
import { addPhase, addTask, movePhase, moveTask, removeTask, renamePhase, totalMinutes, updateTask } from '../lib/planEditing'
import { formatMinutes } from '../lib/time'

type PlanProposal = Proposal & { payload: PlanPayload }
const isPlan = (proposal: Proposal): proposal is PlanProposal => proposal.payload.kind === 'plan'
const appliedResultSchema = z.object({ projectId: z.string() })

/**
 * The project & goal builder: describe a goal, get a plan, edit it freely, then save it.
 * Nothing is created until "Create project"; a plan can be saved only once.
 */
export function PlanBuilderPage() {
  const [searchParams] = useSearchParams()
  const today = useToday()
  const [goal, setGoal] = useState(searchParams.get('goal') ?? '')
  const [details, setDetails] = useState('')
  const [deadline, setDeadline] = useState('')
  const [hours, setHours] = useState('')
  const [proposal, setProposal] = useState<PlanProposal | null>(null)
  const [plan, setPlan] = useState<ProjectPlan | null>(null)
  const [error, setError] = useState<string | null>(null)
  const generate = useGeneratePlan()
  const apply = useApplyProposal()
  const reject = useRejectProposal()
  const pending = useProposalsQuery()
  const navigate = useNavigate()
  const showToast = useToast()
  const lastPending = (pending.data ?? []).find(isPlan)

  function open(next: PlanProposal) {
    setProposal(next)
    setPlan(next.payload.plan)
    setGoal(next.payload.request.goal)
    setDetails(next.payload.request.details)
    setDeadline(next.payload.request.deadline ?? '')
    setHours(next.payload.request.hoursPerWeek ? String(next.payload.request.hoursPerWeek) : '')
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault()
    setError(null)
    try {
      // A regenerated plan replaces the previous one, which is dismissed.
      if (proposal && proposal.status === 'pending') await reject.mutateAsync(proposal.id).catch(() => undefined)
      const created = await generate.mutateAsync({
        goal,
        details,
        deadline: deadline || null,
        hoursPerWeek: hours ? Number(hours) : null,
      })
      if (isPlan(created)) open(created)
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  async function save() {
    if (!proposal || !plan) return
    const parsed = projectPlanSchema.safeParse(plan)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the plan.')
      return
    }
    setError(null)
    try {
      const applied = await apply.mutateAsync({ id: proposal.id, input: { plan: parsed.data } })
      const result = appliedResultSchema.safeParse(applied.result)
      showToast('Project created.')
      navigate(result.success ? `/app/projects/${result.data.projectId}` : '/app/projects')
    } catch (caught) {
      setError(errorMessage(caught))
    }
  }

  async function discard() {
    if (proposal) await reject.mutateAsync(proposal.id).catch(() => undefined)
    setProposal(null)
    setPlan(null)
  }

  const busy = generate.isPending || apply.isPending

  return (
    <div className="space-y-6">
      <title>Plan builder · AI Task Manager</title>
      <div>
        <p className="text-sm">
          <Link to="/app/assistant" className="text-glow underline-offset-4 hover:underline">
            AI Assistant
          </Link>
        </p>
        <h1 className="mt-1 font-display text-h2 font-semibold text-ink">Plan a goal</h1>
        <p className="mt-1 text-ink-muted">Describe what you want to achieve. You can edit everything before anything is saved.</p>
      </div>

      {!plan && lastPending && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-glow/40 p-4 text-sm">
          <span className="text-ink">You have an unsaved plan: “{lastPending.payload.plan.projectName}”.</span>
          <Button onClick={() => open(lastPending)}>Continue editing</Button>
        </div>
      )}

      <form onSubmit={submit} noValidate className="space-y-4 rounded-card border border-line bg-surface p-5">
        <Field label="Your goal" hint="For example: “Pass my statistics exam”, “Launch my portfolio website”">
          {(control) => <textarea {...control} required rows={2} maxLength={AI_LIMITS.message} className={`${controlClass} py-2`} value={goal} onChange={(e) => setGoal(e.target.value)} />}
        </Field>
        <Field label="Details (optional)" hint="Constraints, what you already have, or answers to the questions below">
          {(control) => <textarea {...control} rows={2} maxLength={AI_LIMITS.message} className={`${controlClass} py-2`} value={details} onChange={(e) => setDetails(e.target.value)} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Deadline (optional)">
            {(control) => <input {...control} type="date" min={today} className={controlClass} value={deadline} onChange={(e) => setDeadline(e.target.value)} />}
          </Field>
          <Field label="Hours per week (optional)">
            {(control) => <input {...control} type="number" min={1} max={80} inputMode="numeric" className={controlClass} value={hours} onChange={(e) => setHours(e.target.value)} />}
          </Field>
        </div>
        <Button type="submit" variant="primary" disabled={busy || !goal.trim()}>
          {plan ? <RefreshCcw aria-hidden="true" className="size-4" /> : <Wand2 aria-hidden="true" className="size-4" />}
          {generate.isPending ? 'Generating…' : plan ? 'Regenerate plan' : 'Generate plan'}
        </Button>
      </form>

      {error && (
        <p role="alert" className="rounded-control border border-danger/50 p-3 text-sm text-ink">
          {error}
        </p>
      )}

      {plan && proposal && (
        <section aria-labelledby="plan-heading" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="plan-heading" className="font-display text-h3 font-semibold text-ink">
              Plan preview
            </h2>
            <span className="flex items-center gap-2 text-sm text-ink-muted">
              <SourceBadge source={proposal.source} /> {plan.phases.flatMap((p) => p.tasks).length} tasks · {formatMinutes(totalMinutes(plan))}
            </span>
          </div>
          {proposal.source === 'mock' && (
            <p className="text-sm text-ink-muted">This is a template plan from the demo provider, not AI-generated. Edit it to fit your goal.</p>
          )}

          <Field label="Project name">
            {(control) => <input {...control} className={controlClass} value={plan.projectName} maxLength={80} onChange={(e) => setPlan({ ...plan, projectName: e.target.value })} />}
          </Field>
          {plan.summary && <p className="text-sm text-ink-muted">{plan.summary}</p>}
          {plan.clarifyingQuestions.length > 0 && (
            <div className="rounded-control border border-line p-3 text-sm">
              <p className="font-medium text-ink">Questions that would improve the plan</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink-muted">
                {plan.clarifyingQuestions.map((question) => (
                  <li key={question}>{question}</li>
                ))}
              </ul>
              <p className="mt-1 text-ink-subtle">Answer them in “Details” and regenerate, or just edit the plan.</p>
            </div>
          )}

          {plan.phases.map((phase, phaseIndex) => (
            <fieldset key={`${phaseIndex}-${phase.tasks[0]?.key}`} className="space-y-3 rounded-card border border-line bg-surface p-4">
              <legend className="sr-only">{`Phase ${phaseIndex + 1}: ${phase.name}`}</legend>
              <div className="flex flex-wrap items-end gap-2">
                <Field label={`Phase ${phaseIndex + 1}`} className="min-w-0 flex-1">
                  {(control) => <input {...control} className={controlClass} value={phase.name} maxLength={80} onChange={(e) => setPlan(renamePhase(plan, phaseIndex, e.target.value))} />}
                </Field>
                <Button variant="ghost" iconOnly aria-label={`Move phase ${phase.name} up`} disabled={phaseIndex === 0} onClick={() => setPlan(movePhase(plan, phaseIndex, -1))}>
                  <ArrowUp aria-hidden="true" className="size-4" />
                </Button>
                <Button variant="ghost" iconOnly aria-label={`Move phase ${phase.name} down`} disabled={phaseIndex === plan.phases.length - 1} onClick={() => setPlan(movePhase(plan, phaseIndex, 1))}>
                  <ArrowDown aria-hidden="true" className="size-4" />
                </Button>
              </div>

              <ol className="space-y-3">
                {phase.tasks.map((task, taskIndex) => {
                  const setTask = (changes: Parameters<typeof updateTask>[3]) => setPlan(updateTask(plan, phaseIndex, taskIndex, changes))
                  return (
                    <li key={task.key} className="space-y-3 rounded-control border border-line p-3">
                      <div className="flex flex-wrap items-end gap-2">
                        <Field label="Task" className="min-w-0 flex-1">
                          {(control) => <input {...control} className={controlClass} value={task.title} maxLength={200} onChange={(e) => setTask({ title: e.target.value })} />}
                        </Field>
                        <Button variant="ghost" iconOnly aria-label={`Move ${task.title} up`} disabled={taskIndex === 0} onClick={() => setPlan(moveTask(plan, phaseIndex, taskIndex, -1))}>
                          <ArrowUp aria-hidden="true" className="size-4" />
                        </Button>
                        <Button variant="ghost" iconOnly aria-label={`Move ${task.title} down`} disabled={taskIndex === phase.tasks.length - 1} onClick={() => setPlan(moveTask(plan, phaseIndex, taskIndex, 1))}>
                          <ArrowDown aria-hidden="true" className="size-4" />
                        </Button>
                        <Button variant="ghost" iconOnly aria-label={`Remove ${task.title}`} onClick={() => setPlan(removeTask(plan, phaseIndex, taskIndex))}>
                          <Trash2 aria-hidden="true" className="size-4" />
                        </Button>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Field label="Priority">
                          {(control) => (
                            <select {...control} className={controlClass} value={task.priority} onChange={(e) => setTask({ priority: e.target.value as TaskPriority })}>
                              {TASK_PRIORITIES.map((priority) => (
                                <option key={priority} value={priority}>
                                  {priority[0].toUpperCase() + priority.slice(1)}
                                </option>
                              ))}
                            </select>
                          )}
                        </Field>
                        <Field label="Estimate (min)">
                          {(control) => (
                            <input
                              {...control}
                              type="number"
                              min={5}
                              max={6000}
                              step={5}
                              className={controlClass}
                              value={task.estimatedMinutes ?? ''}
                              onChange={(e) => setTask({ estimatedMinutes: e.target.value ? Math.round(Number(e.target.value)) : null })}
                            />
                          )}
                        </Field>
                        <Field label="Due date">
                          {(control) => <input {...control} type="date" min={today} className={controlClass} value={task.dueDate ?? ''} onChange={(e) => setTask({ dueDate: e.target.value || null })} />}
                        </Field>
                      </div>
                      <Field label="Description">
                        {(control) => <textarea {...control} rows={2} maxLength={1000} className={`${controlClass} py-2`} value={task.description} onChange={(e) => setTask({ description: e.target.value })} />}
                      </Field>
                      <Field label="Subtasks" hint="One per line (up to 10)">
                        {(control) => (
                          <textarea
                            {...control}
                            rows={Math.max(2, task.subtasks.length)}
                            className={`${controlClass} py-2`}
                            value={task.subtasks.join('\n')}
                            onChange={(e) => setTask({ subtasks: e.target.value.split('\n').slice(0, 10) })}
                            onBlur={() => setTask({ subtasks: task.subtasks.map((s) => s.trim()).filter(Boolean) })}
                          />
                        )}
                      </Field>
                      {task.dependsOn.length > 0 && (
                        <p className="text-xs text-ink-muted">
                          After:{' '}
                          {task.dependsOn
                            .map((key) => plan.phases.flatMap((p) => p.tasks).find((t) => t.key === key)?.title ?? key)
                            .join('; ')}
                        </p>
                      )}
                    </li>
                  )
                })}
              </ol>
              <Button variant="ghost" onClick={() => setPlan(addTask(plan, phaseIndex))}>
                <Plus aria-hidden="true" className="size-4" /> Add task
              </Button>
            </fieldset>
          ))}

          <Button variant="ghost" onClick={() => setPlan(addPhase(plan))}>
            <Plus aria-hidden="true" className="size-4" /> Add phase
          </Button>

          <div className="flex flex-wrap gap-2 border-t border-line pt-4">
            <Button variant="primary" onClick={save} disabled={busy || proposal.status !== 'pending'}>
              {apply.isPending ? 'Creating…' : 'Create project'}
            </Button>
            <Button variant="ghost" onClick={discard} disabled={busy}>
              Discard plan
            </Button>
          </div>
        </section>
      )}
    </div>
  )
}
