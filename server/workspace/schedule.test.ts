import { describe, expect, it } from 'vitest'
import type { Occurrence, Proposal, SchedulePayload, Task } from '../../src/domain'
import { BERLIN_PREFS, testApi, testClock } from '../test/apiClient'
import { createTestUser, setupTestDatabase } from '../test/testDatabase'

const database = setupTestDatabase()
const MONDAY_8 = '2026-03-02T07:00:00.000Z' // Monday 08:00 in Berlin
const WEEK = '?from=2026-03-01T23:00:00.000Z&to=2026-03-08T23:00:00.000Z'

type ScheduleProposal = Proposal & { payload: SchedulePayload }
type Range = { occurrences: Occurrence[] }

async function setup() {
  const clock = testClock(MONDAY_8)
  const call = testApi(database(), { now: clock.now })
  const user = await createTestUser(database())
  const other = await createTestUser(database())
  await call(user, 'PUT', '/api/preferences', BERLIN_PREFS)
  const [inbox] = (await call(user, 'GET', '/api/projects')).body
  const task = async (title: string, extra: Record<string, unknown> = {}) =>
    (await call<Task>(user, 'POST', '/api/tasks', { projectId: inbox.id, title, ...extra })).body
  const propose = async (body: Record<string, unknown> = {}) =>
    call<ScheduleProposal>(user, 'POST', '/api/schedule/proposals', { from: '2026-03-02', to: '2026-03-06', ...body })
  const sessions = async () =>
    (await call<Range>(user, 'GET', `/api/calendar/events${WEEK}`)).body.occurrences.filter((o) => o.category === 'work_session')
  return { call, clock, user, other, task, propose, sessions }
}

describe('schedule proposals', () => {
  it('previews sessions without changing the calendar, then applies them once approved', async () => {
    const { call, user, task, propose, sessions } = await setup()
    const essay = await task('Essay', { estimatedMinutes: 120, dueDate: '2026-03-03', priority: 'high' })
    await task('Slides', { estimatedMinutes: 60 })

    const proposal = await propose()
    expect(proposal.status).toBe(201)
    expect(proposal.body).toMatchObject({ kind: 'schedule', status: 'pending', source: 'engine' })
    expect(proposal.body.payload.items.map((item) => `${item.type} ${item.title} ${'startAt' in item ? item.startAt : ''}`)).toEqual([
      'create Essay 2026-03-02T08:00:00.000Z',
      'create Essay 2026-03-02T09:00:00.000Z',
      'create Slides 2026-03-02T10:00:00.000Z',
    ])
    expect(proposal.body.payload.explanation[0]).toContain('Free working time')
    expect(await sessions()).toEqual([]) // nothing changes until approval

    const applied = await call<Proposal>(user, 'POST', `/api/proposals/${proposal.body.id}/apply`, {})
    expect(applied.status).toBe(200)
    expect(applied.body).toMatchObject({ status: 'applied', result: { created: expect.any(Array) } })
    const created = await sessions()
    expect(created.map((o) => o.taskId)).toEqual([essay.id, essay.id, expect.any(String)])
  })

  it('applies only the approved items', async () => {
    const { call, user, task, propose, sessions } = await setup()
    await task('A')
    await task('B')
    const proposal = await propose()
    const indexOfB = proposal.body.payload.items.findIndex((item) => item.title === 'B')
    await call(user, 'POST', `/api/proposals/${proposal.body.id}/apply`, { include: [indexOfB] })
    expect((await sessions()).map((o) => o.title)).toEqual(['B'])
    expect((await call(user, 'POST', '/api/schedule/proposals', { from: '2026-03-02', to: '2026-03-06' })).status).toBe(201)
  })

  it('applies a proposal at most once, even when approved twice at the same time', async () => {
    const { call, user, task, propose, sessions } = await setup()
    await task('Report')
    const proposal = await propose()
    const results = await Promise.all([
      call(user, 'POST', `/api/proposals/${proposal.body.id}/apply`, {}),
      call(user, 'POST', `/api/proposals/${proposal.body.id}/apply`, {}),
    ])
    expect(results.map((result) => result.status).sort()).toEqual([200, 409])
    const again = await call(user, 'POST', `/api/proposals/${proposal.body.id}/apply`, {})
    expect(again).toMatchObject({ status: 409, body: { error: { code: 'PROPOSAL_DECIDED' } } })
    expect(await sessions()).toHaveLength(1)
  })

  it('refuses a stale preview when a task changed after it was made', async () => {
    const { call, clock, user, task, propose, sessions } = await setup()
    const report = await task('Report', { estimatedMinutes: 60 })
    const proposal = await propose()
    clock.advanceMinutes(1)
    await call(user, 'PATCH', `/api/tasks/${report.id}`, { estimatedMinutes: 240 })
    const result = await call(user, 'POST', `/api/proposals/${proposal.body.id}/apply`, {})
    expect(result).toMatchObject({ status: 409, body: { error: { code: 'PROPOSAL_STALE' } } })
    expect(await sessions()).toEqual([])
    // It stays pending (nothing was applied), so it can still be rejected.
    expect((await call(user, 'POST', `/api/proposals/${proposal.body.id}/reject`)).body).toMatchObject({ status: 'rejected' })
  })

  it('refuses a preview whose slots are now taken', async () => {
    const { call, user, task, propose } = await setup()
    await task('Report')
    const proposal = await propose()
    await call(user, 'POST', '/api/calendar/events', {
      title: 'Surprise meeting',
      category: 'meeting',
      startAt: '2026-03-02T08:30:00.000Z',
      endAt: '2026-03-02T09:00:00.000Z',
      timeZone: 'Europe/Berlin',
    })
    const result = await call(user, 'POST', `/api/proposals/${proposal.body.id}/apply`, {})
    expect(result).toMatchObject({ status: 409, body: { error: { code: 'SCHEDULE_CONFLICT' } } })
  })

  it('expires proposals after a day', async () => {
    const { call, clock, user, task, propose } = await setup()
    await task('Report')
    const proposal = await propose()
    clock.advanceMinutes(25 * 60)
    expect((await call(user, 'POST', `/api/proposals/${proposal.body.id}/apply`, {})).body).toMatchObject({ error: { code: 'PROPOSAL_EXPIRED' } })
    expect((await call<Proposal[]>(user, 'GET', '/api/proposals')).body).toEqual([])
  })

  it('explains what does not fit instead of overbooking', async () => {
    const { task, propose } = await setup()
    await task('Thesis chapter', { estimatedMinutes: 900, dueDate: '2026-03-02' })
    await task('Old thing', { dueDate: '2026-02-20' })
    const proposal = await propose()
    const payload = proposal.body.payload
    expect(payload.items).toHaveLength(6) // 6 × 60 min: the daily maximum on the due date
    expect(payload.unscheduled.map((u) => [u.title, u.reason, u.missingMinutes])).toEqual([
      ['Old thing', 'deadline_passed', 60],
      ['Thesis chapter', 'not_enough_time', 540],
    ])
    expect(payload.explanation.join('\n')).toMatch(/Not enough free time for "Thesis chapter" before its deadline/)
    expect(payload.explanation.join('\n')).toMatch(/"Old thing" is overdue/)
  })

  it('replans future sessions with a before/after preview and leaves past ones alone', async () => {
    const { call, clock, user, task, propose, sessions } = await setup()
    const report = await task('Report', { estimatedMinutes: 120 })
    await call(user, 'POST', `/api/proposals/${(await propose()).body.id}/apply`, {})
    expect((await sessions()).map((o) => o.start)).toEqual(['2026-03-02T08:00:00.000Z', '2026-03-02T09:00:00.000Z'])

    // The first session has started (it stays); a new meeting blocks the second one.
    clock.set('2026-03-02T08:30:00.000Z')
    await call(user, 'POST', '/api/calendar/events', {
      title: 'Meeting',
      category: 'meeting',
      startAt: '2026-03-02T09:00:00.000Z',
      endAt: '2026-03-02T11:00:00.000Z',
      timeZone: 'Europe/Berlin',
    })
    const replan = await propose({ mode: 'replan', taskIds: [report.id] })
    expect(replan.body.payload.items).toEqual([
      expect.objectContaining({ type: 'move', fromStartAt: '2026-03-02T09:00:00.000Z', startAt: '2026-03-02T11:00:00.000Z' }),
    ])
    await call(user, 'POST', `/api/proposals/${replan.body.id}/apply`, {})
    expect((await sessions()).map((o) => o.start)).toEqual(['2026-03-02T08:00:00.000Z', '2026-03-02T11:00:00.000Z'])
  })

  it('validates requests', async () => {
    const { call, user, propose } = await setup()
    expect((await propose({ to: '2026-05-30' })).status).toBe(400)
    expect((await propose({ taskIds: ['00000000-0000-4000-8000-000000000999'] })).status).toBe(404)
    expect((await call(user, 'POST', '/api/proposals/not-a-uuid/apply', {})).status).toBe(404)
  })
})

