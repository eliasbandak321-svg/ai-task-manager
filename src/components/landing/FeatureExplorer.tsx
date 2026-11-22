import { Plus } from 'lucide-react'
import { useState } from 'react'
import { PREVIEW_EVENTS } from '../../data/landingPreview'
import { Reveal } from './Reveal'
import { WeekPreview } from './WeekPreview'

const FEATURES = [
  { title: 'Projects, tasks and subtasks', text: 'Every task has a priority, due date and time estimate. Break big ones into subtasks and watch the project fill in.' },
  { title: 'Dependencies that make sense', text: 'Say which task waits on which. Plans follow that order, and circular chains are rejected before they are saved.' },
  { title: 'A calendar built in', text: 'Day, week and month views with recurring events. Drag to move, resize to change length, in your own time zone.' },
  { title: 'Smart scheduling', text: 'Work sessions are placed inside your working hours and around your events, nearest deadline first.' },
  { title: 'AI planning', text: 'Describe a goal and get a phased project plan to review and edit. Ask for a checklist or an explanation on any task.' },
  { title: 'Progress insights', text: 'Tasks finished, completion rate and focus sessions you marked done, so you can see how the week is really going.' },
]

function Visual({ index }: { index: number }) {
  const box = 'rounded-xl border border-line bg-surface px-4 py-3 shadow-soft'
  switch (index) {
    case 0:
      return (
        <>
          <ul className={box}>
            {[['Collect survey responses', 'Medium'], ['Send survey', 'Low', true], ['Clean the data', 'Medium']].map(([title, tag, done]) => (
              <li key={String(title)} className="flex items-center gap-2.5 border-t border-line py-2 text-sm first:border-t-0">
                <i aria-hidden="true" className={`size-4 rounded-[5px] border-[1.5px] ${done ? 'border-glow bg-glow' : 'border-line-strong'}`} />
                <span className={done ? 'text-ink-subtle line-through' : 'text-ink'}>{title}</span>
                <em className="ml-auto rounded-full bg-raised px-2 text-[0.6875rem] text-ink-muted not-italic">{tag}</em>
              </li>
            ))}
          </ul>
          <div className={`${box} flex justify-between text-sm text-ink-muted`}>
            <span>Thesis · due 15 Jan · est. 2 h</span>
            <span className="font-mono text-ink">58%</span>
          </div>
        </>
      )
    case 1:
      return (
        <div className="flex flex-col gap-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            {['Send survey', 'Collect responses', 'Create figures'].map((step, i) => (
              <span key={step} className="contents">
                {i > 0 && <span className="text-ink-subtle">→</span>}
                <span className={`${box} py-2`}>{step}</span>
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-xl border border-danger/50 bg-surface px-3 py-2 text-danger">Create figures → Send survey</span>
            <span className="text-danger">Circular dependency, not saved</span>
          </div>
        </div>
      )
    case 2:
      return (
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <WeekPreview events={PREVIEW_EVENTS} startHour={9} endHour={17} rowHeight={26} />
        </div>
      )
    case 3:
      return (
        <>
          <div className={`${box} grid gap-2 text-sm`}>
            <b className="text-ink">Your working hours</b>
            <span className="text-ink-muted">Mon–Fri · 08:00–18:00 · 90 min sessions · 15 min breaks · max 6 h a day</span>
          </div>
          <div className={`${box} grid gap-1.5 text-sm`}>
            <b className="text-ink">Proposed</b>
            <span className="font-mono text-ink-muted">Tue 14:00 Survey design · Wed 11:00 Problem set 4 · Fri 14:00 Lectures 6–8</span>
          </div>
        </>
      )
    case 4:
      return (
        <>
          <div className={`${box} text-sm text-ink`}>
            <p className="mb-1 text-xs text-ink-subtle">Assistant</p>
            Here's a plan for "Learn React in 6 weeks": 3 phases, 11 tasks, with estimates and subtasks. Review it before anything is created.
          </div>
          <div className={`${box} flex justify-end gap-2`}>
            <span className="lp-btn lp-btn-sm">Edit</span>
            <span className="lp-btn lp-btn-primary lp-btn-sm">Create project</span>
          </div>
        </>
      )
    default:
      return (
        <div className="grid grid-cols-2 gap-3.5">
          {[['14', 'tasks done this week'], ['86%', 'finished on time'], ['9.5 h', 'focus marked done'], ['1', 'overdue']].map(([value, label]) => (
            <div key={label} className={box}>
              <b className="block font-display text-3xl tracking-tight text-ink">{value}</b>
              <span className="text-sm text-ink-muted">{label}</span>
            </div>
          ))}
        </div>
      )
  }
}

/** Features as an accordion beside a visual that changes with the open item (sample data). */
export function FeatureExplorer() {
  const [open, setOpen] = useState(0)
  return (
    <section id="features" aria-labelledby="features-title" className="scroll-mt-24 px-5 py-[clamp(88px,12vw,150px)] md:px-8">
      <div className="mx-auto max-w-[75rem]">
        <Reveal className="max-w-[51rem]">
          <p className="lp-eyebrow">Features</p>
          <h2 id="features-title" className="lp-h2 text-ink">
            One calm place for <span className="lp-serif text-gradient">everything</span> on your plate.
          </h2>
        </Reveal>
        <div className="mt-16 grid items-start gap-10 lg:grid-cols-2 lg:gap-14">
          <Reveal className="lp-stage relative grid place-items-center rounded-[26px] border border-line p-7 lg:sticky lg:top-28 lg:aspect-[5/4]">
            <div aria-live="polite" className="flex w-full max-w-[26rem] flex-col gap-2.5 lp-panel" key={open}>
              <Visual index={open} />
            </div>
          </Reveal>
          <ul className="border-t border-line">
            {FEATURES.map((feature, index) => {
              const isOpen = open === index
              return (
                <li key={feature.title} className="relative border-b border-line">
                  <h3>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      aria-controls={`feature-${index}`}
                      onClick={() => setOpen(index)}
                      onMouseEnter={() => {
                        if (window.matchMedia?.('(hover: hover) and (min-width: 1024px)').matches) setOpen(index)
                      }}
                      className="grid w-full grid-cols-[2.625rem_minmax(0,1fr)_1.5rem] items-start gap-3.5 px-1.5 py-6 text-left"
                    >
                      <span className="pt-2 font-mono text-xs text-ink-subtle">{String(index + 1).padStart(2, '0')}</span>
                      <span className={`font-display text-[clamp(1.25rem,2.2vw,1.6rem)] leading-snug font-semibold tracking-tight transition-colors duration-(--duration-fast) ${isOpen ? 'text-ink' : 'text-ink-muted hover:text-ink'}`}>{feature.title}</span>
                      <span aria-hidden="true" className={`mt-1.5 grid size-6 place-items-center rounded-full border transition-transform duration-300 ${isOpen ? 'rotate-45 border-transparent bg-btn text-btn-ink' : 'border-line-strong'}`}>
                        <Plus className="size-3" />
                      </span>
                    </button>
                  </h3>
                  <p id={`feature-${index}`} hidden={!isOpen} className="-mt-3 max-w-[calc(46ch+3.875rem)] px-9 pb-6 pl-[3.875rem] text-ink-muted">
                    {feature.text}
                  </p>
                  {isOpen && <span aria-hidden="true" className="lp-rule-gradient absolute inset-x-0 -bottom-px h-px" />}
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </section>
  )
}
