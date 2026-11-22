import { addDays, toIsoDate, zonedToUtc, type IsoDate, type TaskPriority, type TaskStatus } from '../domain'
import type { TaskRepository } from '../data/repository'
import type { WorkspaceClient } from '../data/workspaceClient'
import type { EventCategory } from '../domain/calendar'

/*
  The portfolio demo's sample data (M11). Everything here is FICTIONAL: the people, companies
  and projects are made up. Dates are relative to the visitor's own today and time zone, so the
  demo always looks current: some work is overdue, some done this week, some coming up.

  It's written through the same TaskRepository and WorkspaceClient interfaces the UI uses, so
  every record passes the real domain validation. `setClock` lets finished tasks and sessions
  get realistic completion dates (for the Insights trends).
*/

interface SampleTask {
  key: string
  project: string | null // null: the Inbox
  title: string
  description?: string
  status: TaskStatus
  priority: TaskPriority
  /** Days from today; negative is in the past. */
  dueIn: number | null
  estimatedMinutes: number | null
  /** For done tasks: completed this many days ago. */
  completedDaysAgo?: number
  subtasks?: { title: string; done?: boolean }[]
  dependsOn?: string[]
}

interface SampleEvent {
  title: string
  category: EventCategory
  day: number
  start: string
  end: string
  task?: string
  status?: 'completed' | 'skipped'
}

export const DEMO_PROJECTS = ['Thesis: Urban Heat Study', 'Job Applications', 'Portfolio Website'] as const

const TASKS: SampleTask[] = [
  {
    key: 'lit',
    project: DEMO_PROJECTS[0],
    title: 'Write literature review',
    description: 'Chapter 2: what earlier studies found about heat islands in mid-sized cities.',
    status: 'in_progress',
    priority: 'high',
    dueIn: 5,
    estimatedMinutes: 240,
    subtasks: [{ title: 'Collect 20 sources', done: true }, { title: 'Summarise the key papers', done: true }, { title: 'Draft section 2.3' }],
  },
  { key: 'clean', project: DEMO_PROJECTS[0], title: 'Clean the temperature dataset', status: 'done', priority: 'high', dueIn: -2, estimatedMinutes: 120, completedDaysAgo: 3 },
  { key: 'regression', project: DEMO_PROJECTS[0], title: 'Run the regression analysis', status: 'todo', priority: 'high', dueIn: 9, estimatedMinutes: 180, dependsOn: ['clean'] },
  { key: 'charts', project: DEMO_PROJECTS[0], title: 'Create charts for chapter 3', status: 'todo', priority: 'medium', dueIn: 12, estimatedMinutes: 90, dependsOn: ['regression'] },
  { key: 'supervisor', project: DEMO_PROJECTS[0], title: 'Email supervisor a progress update', status: 'todo', priority: 'medium', dueIn: -1, estimatedMinutes: 15 },
  { key: 'cv', project: DEMO_PROJECTS[1], title: 'Tailor CV for frontend roles', status: 'done', priority: 'high', dueIn: -5, estimatedMinutes: 60, completedDaysAgo: 6 },
  {
    key: 'northwind',
    project: DEMO_PROJECTS[1],
    title: 'Apply to Northwind Labs',
    status: 'in_progress',
    priority: 'medium',
    dueIn: 2,
    estimatedMinutes: 45,
    subtasks: [{ title: 'Write the cover letter', done: true }, { title: 'Submit the application' }],
  },
  {
    key: 'interview',
    project: DEMO_PROJECTS[1],
    title: 'Prepare for the technical interview',
    status: 'todo',
    priority: 'high',
    dueIn: 7,
    estimatedMinutes: 300,
    subtasks: [{ title: 'Review React hooks' }, { title: 'Practise two system-design questions' }, { title: 'Mock interview with a friend' }],
  },
  { key: 'contoso', project: DEMO_PROJECTS[1], title: 'Follow up with the Contoso recruiter', status: 'done', priority: 'low', dueIn: 0, estimatedMinutes: 10, completedDaysAgo: 1 },
  { key: 'readme', project: DEMO_PROJECTS[2], title: 'Write the project README', status: 'in_progress', priority: 'medium', dueIn: 4, estimatedMinutes: 90 },
  { key: 'video', project: DEMO_PROJECTS[2], title: 'Record a 2-minute demo video', status: 'todo', priority: 'low', dueIn: 14, estimatedMinutes: 60 },
  { key: 'navbug', project: DEMO_PROJECTS[2], title: 'Fix the mobile navigation bug', status: 'done', priority: 'medium', dueIn: -8, estimatedMinutes: 30, completedDaysAgo: 10 },
  { key: 'library', project: null, title: 'Renew library card', status: 'todo', priority: 'low', dueIn: 3, estimatedMinutes: 10 },
  { key: 'gift', project: null, title: 'Buy a birthday gift for Sam', status: 'todo', priority: 'medium', dueIn: 6, estimatedMinutes: null },
]

