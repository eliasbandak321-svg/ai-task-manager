import { useState } from 'react'
import { Reveal } from './Reveal'

const PROJECTS = [
  { name: 'Thesis', detail: '12 tasks · due 15 Jan', base: 58, colour: 'var(--lp-focus)' },
  { name: 'Statistics exam', detail: '8 tasks · exam Tue', base: 35, colour: 'var(--lp-class)' },
  { name: 'Portfolio site', detail: '6 tasks · 1 overdue', base: 80, colour: 'var(--lp-meet)' },
]
const SUBTASKS = ['Send reminder email', 'Export responses to CSV', 'Remove incomplete answers']
const CIRCUMFERENCE = 131.9

function Ring({ percent, colour }: { percent: number; colour: string }) {
  return (
    <svg viewBox="0 0 52 52" className="size-[52px]" aria-hidden="true">
      <circle cx="26" cy="26" r="21" fill="none" strokeWidth="5" className="stroke-raised" />
      <circle cx="26" cy="26" r="21" fill="none" strokeWidth="5" stroke={colour} strokeLinecap="round" strokeDasharray={CIRCUMFERENCE} strokeDashoffset={(CIRCUMFERENCE * (1 - percent / 100)).toFixed(1)} className="origin-center -rotate-90 transition-[stroke-dashoffset] duration-700" />
      <text x="26" y="30" textAnchor="middle" className="fill-ink font-mono text-[11px] font-semibold">{percent}%</text>
    </svg>
  )
}

/** Projects and a task with subtasks; ticking a subtask moves the example project's progress ring. */
export function ProjectsShowcase() {
  const [done, setDone] = useState([true, false, false])
  const doneCount = done.filter(Boolean).length
  return (
    <section id="projects" aria-labelledby="projects-title" className="scroll-mt-24 px-5 pb-[clamp(88px,12vw,150px)] md:px-8">
      <div className="mx-auto grid max-w-[75rem] items-center gap-10 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.5fr)] lg:gap-16">
        <Reveal>
          <p className="lp-eyebrow">Projects &amp; task management</p>
          <h2 id="projects-title" className="lp-h2 text-ink">
            Big goals, <span className="lp-serif text-gradient">small steps.</span>
          </h2>
          <p className="mt-5 max-w-[52ch] text-[1.08rem] text-ink-muted">Each project shows how far along it is. Open a task to see its subtasks, its estimate and what it's waiting on. Tick a subtask in the example to see progress update.</p>
        </Reveal>
        <Reveal className="grid items-start gap-4 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <ul className="flex flex-col gap-2.5">
            {PROJECTS.map((project, index) => (
              <li key={project.name} className={`grid grid-cols-[52px_minmax(0,1fr)] items-center gap-3.5 rounded-2xl border bg-surface px-4 py-3.5 ${index === 0 ? 'border-glow/45 shadow-card' : 'border-line'}`}>
                <Ring percent={index === 0 ? project.base + doneCount * 2 - 2 : project.base} colour={project.colour} />
                <div>
                  <b className="block font-display font-semibold text-ink">{project.name}</b>
                  <span className="text-sm text-ink-muted">{project.detail}</span>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-3.5 rounded-2xl border border-line bg-surface p-5 shadow-card">
            <div className="flex flex-wrap gap-2 text-xs text-ink-muted">
              {['Thesis', 'Medium', 'Due 24 Nov', 'Est. 2 h'].map((meta) => (
                <span key={meta} className="rounded-full border border-line px-2.5 py-1">{meta}</span>
              ))}
            </div>
            <h3 className="font-display text-xl font-semibold tracking-tight text-ink">Collect survey responses</h3>
            <span className="w-max rounded-full border border-dashed border-line-strong px-2.5 py-1 text-xs text-ink-muted">Waits on: Send survey ✓</span>
            <ul>
              {SUBTASKS.map((subtask, index) => (
                <li key={subtask} className="border-t border-line">
                  <label className="flex cursor-pointer items-center gap-3 py-2.5 text-[0.9375rem]">
                    <input type="checkbox" className="size-4.5 accent-glow" checked={done[index]} onChange={(event) => setDone((current) => current.map((value, i) => (i === index ? event.target.checked : value)))} />
                    <span className={done[index] ? 'text-ink-subtle line-through' : 'text-ink'}>{subtask}</span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="flex justify-between text-sm text-ink-muted">
              <span>Subtasks</span>
              <span className="font-mono">{doneCount} of {SUBTASKS.length}</span>
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
