import { useState, type FormEvent } from 'react'
import { SourceBadge } from '../components/workspace/SourceBadge'
import { Button } from '../components/ui/Button'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { Field } from '../components/ui/Field'
import { LoadingMessage } from '../components/ui/LoadingMessage'
import { checkboxClass, controlClass } from '../components/ui/styles'
import { FOCUS_PERIODS, preferencesSchema, USE_CASE_LABELS, USE_CASES, type FocusPeriod, type Preferences, type UseCase } from '../domain'
import { useToast } from '../hooks/toast'
import { browserTimeZone, useAiStatusQuery, usePreferencesQuery, useSavePreferences } from '../hooks/workspaceQueries'
import { errorMessage } from '../lib/format'
import { clockToMinutes, minutesToClock } from '../lib/time'

const WEEKDAYS = [
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
  { value: 0, label: 'Sunday' },
]

const FOCUS_LABELS: Record<FocusPeriod, string> = {
  morning: 'Morning (before 12:00)',
  afternoon: 'Afternoon (12:00–17:00)',
  evening: 'Evening (after 17:00)',
  none: 'No preference',
}

function timeZones(current: string): string[] {
  let zones: string[] = []
  try {
    zones = Intl.supportedValuesOf('timeZone')
  } catch {
    zones = []
  }
  return [...new Set([current, browserTimeZone(), 'UTC', ...zones])].sort()
}

/** Availability (used by the scheduler) and personalization. */
export function SettingsPage() {
  const preferencesQuery = usePreferencesQuery()
  if (preferencesQuery.isPending) return <LoadingMessage label="Loading settings…" />
  if (preferencesQuery.isError) {
    return <ErrorMessage title="Settings couldn't be loaded" message={errorMessage(preferencesQuery.error)} onRetry={() => preferencesQuery.refetch()} />
  }
  return <SettingsForm initial={preferencesQuery.data.preferences} saved={preferencesQuery.data.saved} />
}

