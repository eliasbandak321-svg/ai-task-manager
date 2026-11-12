import { describe, expect, it } from 'vitest'
import type { CalendarEvent, PlanPayload, Proposal, SchedulePayload, Task, TaskDependency, TaskEffort } from '../../src/domain'
import { BERLIN_PREFS, testApi, testClock } from '../test/apiClient'
import { createTestUser, setupTestDatabase } from '../test/testDatabase'

const database = setupTestDatabase()

async function setup() {
  const clock = testClock('2026-03-02T07:00:00.000Z') // Monday 08:00 in Berlin
  const call = testApi(database(), { now: clock.now })
  const user = await createTestUser(database())
  const other = await createTestUser(database())
  await call(user, 'PUT', '/api/preferences', BERLIN_PREFS)
  const [inbox] = (await call(user, 'GET', '/api/projects')).body
  const task = async (title: string, extra: Record<string, unknown> = {}) =>
    (await call<Task>(user, 'POST', '/api/tasks', { projectId: inbox.id, title, ...extra })).body
  const session = (taskId: string, startAt: string, endAt: string) =>
    call<CalendarEvent>(user, 'POST', '/api/calendar/events', { title: 'Work', category: 'work_session', startAt, endAt, timeZone: 'Europe/Berlin', taskId })
  return { call, clock, user, other, task, session }
}

describe('task dependencies', () => {
  it('stores prerequisites, refuses cycles and self-references, and cleans up with the task', async () => {
    const { call, user, task } = await setup()
    const [a, b, c] = [await task('A'), await task('B'), await task('C')]
    expect((await call(user, 'PUT', `/api/tasks/${b.id}/dependencies`, { dependsOn: [a.id] })).status).toBe(200)
    expect((await call(user, 'PUT', `/api/tasks/${c.id}/dependencies`, { dependsOn: [b.id] })).status).toBe(200)

    const cycle = await call(user, 'PUT', `/api/tasks/${a.id}/dependencies`, { dependsOn: [c.id] })
    expect(cycle).toMatchObject({ status: 400, body: { error: { code: 'DEPENDENCY_CYCLE' } } })
    expect((await call(user, 'PUT', `/api/tasks/${a.id}/dependencies`, { dependsOn: [a.id] })).status).toBe(400)
    expect((await call<TaskDependency[]>(user, 'GET', '/api/dependencies')).body).toHaveLength(2)

    await call(user, 'DELETE', `/api/tasks/${b.id}`)
    expect((await call<TaskDependency[]>(user, 'GET', '/api/dependencies')).body).toEqual([])
  })

  it("never links or reveals another user's tasks", async () => {
    const { call, user, other, task } = await setup()
    const mine = await task('Mine')
    const [theirInbox] = (await call(other, 'GET', '/api/projects')).body
    const theirs = (await call<Task>(other, 'POST', '/api/tasks', { projectId: theirInbox.id, title: 'Theirs' })).body
    expect((await call(user, 'PUT', `/api/tasks/${mine.id}/dependencies`, { dependsOn: [theirs.id] })).status).toBe(404)
    expect((await call(other, 'PUT', `/api/tasks/${mine.id}/dependencies`, { dependsOn: [] })).status).toBe(404)
    await call(user, 'PUT', `/api/tasks/${mine.id}/dependencies`, { dependsOn: [] })
    expect((await call(other, 'GET', '/api/dependencies')).body).toEqual([])
  })

  it('schedules prerequisites first, adding them when only the dependent task was chosen', async () => {
    const { call, user, task } = await setup()
    const research = await task('Research', { estimatedMinutes: 120, priority: 'low' })
    const write = await task('Write', { estimatedMinutes: 60, priority: 'high', dueDate: '2026-03-03' })
    await call(user, 'PUT', `/api/tasks/${write.id}/dependencies`, { dependsOn: [research.id] })

    const proposal = await call<Proposal & { payload: SchedulePayload }>(user, 'POST', '/api/schedule/proposals', {
      from: '2026-03-02',
      to: '2026-03-06',
      taskIds: [write.id],
    })
    expect(proposal.body.payload.items.map((item) => `${item.title} ${'startAt' in item ? item.startAt : ''}`)).toEqual([
      'Research 2026-03-02T08:00:00.000Z',
      'Research 2026-03-02T09:00:00.000Z',
      'Write 2026-03-02T10:00:00.000Z',
    ])
    expect(proposal.body.payload.explanation.join('\n')).toContain('Also scheduled, because the chosen tasks depend on them: "Research"')
  })

  it('saves the dependencies of an approved plan', async () => {
    const { call, user } = await setup()
    const plan = await call<Proposal & { payload: PlanPayload }>(user, 'POST', '/api/ai/plan', { goal: 'Learn guitar' })
    const applied = await call<Proposal & { result: { taskIds: string[] } }>(user, 'POST', `/api/proposals/${plan.body.id}/apply`, {})
    const edges = (await call<TaskDependency[]>(user, 'GET', '/api/dependencies')).body
    const planned = plan.body.payload.plan.phases.flatMap((phase) => phase.tasks)
    expect(edges).toHaveLength(planned.reduce((sum, t) => sum + t.dependsOn.length, 0))
    expect(edges.every((edge) => applied.body.result.taskIds.includes(edge.taskId))).toBe(true)
  })
})

