import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useReveal } from '../../hooks/useReveal'
import { Reveal } from './Reveal'

const SESSIONS = [
  { title: 'Practice problem set 4', when: 'Fri 14:00–15:30' },
  { title: 'Review lectures 6–8', when: 'Sat 10:00–11:30' },
  { title: 'Mock exam', when: 'Mon 16:00–17:30' },
]

const POINTS = [
  ['Nothing changes on its own.', 'Every change is a proposal you approve or reject, and unanswered ones expire.'],
  ['Checked against fresh data.', 'If a task changed since the suggestion, the proposal is stopped instead of overwriting it.'],
  ['Clearly labelled.', 'Answers from the built-in Demo AI say so.'],
]

/** The assistant's approve/reject flow, as an interactive example with sample content. */
export function AssistantShowcase() {
  const { ref, revealed } = useReveal<HTMLElement>()
  const [answered, setAnswered] = useState(false)
  const [included, setIncluded] = useState(() => SESSIONS.map(() => true))
  const [decision, setDecision] = useState<'approved' | 'rejected' | null>(null)

  useEffect(() => {
    if (!revealed || answered) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const timer = window.setTimeout(() => setAnswered(true), reduce ? 0 : 1100)
    return () => window.clearTimeout(timer)
  }, [revealed, answered])

  const count = included.filter(Boolean).length
  return (
    <section id="assistant" aria-labelledby="assistant-title" className="relative scroll-mt-24 overflow-hidden px-5 py-[clamp(88px,12vw,150px)] md:px-8">
      <div aria-hidden="true" className="lp-ai-wash pointer-events-none absolute inset-y-[8%] -right-[10%] -left-[10%] -z-1 opacity-90" />
      <div className="mx-auto grid max-w-[75rem] items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-16">
        <Reveal>
          <p className="lp-eyebrow">AI Assistant</p>
          <h2 id="assistant-title" className="lp-h2 text-ink">
            It suggests. <span className="lp-serif text-gradient">You decide.</span>
          </h2>
          <p className="mt-5 max-w-[52ch] text-[1.08rem] text-ink-muted">The assistant answers from your own tasks and calendar. When it proposes a change, you see exactly what would happen first.</p>
          <ul className="mt-8 border-b border-line">
            {POINTS.map(([title, text]) => (
              <li key={title} className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3 border-t border-line py-3.5 text-ink-muted">
                <Check aria-hidden="true" className="mt-1 size-4.5 text-glow" />
                <span>
                  <b className="font-semibold text-ink">{title}</b> {text}
                </span>
              </li>
            ))}
          </ul>
        </Reveal>
        <section ref={ref} aria-label="Example conversation (sample data)" className="rounded-3xl border border-line bg-surface/80 p-5 shadow-card backdrop-blur-xl md:p-6">
          <div className="flex flex-col gap-3.5 text-[0.9375rem]">
            <p className="max-w-[82%] self-end rounded-[16px_16px_4px_16px] bg-btn px-4 py-2.5 text-btn-ink">The statistics exam is on Tuesday. Can you plan my study time?</p>
            <p className="text-xs text-ink-subtle">Assistant · example</p>
            {!answered ? (
              <span aria-label="Assistant is writing" className="inline-flex w-max gap-1 rounded-2xl bg-raised px-3.5 py-2.5">
                {[0, 1, 2].map((dot) => (
                  <i key={dot} className="size-1.5 rounded-full bg-ink-subtle motion-safe:animate-pulse" style={{ animationDelay: `${dot * 150}ms` }} />
                ))}
              </span>
            ) : (
              <div aria-live="polite">
                <p className="mb-3 text-ink">You have 3 open tasks in Statistics exam, about 4.5 hours. I found 3 free slots before Tuesday that avoid your classes.</p>
                <article aria-label="Proposed change" className="overflow-hidden rounded-2xl border border-line bg-surface">
                  <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3 text-sm font-semibold text-ink">
                    Plan 3 study sessions <span className="font-mono text-xs font-normal text-ink-subtle">expires in 24 h</span>
                  </header>
                  {SESSIONS.map((session, index) => (
                    <label key={session.title} className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-line px-4 py-2.5 text-sm">
                      <input
                        type="checkbox"
                        className="size-4 accent-glow"
                        checked={included[index]}
                        disabled={decision !== null}
                        onChange={(event) => setIncluded((current) => current.map((value, i) => (i === index ? event.target.checked : value)))}
                      />
                      <span className="text-ink">{session.title}</span>
                      <span className="font-mono text-xs text-ink-muted">{session.when}</span>
                    </label>
                  ))}
                  <footer className="flex flex-wrap items-center gap-2 bg-raised px-4 py-3">
                    <p className="mr-auto text-sm text-ink-subtle" aria-live="polite">
                      {decision === 'approved' ? (
                        <span className="font-medium text-ok">✓ Approved · {count} session{count === 1 ? '' : 's'} added</span>
                      ) : decision === 'rejected' ? (
                        'Rejected · nothing changed'
                      ) : (
                        'Nothing changes until you approve.'
                      )}
                    </p>
                    <button type="button" disabled={decision !== null} onClick={() => setDecision('rejected')} className="lp-btn lp-btn-sm min-h-9 disabled:opacity-50">Reject</button>
                    <button type="button" disabled={decision !== null || count === 0} onClick={() => setDecision('approved')} className="lp-btn lp-btn-primary lp-btn-sm min-h-9 disabled:opacity-50">Approve</button>
                  </footer>
                </article>
              </div>
            )}
          </div>
        </section>
      </div>
    </section>
  )
}
