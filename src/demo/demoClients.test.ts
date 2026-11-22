import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthError } from '../data/authClient'
import { toIsoDate, zonedParts } from '../domain'
import { createDemoClients } from './demoClients'
import { clearDemo, DEMO_KEYS, type DemoStorage } from './demoStorage'
import { DEMO_USER } from './demoAuthClient'
import { DEMO_PROJECTS } from './demoData'

/*
  The portfolio demo's data layer (M11): fictional sample data relative to the visitor's today,
  kept per tab, reset on demand, and never sent anywhere.
*/

const NOW = new Date('2026-11-18T10:15:00.000Z') // a Wednesday
const ZONE = 'Europe/Berlin'

function memoryStorage(): DemoStorage & { keys(): string[] } {
  const items = new Map<string, string>()
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
    keys: () => [...items.keys()],
  }
}

async function demo(storage = memoryStorage(), now = NOW) {
  const clients = createDemoClients({ storage, timeZone: ZONE, now: () => now })
  await clients.ready
  return { ...clients, storage }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('demo sample data', () => {
  it('creates the fictional projects, tasks and subtasks', async () => {
    const { repository } = await demo()
    const projects = await repository.listProjects()
    expect(projects.map((project) => project.name)).toEqual(expect.arrayContaining(['Inbox', ...DEMO_PROJECTS]))
    const tasks = await repository.listTasks()
    expect(tasks.length).toBeGreaterThanOrEqual(12)
    expect(new Set(tasks.map((task) => task.status))).toEqual(new Set(['todo', 'in_progress', 'done']))
    expect((await repository.listSubtasks()).length).toBeGreaterThan(5)
  })

  it('places dates relative to the visitor’s today: overdue, due soon, and finished in the past', async () => {
    const { repository } = await demo()
    const today = toIsoDate(NOW, ZONE)
    const tasks = await repository.listTasks()
    const open = tasks.filter((task) => task.status !== 'done')
    expect(open.some((task) => task.dueDate !== null && task.dueDate < today)).toBe(true)
    expect(open.some((task) => task.dueDate !== null && task.dueDate > today)).toBe(true)
    for (const done of tasks.filter((task) => task.status === 'done')) {
      expect(new Date(done.completedAt ?? '').getTime()).toBeLessThanOrEqual(NOW.getTime())
    }
    // Another day, other dates: always current.
    const later = new Date('2027-03-10T10:00:00.000Z')
    const { repository: laterRepository } = await demo(memoryStorage(), later)
    const laterDue = (await laterRepository.listTasks()).map((task) => task.dueDate).filter(Boolean).sort()
    expect(laterDue[0]?.startsWith('2027-')).toBe(true)
  })

  it('fills the calendar around today in the visitor’s time zone, with sessions done, skipped and planned', async () => {
    const { workspace } = await demo()
    const from = new Date(NOW.getTime() - 7 * 86_400_000).toISOString()
    const to = new Date(NOW.getTime() + 7 * 86_400_000).toISOString()
    const { events } = await workspace.listCalendar(from, to)
    const lecture = events.find((event) => event.title === 'Statistics lecture' && toIsoDate(new Date(event.startAt), ZONE) === toIsoDate(NOW, ZONE))
    expect(lecture).toBeDefined()
    expect(zonedParts(new Date(lecture?.startAt ?? ''), ZONE).minutes).toBe(9 * 60)
    expect(new Set(events.map((event) => event.sessionStatus))).toEqual(new Set(['planned', 'completed', 'skipped']))
    expect(events.some((event) => event.taskId !== null)).toBe(true)
  })

  it('has saved preferences, dependencies and insights to show', async () => {
    const { workspace } = await demo()
    expect((await workspace.getPreferences(ZONE)).preferences).toMatchObject({ timeZone: ZONE, useCase: 'student' })
    expect((await workspace.listDependencies()).length).toBe(2)
    expect((await workspace.insights()).workload.length).toBe(7)
  })
})

describe('demo storage', () => {
  it('keeps changes for this tab across reloads, without seeding again', async () => {
    const first = await demo()
    const [task] = await first.repository.listTasks()
    await first.repository.updateTask(task.id, { title: 'Changed in the demo' })
    await first.workspace.savePreferences({ ...(await first.workspace.getPreferences(ZONE)).preferences, sessionMinutes: 90 })

    const reloaded = await demo(first.storage)
    const tasks = await reloaded.repository.listTasks()
    expect(tasks.find((candidate) => candidate.id === task.id)?.title).toBe('Changed in the demo')
    expect(tasks).toHaveLength((await first.repository.listTasks()).length)
    expect((await reloaded.workspace.getPreferences(ZONE)).preferences.sessionMinutes).toBe(90)
  })

  it('starts again from the sample data after a reset', async () => {
    const first = await demo()
    const [task] = await first.repository.listTasks()
    await first.repository.deleteTask(task.id)
    clearDemo(first.storage)
    expect(first.storage.keys().filter((key) => Object.values(DEMO_KEYS).includes(key as never))).toEqual([])

    const fresh = await demo(first.storage)
    expect((await fresh.repository.listTasks()).map((candidate) => candidate.title)).toContain(task.title)
  })

  it('starts fresh when the saved demo is unreadable', async () => {
    const storage = memoryStorage()
    await demo(storage)
    storage.setItem(DEMO_KEYS.workspace, '{not json')
    const fresh = await demo(storage)
    expect((await fresh.repository.listProjects()).map((project) => project.name)).toContain(DEMO_PROJECTS[0])
    expect((await fresh.workspace.listCalendar(new Date(NOW.getTime() - 86_400_000).toISOString(), NOW.toISOString())).events.length).toBeGreaterThan(0)
  })
})

describe('demo isolation', () => {
  it('never makes a network request, whatever the visitor does', async () => {
    const fetchSpy = vi.fn(async () => new Response(null, { status: 599 }))
    vi.stubGlobal('fetch', fetchSpy)
    const { repository, workspace } = await demo()
    const [task] = await repository.listTasks()
    await workspace.chat(`Set ${task.title} to high priority`, null)
    await workspace.generatePlan({ goal: 'Help me learn TypeScript' })
    const schedule = await workspace.proposeSchedule({ mode: 'fill', from: toIsoDate(NOW, ZONE), to: toIsoDate(new Date(NOW.getTime() + 6 * 86_400_000), ZONE) })
    await workspace.applyProposal(schedule.id)
    await workspace.assistTask(task.id, 'checklist')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('labels every AI answer as the simulated demo provider', async () => {
    const { workspace } = await demo()
    expect(await workspace.aiStatus()).toMatchObject({ provider: 'mock', isDemo: true, budget: null })
    const reply = await workspace.chat('What should I do next?', null)
    expect(reply.message.source).toBe('mock')
  })

  it('is always the fictional demo visitor; account actions are unavailable', async () => {
    const { authClient } = await demo()
    expect(await authClient.getSession()).toEqual(DEMO_USER)
    expect(DEMO_USER.email.endsWith('@example.com')).toBe(true)
    await expect(authClient.signIn({ email: 'someone@example.com', password: 'whatever1' })).rejects.toBeInstanceOf(AuthError)
    await expect(authClient.signUp({ name: 'A', email: 'a@example.com', password: 'whatever1' })).rejects.toBeInstanceOf(AuthError)
  })
})