const EVENTS: SampleEvent[] = [
  { title: 'Apply to Northwind Labs', category: 'work_session', day: -4, start: '10:00', end: '11:00', task: 'northwind', status: 'skipped' },
  { title: 'Clean the temperature dataset', category: 'work_session', day: -3, start: '09:00', end: '11:00', task: 'clean', status: 'completed' },
  { title: 'Write literature review', category: 'work_session', day: -2, start: '10:00', end: '11:30', task: 'lit', status: 'completed' },
  { title: 'Prepare for the technical interview', category: 'work_session', day: -1, start: '09:00', end: '10:00', task: 'interview' },
  { title: 'Statistics lecture', category: 'study', day: 0, start: '09:00', end: '10:30' },
  { title: 'Supervisor meeting', category: 'meeting', day: 0, start: '11:00', end: '12:00' },
  { title: 'Write literature review', category: 'work_session', day: 0, start: '14:00', end: '15:30', task: 'lit' },
  { title: 'Gym', category: 'personal', day: 1, start: '07:30', end: '08:30' },
  { title: 'Prepare for the technical interview', category: 'work_session', day: 1, start: '13:00', end: '15:00', task: 'interview' },
  { title: 'Statistics lecture', category: 'study', day: 2, start: '09:00', end: '10:30' },
  { title: 'Team project sync', category: 'meeting', day: 3, start: '16:00', end: '17:00' },
  { title: 'Run the regression analysis', category: 'focus', day: 4, start: '10:00', end: '12:00', task: 'regression' },
]

const toMinutes = (clock: string) => {
  const [hours, minutes] = clock.split(':').map(Number)
  return hours * 60 + minutes
}

export interface SeedOptions {
  repository: TaskRepository
  workspace: WorkspaceClient
  /** The visitor's current moment and time zone. */
  now: Date
  timeZone: string
  /** Moves the clock the repository and workspace use (for realistic completion dates). */
  setClock: (instant: Date) => void
}

/** Writes the sample data. Expects an empty workspace (a fresh demo). */
export async function seedDemoData({ repository, workspace, now, timeZone, setClock }: SeedOptions): Promise<void> {
  const today: IsoDate = toIsoDate(now, timeZone)
  const at = (day: number, clock: string) => zonedToUtc(addDays(today, day), toMinutes(clock), timeZone)
  /** A past moment for completions; never later than now. */
  const past = (daysAgo: number) => new Date(Math.min(at(-daysAgo, '16:00').getTime(), now.getTime()))

  setClock(at(-14, '09:00'))
  const inbox = (await repository.listProjects()).find((project) => project.isInbox)
  const projectIds = new Map<string | null, string>([[null, inbox?.id ?? '']])
  for (const name of DEMO_PROJECTS) projectIds.set(name, (await repository.createProject({ name })).id)

  const taskIds = new Map<string, string>()
  for (const task of TASKS) {
    setClock(task.completedDaysAgo === undefined ? at(-14, '09:00') : past(task.completedDaysAgo))
    const created = await repository.createTask({
      projectId: projectIds.get(task.project) ?? '',
      title: task.title,
      description: task.description ?? '',
      status: task.status,
      priority: task.priority,
      dueDate: task.dueIn === null ? null : addDays(today, task.dueIn),
      estimatedMinutes: task.estimatedMinutes,
    })
    taskIds.set(task.key, created.id)
    for (const subtask of task.subtasks ?? []) {
      const added = await repository.createSubtask(created.id, { title: subtask.title })
      if (subtask.done) await repository.updateSubtask(added.id, { done: true })
    }
  }

  setClock(now)
  await workspace.savePreferences({
    timeZone,
    useCase: 'student',
    workDays: [1, 2, 3, 4, 5],
    dayStartMinutes: 9 * 60,
    dayEndMinutes: 18 * 60,
    focusPeriod: 'morning',
    sessionMinutes: 60,
    breakMinutes: 10,
    maxDailyMinutes: 6 * 60,
  })
  for (const task of TASKS) {
    if (task.dependsOn) await workspace.setDependencies(taskIds.get(task.key) ?? '', task.dependsOn.map((key) => taskIds.get(key) ?? ''))
  }
  for (const event of EVENTS) {
    const created = await workspace.createEvent({
      title: event.title,
      description: '',
      category: event.category,
      startAt: at(event.day, event.start).toISOString(),
      endAt: at(event.day, event.end).toISOString(),
      timeZone,
      taskId: event.task ? (taskIds.get(event.task) ?? null) : null,
      recurrence: null,
    })
    if (event.status) await workspace.updateEvent(created.id, { changes: { sessionStatus: event.status } })
  }
}
