/*
  Fictional sample content for the landing page's product previews (M10). Not user data.
  The previews always show the visitor's current week (Monday to Friday) and today's date
  (useDeviceToday): only the sample events are fixed, placed by weekday.
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
