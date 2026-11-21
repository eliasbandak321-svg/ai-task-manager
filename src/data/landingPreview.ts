/*
  Fictional sample content for the landing page's product previews (M10). Not user data.
  The previews show the week of Monday 16 to Friday 20 November 2026 (ISO week 47).
*/

export type PreviewCategory = 'focus' | 'class' | 'meet' | 'personal'

export interface PreviewEvent {
  /** 0 = Monday … 4 = Friday */
  day: number
  start: string
  end: string
  title: string
  category: PreviewCategory
  proposed?: boolean
}

export const PREVIEW_DAYS = [
  { short: 'Mon', date: 16 },
  { short: 'Tue', date: 17 },
  { short: 'Wed', date: 18 },
  { short: 'Thu', date: 19 },
  { short: 'Fri', date: 20 },
] as const

/** Friday 20 November is "today" in the previews. */
export const PREVIEW_TODAY_INDEX = 4

export const PREVIEW_EVENTS: PreviewEvent[] = [
  { day: 0, start: '09:00', end: '10:30', title: 'Statistics lecture', category: 'class' },
  { day: 0, start: '13:00', end: '15:00', title: 'Literature review', category: 'focus' },
  { day: 1, start: '10:00', end: '11:00', title: 'Supervisor', category: 'meet' },
  { day: 2, start: '09:00', end: '10:30', title: 'Statistics lecture', category: 'class' },
  { day: 2, start: '16:30', end: '17:30', title: 'Gym', category: 'personal' },
  { day: 3, start: '15:00', end: '16:00', title: 'Study group', category: 'meet' },
  { day: 4, start: '09:00', end: '10:30', title: 'Seminar', category: 'class' },
  { day: 4, start: '10:45', end: '12:15', title: 'Methods section', category: 'focus' },
]

/** Sessions the scheduler proposes in the scheduling showcase. */
export const PREVIEW_PROPOSED: PreviewEvent[] = [
  { day: 1, start: '14:00', end: '15:30', title: 'Survey design', category: 'focus', proposed: true },
  { day: 2, start: '11:00', end: '12:30', title: 'Problem set 4', category: 'focus', proposed: true },
  { day: 4, start: '14:00', end: '15:30', title: 'Review lectures 6–8', category: 'focus', proposed: true },
]

export const MARQUEE_LABELS = [
  'Task management',
  'Projects & subtasks',
  'AI planning',
  'Smart scheduling',
  'Calendar',
  'Focus sessions',
  'Task dependencies',
  'Progress insights',
] as const