function SettingsForm({ initial, saved }: { initial: Preferences; saved: boolean }) {
  const [values, setValues] = useState(initial)
  const [startClock, setStartClock] = useState(minutesToClock(initial.dayStartMinutes))
  const [endClock, setEndClock] = useState(minutesToClock(initial.dayEndMinutes))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const save = useSavePreferences()
  const showToast = useToast()
  const aiStatus = useAiStatusQuery()
  const zones = timeZones(initial.timeZone)
  const set = <K extends keyof Preferences>(key: K, value: Preferences[K]) => setValues((current) => ({ ...current, [key]: value }))

  async function submit(event: FormEvent) {
    event.preventDefault()
    const start = clockToMinutes(startClock)
    const end = clockToMinutes(endClock)
    const parsed = preferencesSchema.safeParse({ ...values, dayStartMinutes: start ?? -1, dayEndMinutes: end ?? -1 })
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])))
      return
    }
    setErrors({})
    try {
      await save.mutateAsync(parsed.data)
      showToast('Settings saved.')
    } catch (error) {
      showToast(errorMessage(error), 'error')
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <title>Settings · AI Task Manager</title>
      <div>
        <h1 className="font-display text-h2 font-semibold text-ink">Settings</h1>
        <p className="mt-1 text-ink-muted">
          The scheduler only plans work inside these hours and around your calendar.{!saved && ' These are defaults until you save.'}
        </p>
      </div>

      <form onSubmit={submit} noValidate className="space-y-6">
        <section className="space-y-4 rounded-card border border-line bg-surface p-5">
          <h2 className="font-display text-h3 font-semibold text-ink">Availability</h2>
          <Field label="Time zone" hint={values.timeZone !== browserTimeZone() ? `Your browser uses ${browserTimeZone()}; the calendar shows times in the browser's zone.` : undefined} error={errors.timeZone}>
            {(control) => (
              <select {...control} className={controlClass} value={values.timeZone} onChange={(event) => set('timeZone', event.target.value)}>
                {zones.map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <fieldset aria-describedby={errors.workDays ? 'workdays-error' : undefined}>
            <legend className="text-sm font-medium text-ink">Working days</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {WEEKDAYS.map((day) => (
                <label key={day.value} className="flex min-h-11 items-center gap-2 rounded-control border border-line px-3 text-sm text-ink">
                  <input
                    type="checkbox"
                    className={checkboxClass}
                    checked={values.workDays.includes(day.value)}
                    onChange={(event) =>
                      set('workDays', event.target.checked ? [...values.workDays, day.value] : values.workDays.filter((d) => d !== day.value))
                    }
                  />
                  {day.label}
                </label>
              ))}
            </div>
            {errors.workDays && (
              <p id="workdays-error" className="mt-1 text-sm text-danger">
                {errors.workDays}
              </p>
            )}
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Day starts" error={errors.dayStartMinutes}>
              {(control) => <input {...control} type="time" className={controlClass} value={startClock} onChange={(event) => setStartClock(event.target.value)} />}
            </Field>
            <Field label="Day ends" error={errors.dayEndMinutes}>
              {(control) => <input {...control} type="time" className={controlClass} value={endClock} onChange={(event) => setEndClock(event.target.value)} />}
            </Field>
          </div>

          <Field label="Best time for focused work" error={errors.focusPeriod}>
            {(control) => (
              <select {...control} className={controlClass} value={values.focusPeriod} onChange={(event) => set('focusPeriod', event.target.value as FocusPeriod)}>
                {FOCUS_PERIODS.map((period) => (
                  <option key={period} value={period}>
                    {FOCUS_LABELS[period]}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Session length (min)" hint="15–240" error={errors.sessionMinutes}>
              {(control) => (
                <input {...control} type="number" inputMode="numeric" min={15} max={240} step={5} className={controlClass} value={values.sessionMinutes} onChange={(event) => set('sessionMinutes', Number(event.target.value))} />
              )}
            </Field>
            <Field label="Break between (min)" hint="0–60" error={errors.breakMinutes}>
              {(control) => (
                <input {...control} type="number" inputMode="numeric" min={0} max={60} step={5} className={controlClass} value={values.breakMinutes} onChange={(event) => set('breakMinutes', Number(event.target.value))} />
              )}
            </Field>
            <Field label="Max work per day (h)" hint="0.5–16" error={errors.maxDailyMinutes}>
              {(control) => (
                <input {...control} type="number" inputMode="decimal" min={0.5} max={16} step={0.5} className={controlClass} value={values.maxDailyMinutes / 60} onChange={(event) => set('maxDailyMinutes', Math.round(Number(event.target.value) * 60))} />
              )}
            </Field>
          </div>
        </section>

        <section className="space-y-4 rounded-card border border-line bg-surface p-5">
          <h2 className="font-display text-h3 font-semibold text-ink">Personalization</h2>
          <Field label="I mainly use this app as" hint="Adapts AI examples and plan templates. You can plan anything regardless." error={errors.useCase}>
            {(control) => (
              <select {...control} className={controlClass} value={values.useCase} onChange={(event) => set('useCase', event.target.value as UseCase)}>
                {USE_CASES.map((useCase) => (
                  <option key={useCase} value={useCase}>
                    {USE_CASE_LABELS[useCase]}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </section>

        <Button type="submit" variant="primary" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save settings'}
        </Button>
      </form>

      <section className="space-y-2 rounded-card border border-line bg-surface p-5 text-sm">
        <h2 className="font-display text-h3 font-semibold text-ink">AI</h2>
        {aiStatus.data ? (
          <>
            <p className="flex flex-wrap items-center gap-2 text-ink">
              Provider: <SourceBadge source={aiStatus.data.provider} />
              {aiStatus.data.model && <span className="text-ink-muted">({aiStatus.data.model})</span>}
            </p>
            {aiStatus.data.isDemo && (
              <p className="text-ink-muted">
                No AI service is connected. AI features use built-in demo responses: rule-based answers from your own data and template plans, not a language model.
              </p>
            )}
            <p className="text-ink-muted">
              AI requests today: {aiStatus.data.usedToday} of {aiStatus.data.dailyLimit}
            </p>
          </>
        ) : (
          <p className="text-ink-muted">{aiStatus.isError ? "AI status couldn't be loaded." : 'Loading…'}</p>
        )}
      </section>
    </div>
  )
}
