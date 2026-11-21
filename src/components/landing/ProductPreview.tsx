import { useRef, useState, type KeyboardEvent } from 'react'
import { PREVIEW_EVENTS } from '../../data/landingPreview'
import { useDeviceToday } from '../../hooks/useDeviceToday'
import { formatDayRange, formatWeekdayDate, workWeekOf } from '../../lib/dateLabels'
import { Reveal } from './Reveal'
import { WeekPreview } from './WeekPreview'

const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'assistant', label: 'Assistant' },
] as const
type Tab = (typeof TABS)[number]['id']

const TASKS = [
  { title: 'Practice problem set 4', tag: 'Medium', tone: '' },
  { title: 'Fix navbar focus styles', tag: 'Overdue', tone: 'text-priority-medium' },
  { title: 'Draft methods section', tag: 'High', tone: 'text-priority-high' },
  { title: 'Email supervisor about chapter 2', tag: 'Low', tone: '', done: true },
]

const BARS = [
  { label: 'Focus this week', value: '9.5 / 15 h', percent: 63 },
  { label: 'Thesis', value: '58%', percent: 58 },
  { label: 'Statistics exam', value: '35%', percent: 35 },
  { label: 'On time', value: '86%', percent: 86 },
]

/** A framed preview of the app with Today / Calendar / Assistant tabs (sample data; arrow keys switch tabs). */
export function ProductPreview() {
  const [tab, setTab] = useState<Tab>('today')
  // The visitor's own date, so the preview never shows a stale day.
  const today = useDeviceToday()
  const week = workWeekOf(today)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const next = (index + step + TABS.length) % TABS.length
    setTab(TABS[next].id)
    tabRefs.current[next]?.focus()
  }

  return (
    <section id="product" aria-label="Product preview" className="relative z-2 -mt-6 scroll-mt-24 px-5 md:px-8">
      <Reveal className="mx-auto max-w-[75rem]">
        <div role="tablist" aria-label="Preview screens" className="mx-auto mb-4 flex w-max max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-surface/75 p-1 backdrop-blur-md">
          {TABS.map((item, index) => (
            <button
              key={item.id}
              ref={(element) => {
                tabRefs.current[index] = element
              }}
              type="button"
              role="tab"
              id={`preview-tab-${item.id}`}
              aria-selected={tab === item.id}
              aria-controls={`preview-panel-${item.id}`}
              tabIndex={tab === item.id ? 0 : -1}
              onClick={() => setTab(item.id)}
              onKeyDown={(event) => onKeyDown(event, index)}
              className={`min-h-9.5 rounded-full px-4 text-sm whitespace-nowrap ${tab === item.id ? 'bg-btn text-btn-ink' : 'text-ink-muted hover:text-ink'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="lp-device">
          <div className="overflow-hidden rounded-[21px] bg-surface">
            <div aria-hidden="true" className="flex items-center gap-2 border-b border-line px-4 py-3">
              <i className="size-2.5 rounded-full bg-line-strong" />
              <i className="size-2.5 rounded-full bg-line-strong" />
              <i className="size-2.5 rounded-full bg-line-strong" />
              <span className="mx-auto rounded-full bg-raised px-3.5 py-0.5 font-mono text-xs text-ink-subtle">AI Task Manager · {TABS.find((item) => item.id === tab)?.label}</span>
            </div>
            <div className="grid min-h-[26rem] md:grid-cols-[12.5rem_minmax(0,1fr)]">
              <div aria-hidden="true" className="hidden flex-col gap-0.5 border-r border-line bg-raised/50 p-3 text-sm text-ink-muted md:flex">
                {['Today', 'Projects', 'Calendar', 'AI Assistant', 'Insights'].map((item) => (
                  <div key={item} className={`rounded-lg px-2.5 py-1.5 ${(item === 'Today' && tab === 'today') || (item === 'Calendar' && tab === 'calendar') || (item === 'AI Assistant' && tab === 'assistant') ? 'bg-accent-soft text-ink shadow-[inset_2px_0_0_var(--color-glow)]' : ''}`}>
                    {item}
                  </div>
                ))}
                <div className="px-2.5 pt-3.5 pb-1 font-mono text-[0.6875rem] tracking-[0.08em] text-ink-subtle uppercase">Projects</div>
                {['Thesis', 'Statistics exam', 'Portfolio site'].map((item) => (
                  <div key={item} className="px-2.5 py-1">{item}</div>
                ))}
              </div>
              <div className="p-4 md:p-5">
                {tab === 'today' && (
                  <div id="preview-panel-today" role="tabpanel" aria-labelledby="preview-tab-today" className="lp-panel grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                    <h3 className="font-display text-xl font-semibold tracking-tight text-ink lg:col-span-2">{formatWeekdayDate(today)}</h3>
                    <div className="grid gap-3.5">
                      <div className="lp-next rounded-2xl border border-line p-4">
                        <span className="font-mono text-xs text-glow">NEXT · 10:45 – 12:15 · sample session</span>
                        <b className="mt-1 block font-display text-lg text-ink">Methods section</b>
                        <span className="text-sm text-ink-muted">Thesis · 90 min focus session · 2 of 5 subtasks</span>
                      </div>
                      <ul className="rounded-2xl border border-line px-4 py-1.5">
                        {TASKS.map((task) => (
                          <li key={task.title} className="flex items-center gap-2.5 border-t border-line py-2 text-sm first:border-t-0">
                            <i aria-hidden="true" className={`size-4 shrink-0 rounded-[5px] border-[1.5px] ${task.done ? 'border-glow bg-glow' : 'border-line-strong'}`} />
                            <span className={task.done ? 'text-ink-subtle line-through' : 'text-ink'}>{task.title}</span>
                            <em className={`ml-auto rounded-full bg-raised px-2 py-0.5 text-[0.6875rem] not-italic ${task.tone || 'text-ink-muted'}`}>{task.tag}</em>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex flex-col gap-3 rounded-2xl border border-line p-4 text-sm">
                      {BARS.map((bar) => (
                        <div key={bar.label}>
                          <div className="flex justify-between text-ink-muted">
                            <span>{bar.label}</span>
                            <span className="font-mono">{bar.value}</span>
                          </div>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-raised">
                            <i className="lp-bar-fill block h-full rounded-full" style={{ width: `${bar.percent}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {tab === 'calendar' && (
                  <div id="preview-panel-calendar" role="tabpanel" aria-labelledby="preview-tab-calendar" className="lp-panel grid gap-4">
                    <h3 className="font-display text-xl font-semibold tracking-tight text-ink">{formatDayRange(week[0].date, week[4].date)}</h3>
                    <div className="rounded-2xl border border-line">
                      <WeekPreview events={PREVIEW_EVENTS} />
                    </div>
                  </div>
                )}
                {tab === 'assistant' && (
                  <div id="preview-panel-assistant" role="tabpanel" aria-labelledby="preview-tab-assistant" className="lp-panel grid gap-4">
                    <h3 className="font-display text-xl font-semibold tracking-tight text-ink">AI Assistant</h3>
                    <div className="flex flex-col gap-3.5 text-[0.9375rem]">
                      <p className="max-w-[82%] self-end rounded-[16px_16px_4px_16px] bg-btn px-4 py-2.5 text-btn-ink">What should I focus on before the statistics exam?</p>
                      <div>
                        <p className="mb-1 text-xs text-ink-subtle">Assistant</p>
                        <p className="text-ink">Problem set 4 first: it's due today. Then review lectures 6–8. You have about 4.5 hours of exam work left.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <p className="mt-3 text-center text-xs text-ink-subtle">Sample data</p>
      </Reveal>
    </section>
  )
}
