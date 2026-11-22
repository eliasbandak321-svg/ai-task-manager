import { useState } from 'react'
import { PREVIEW_EVENTS, PREVIEW_PROPOSED } from '../../data/landingPreview'
import { Reveal } from './Reveal'
import { WeekPreview } from './WeekPreview'

const FACTS = [
  ['Working hours', 'Sessions stay inside your day'],
  ['Deadline first', 'The most urgent work gets time first'],
  ['Recurring events', 'Edit one, the following, or all'],
  ['Your time zone', 'Times stay right when you travel'],
]

/** "Plan my week" as an interactive example: proposed sessions appear dashed, then become events. */
export function SchedulingShowcase() {
  const [step, setStep] = useState<'idle' | 'proposed' | 'approved'>('idle')
  const events = step === 'idle' ? PREVIEW_EVENTS : [...PREVIEW_EVENTS, ...PREVIEW_PROPOSED.map((event) => ({ ...event, proposed: step === 'proposed' }))]
  return (
    <section id="scheduling" aria-labelledby="scheduling-title" className="scroll-mt-24 px-5 py-[clamp(88px,12vw,150px)] md:px-8">
      <div className="mx-auto grid max-w-[75rem] items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16">
        <Reveal className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line px-4 py-3.5">
            <b className="font-display font-semibold text-ink">This week</b>
            <span className="font-mono text-xs text-ink-subtle">Example · 09:00–18:00</span>
          </div>
          <WeekPreview events={events} />
          <div className="flex min-h-14 flex-wrap items-center gap-2.5 border-t border-line bg-raised px-4 py-3 text-sm text-ink-muted" aria-live="polite">
            <span>{step === 'idle' ? 'Free time is waiting to be used.' : step === 'proposed' ? '3 sessions proposed around your classes.' : '✓ Added to your calendar'}</span>
            <button type="button" onClick={() => setStep(step === 'idle' ? 'proposed' : step === 'proposed' ? 'approved' : 'idle')} className="lp-btn lp-btn-primary lp-btn-sm ml-auto min-h-9">
              {step === 'idle' ? 'Plan my week' : step === 'proposed' ? 'Approve' : 'Reset example'}
            </button>
          </div>
        </Reveal>
        <Reveal>
          <p className="lp-eyebrow">Calendar &amp; smart scheduling</p>
          <h2 id="scheduling-title" className="lp-h2 text-ink">
            Your free time, <span className="lp-serif text-gradient">put to work.</span>
          </h2>
          <p className="mt-5 max-w-[52ch] text-[1.08rem] text-ink-muted">
            Classes, meetings and work sessions share one week. Press the button in the example: the scheduler proposes sessions as dashed blocks, and they only become events once you approve them.
          </p>
          <dl className="mt-8 grid border-t border-line sm:grid-cols-2">
            {FACTS.map(([title, text], index) => (
              <div key={title} className={`border-b border-line py-4 ${index % 2 === 0 ? 'sm:border-r sm:pr-4' : 'sm:pl-4'}`}>
                <dt className="font-display font-semibold text-ink">{title}</dt>
                <dd className="text-sm text-ink-muted">{text}</dd>
              </div>
            ))}
          </dl>
        </Reveal>
      </div>
    </section>
  )
}
