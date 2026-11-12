import type { DateSelectArg, DatesSetArg, EventClickArg, EventDropArg, EventInput } from '@fullcalendar/core'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin, { type EventResizeDoneArg } from '@fullcalendar/interaction'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import { EVENT_CATEGORY_LABELS, type Occurrence } from '../../domain'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { CATEGORY_COLOR_VARS } from '../../lib/time'

/*
  The visual calendar (FullCalendar, MIT licence: day, week and month views, drag-and-drop,
  resizing, "now" indicator). It only displays occurrences and reports what the user did; the
  page decides what to save. Every action here also has a keyboard-friendly alternative in the
  agenda list below the calendar, because drag-and-drop alone isn't accessible.
*/

export interface TimeChange {
  occurrence: Occurrence
  startAt: string
  endAt: string
  /** Puts the event back where it was (when cancelled or the save fails). */
  revert: () => void
}

interface CalendarViewProps {
  occurrences: readonly Occurrence[]
  onRangeChange: (from: string, to: string) => void
  onSelectSlot: (start: string, end: string) => void
  onOpen: (occurrence: Occurrence) => void
  onTimeChange: (change: TimeChange) => void
}

const key = (occurrence: Occurrence) => `${occurrence.eventId}|${occurrence.occurrenceStart}`

export default function CalendarView({ occurrences, onRangeChange, onSelectSlot, onOpen, onTimeChange }: CalendarViewProps) {
  const isSmall = useMediaQuery('(max-width: 639px)')
  const byKey = new Map(occurrences.map((occurrence) => [key(occurrence), occurrence]))

  const events: EventInput[] = occurrences.map((occurrence) => ({
    id: key(occurrence),
    title: `${occurrence.title}${occurrence.isRecurring ? ' ↻' : ''}`,
    start: occurrence.start,
    end: occurrence.end,
    backgroundColor: CATEGORY_COLOR_VARS[occurrence.category],
    borderColor: CATEGORY_COLOR_VARS[occurrence.category],
    textColor: 'var(--color-night)',
    extendedProps: { category: EVENT_CATEGORY_LABELS[occurrence.category] },
  }))

  function changed(info: EventDropArg | EventResizeDoneArg) {
    const occurrence = byKey.get(info.event.id)
    if (!occurrence || !info.event.start || !info.event.end) {
      info.revert()
      return
    }
    onTimeChange({ occurrence, startAt: info.event.start.toISOString(), endAt: info.event.end.toISOString(), revert: info.revert })
  }

  return (
    <div className="calendar-theme">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={isSmall ? 'timeGridDay' : 'timeGridWeek'}
        headerToolbar={
          isSmall
            ? { left: 'prev,next', center: 'title', right: 'today' }
            : { left: 'prev,next today', center: 'title', right: 'timeGridDay,timeGridWeek,dayGridMonth' }
        }
        footerToolbar={isSmall ? { center: 'timeGridDay,timeGridWeek,dayGridMonth' } : undefined}
        buttonText={{ today: 'Today', day: 'Day', week: 'Week', month: 'Month' }}
        firstDay={1}
        nowIndicator
        height="auto"
        scrollTime="08:00:00"
        slotDuration="00:30:00"
        allDaySlot={false}
        editable
        selectable
        selectMirror
        eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        events={events}
        datesSet={(info: DatesSetArg) => onRangeChange(info.start.toISOString(), info.end.toISOString())}
        select={(info: DateSelectArg) => {
          info.view.calendar.unselect()
          onSelectSlot(info.start.toISOString(), info.end.toISOString())
        }}
        eventClick={(info: EventClickArg) => {
          info.jsEvent.preventDefault()
          const occurrence = byKey.get(info.event.id)
          if (occurrence) onOpen(occurrence)
        }}
        eventDrop={changed}
        eventResize={changed}
        eventDidMount={(info) => {
          // Screen readers hear the category too, not only the colour.
          info.el.setAttribute('aria-label', `${info.event.title}, ${String(info.event.extendedProps.category)}`)
        }}
      />
    </div>
  )
}