describe('proposal isolation', () => {
  it("never lets another user see, apply or reject a proposal, or schedule another user's task", async () => {
    const { call, user, other, task, propose, sessions } = await setup()
    const mine = await task('Mine')
    const proposal = await propose()

    expect((await call(other, 'GET', `/api/proposals/${proposal.body.id}`)).status).toBe(404)
    expect((await call(other, 'POST', `/api/proposals/${proposal.body.id}/apply`, {})).status).toBe(404)
    expect((await call(other, 'POST', `/api/proposals/${proposal.body.id}/reject`)).status).toBe(404)
    expect((await call<Proposal[]>(other, 'GET', '/api/proposals')).body).toEqual([])
    expect((await call(other, 'POST', '/api/schedule/proposals', { from: '2026-03-02', to: '2026-03-06', taskIds: [mine.id] })).status).toBe(404)
    expect(await sessions()).toEqual([])
    expect((await call<Proposal>(user, 'GET', `/api/proposals/${proposal.body.id}`)).body.status).toBe('pending')
  })
})

describe('earliestSessionStart', () => {
  it('starts at the next quarter hour at least 10 minutes away', async () => {
    const { earliestSessionStart } = await import('./workspace')
    expect(earliestSessionStart(new Date('2026-03-02T09:00:00.000Z')).toISOString()).toBe('2026-03-02T09:15:00.000Z')
    expect(earliestSessionStart(new Date('2026-03-02T09:04:59.000Z')).toISOString()).toBe('2026-03-02T09:15:00.000Z')
    expect(earliestSessionStart(new Date('2026-03-02T09:05:01.000Z')).toISOString()).toBe('2026-03-02T09:30:00.000Z')
  })
})