describe('effort and session status', () => {
  it('counts only completed sessions as done work and schedules just the remaining effort', async () => {
    const { call, user, task, session } = await setup()
    const essay = await task('Essay', { estimatedMinutes: 180 })
    const done = await session(essay.id, '2026-03-01T08:00:00.000Z', '2026-03-01T09:00:00.000Z') // yesterday
    await session(essay.id, '2026-03-01T10:00:00.000Z', '2026-03-01T10:30:00.000Z') // missed (never marked)
    const skipped = await session(essay.id, '2026-03-01T12:00:00.000Z', '2026-03-01T13:00:00.000Z')
    await session(essay.id, '2026-03-03T08:00:00.000Z', '2026-03-03T08:30:00.000Z') // upcoming

    await call(user, 'PATCH', `/api/calendar/events/${done.body.id}`, { changes: { sessionStatus: 'completed' } })
    await call(user, 'PATCH', `/api/calendar/events/${skipped.body.id}`, { changes: { sessionStatus: 'skipped' } })

    const effort = (await call<Record<string, TaskEffort>>(user, 'GET', '/api/effort')).body[essay.id]
    expect(effort).toEqual({ estimatedMinutes: 180, completedMinutes: 60, plannedMinutes: 30, missedMinutes: 30, remainingMinutes: 120, plannedUntil: '2026-03-03T08:30:00.000Z' })

    // 180 estimated − 60 done − 30 planned = 90 minutes still to schedule.
    const proposal = await call<Proposal & { payload: SchedulePayload }>(user, 'POST', '/api/schedule/proposals', { from: '2026-03-02', to: '2026-03-06' })
    const minutes = proposal.body.payload.items.reduce((sum, item) => sum + ('startAt' in item ? (Date.parse(item.endAt) - Date.parse(item.startAt)) / 60_000 : 0), 0)
    expect(minutes).toBe(90)
  })

  it('refuses marking a future session as done, or a whole series', async () => {
    const { call, user, task, session } = await setup()
    const essay = await task('Essay')
    const future = await session(essay.id, '2026-03-05T08:00:00.000Z', '2026-03-05T09:00:00.000Z')
    const early = await call(user, 'PATCH', `/api/calendar/events/${future.body.id}`, { changes: { sessionStatus: 'completed' } })
    expect(early).toMatchObject({ status: 400, body: { error: { code: 'INVALID_SESSION_STATUS' } } })
    expect((await call(user, 'PATCH', `/api/calendar/events/${future.body.id}`, { changes: { sessionStatus: 'skipped' } })).status).toBe(200)

    const series = await call<CalendarEvent>(user, 'POST', '/api/calendar/events', {
      title: 'Daily study',
      category: 'study',
      startAt: '2026-02-23T08:00:00.000Z',
      endAt: '2026-02-23T09:00:00.000Z',
      timeZone: 'Europe/Berlin',
      taskId: essay.id,
      recurrence: { freq: 'daily' },
    })
    expect((await call(user, 'PATCH', `/api/calendar/events/${series.body.id}`, { changes: { sessionStatus: 'completed' } })).status).toBe(400)
    const one = await call<CalendarEvent>(user, 'PATCH', `/api/calendar/events/${series.body.id}`, {
      scope: 'occurrence',
      occurrenceStart: '2026-02-24T08:00:00.000Z',
      changes: { sessionStatus: 'completed' },
    })
    expect(one.body).toMatchObject({ sessionStatus: 'completed', seriesId: series.body.id })
    expect((await call<Record<string, TaskEffort>>(user, 'GET', '/api/effort')).body[essay.id].completedMinutes).toBe(60)
  })

  it('never moves completed or skipped sessions when replanning', async () => {
    const { call, clock, user, task, session } = await setup()
    const essay = await task('Essay', { estimatedMinutes: 120 })
    const first = await session(essay.id, '2026-03-02T08:00:00.000Z', '2026-03-02T09:00:00.000Z')
    clock.set('2026-03-02T09:30:00.000Z')
    await call(user, 'PATCH', `/api/calendar/events/${first.body.id}`, { changes: { sessionStatus: 'completed' } })
    const replan = await call<Proposal & { payload: SchedulePayload }>(user, 'POST', '/api/schedule/proposals', { mode: 'replan', from: '2026-03-02', to: '2026-03-06' })
    expect(replan.body.payload.items).toEqual([expect.objectContaining({ type: 'create', startAt: '2026-03-02T09:45:00.000Z', endAt: '2026-03-02T10:45:00.000Z' })])
  })
})
