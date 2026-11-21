import type { CSSProperties } from 'react'
import { PREVIEW_DAYS, PREVIEW_TODAY_INDEX, type PreviewCategory, type PreviewEvent } from '../../data/landingPreview'

const COLOUR: Record<PreviewCategory, string> = { focus: 'var(--lp-focus)', class: 'var(--lp-class)', meet: 'var(--lp-meet)', personal: 'var(--lp-personal)' }
const minutes = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3))

interface WeekPreviewProps {
  events: PreviewEvent[]
  /** First and last hour shown. */
  startHour?: number
  endHour?: number
  /** Pixel height of one hour. */
  rowHeight?: number
}

/** A static five-day week (sample data) drawn for the landing page. The app itself uses FullCalendar. */
export function WeekPreview({ events, startHour = 9, endHour = 18, rowHeight = 40 }: WeekPreviewProps) {
  const hours = Array.from({ length: endHour - startHour }, (_, index) => startHour + index)
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[31rem] grid-cols-[2.75rem_repeat(5,minmax(5.5rem,1fr))] text-xs">
        <div className="border-b border-line" />
        {PREVIEW_DAYS.map((day, index) => (
          <div key={day.date} className="border-b border-l border-line p-2 text-ink-subtle">
            {day.short}
            <b className={`block font-mono text-[0.9375rem] font-medium ${index === PREVIEW_TODAY_INDEX ? 'text-glow' : 'text-ink'}`}>{day.date}</b>
          </div>
        ))}
        <div>
          {hours.map((hour) => (
            <div key={hour} className="-translate-y-1.5 pr-1.5 text-right font-mono text-[0.625rem] text-ink-subtle" style={{ height: rowHeight }}>
              {String(hour).padStart(2, '0')}
            </div>
          ))}
        </div>
        {PREVIEW_DAYS.map((day, dayIndex) => (
          <div key={day.date} className="lp-grid-lines relative border-l border-line" style={{ height: hours.length * rowHeight, backgroundSize: `100% ${rowHeight}px` }}>
            {events
              .filter((event) => event.day === dayIndex)
              .map((event, index) => (
                <div
                  key={`${event.title}-${event.start}`}
                  className={`lp-event absolute inset-x-[3px] overflow-hidden rounded-[7px] px-1.5 py-1 leading-tight text-ink ${event.proposed ? 'is-proposed' : ''}`}
                  style={{ '--c': COLOUR[event.category], '--i': index, top: ((minutes(event.start) - startHour * 60) / 60) * rowHeight + 1, height: ((minutes(event.end) - minutes(event.start)) / 60) * rowHeight - 3 } as CSSProperties}
                >
                  <small className="block font-mono text-[0.625rem] text-ink-muted">
                    {event.start}
                    {event.proposed && ' · proposed'}
                  </small>
                  {event.title}
                </div>
              ))}
          </div>
        ))}
      </div>
    </div>
  )
}
