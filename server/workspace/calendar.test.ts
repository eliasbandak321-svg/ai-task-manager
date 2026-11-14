import { describe, expect, it } from 'vitest'
import type { CalendarEvent, Occurrence, Task } from '../../src/domain'
import { BERLIN_PREFS, testApi, testClock } from '../test/apiClient'
import { createTestUser, setupTestDatabase } from '../test/testDatabase'

const database = setupTestDatabase()
const clock = testClock('2026-03-02T07:00:00.000Z') // Monday 08:00 in Berlin

type Range = { events: CalendarEvent[]; occurrences: Occurrence[] }

async function setup() {
  const call = testApi(database(), { now: clock.now })
  const user = await createTestUser(database())
  const other = await createTestUser(database())
  await call(user, 'PUT', '/api/preferences', BERLIN_PREFS)
  return { call, user, other }
}

const standup = {
  title: 'Standup',
  category: 'meeting',
  startAt: '2026-03-02T08:00:00.000Z', // 09:00 Berlin
  endAt: '2026-03-02T08:15:00.000Z',
  timeZone: 'Europe/Berlin',
}
const WEEK = '?from=2026-03-01T23:00:00.000Z&to=2026-03-08T23:00:00.000Z'

describe('preferences', () => {
  it('returns defaults in the browser time zone until saved, then the saved settings', async () => {
    const call = testApi(database(), { now: clock.now })
    const user = await createTestUser(database())
    const initial = await call(user, 'GET', '/api/preferences?tz=America/New_York')
    expect(initial.body).toMatchObject({ saved: false, preferences: { timeZone: 'America/New_York', workDays: [1, 2, 3, 4, 5] } })
    expect((await call(user, 'GET', '/api/preferences?tz=Not/AZone')).body).toMatchObject({ preferences: { timeZone: 'UTC' } })

    const saved = await call(user, 'PUT', '/api/preferences', { ...BERLIN_PREFS, workDays: [5, 1, 1] })
    expect(saved.body).toMatchObject({ saved: true, preferences: { workDays: [1, 5] } })
    expect((await call(user, 'GET', '/api/preferences')).body).toMatchObject({ saved: true, preferences: { timeZone: 'Europe/Berlin' } })
  })

  it('rejects invalid settings', async () => {
    const { call, user } = await setup()
    for (const invalid of [
      { ...BERLIN_PREFS, timeZone: 'Mars/Base' },
      { ...BERLIN_PREFS, dayStartMinutes: 900, dayEndMinutes: 600 },
      { ...BERLIN_PREFS, workDays: [] },
      { ...BERLIN_PREFS, userId: user },
    ]) {
      expect((await call(user, 'PUT', '/api/preferences', invalid)).status).toBe(400)
    }
  })
})

describe('calendar events', () => {
  it('creates, lists, edits and deletes a single event', async () => {
    const { call, user } = await setup()
    const created = await call<CalendarEvent>(user, 'POST', '/api/calendar/events', standup)
    expect(created.status).toBe(201)
    expect(created.body).toMatchObject({ title: 'Standup', category: 'meeting', userId: user, recurrence: null })

    const listed = await call<Range>(user, 'GET', `/api/calendar/events${WEEK}`)
    expect(listed.body.occurrences.map((o) => o.start)).toEqual([standup.startAt])

    const moved = await call<CalendarEvent>(user, 'PATCH', `/api/calendar/events/${created.body.id}`, {
      changes: { startAt: '2026-03-03T09:00:00.000Z', endAt: '2026-03-03T10:00:00.000Z' },
    })
    expect(moved.body).toMatchObject({ startAt: '2026-03-03T09:00:00.000Z', endAt: '2026-03-03T10:00:00.000Z' })

    expect((await call(user, 'DELETE', `/api/calendar/events/${created.body.id}`)).status).toBe(204)
    expect((await call<Range>(user, 'GET', `/api/calendar/events${WEEK}`)).body.occurrences).toEqual([])
  })

  it('validates input and the requested range', async () => {
    const { call, user } = await setup()
    expect((await call(user, 'POST', '/api/calendar/events', { ...standup, endAt: standup.startAt })).status).toBe(400)
    expect((await call(user, 'POST', '/api/calendar/events', { ...standup, title: '' })).status).toBe(400)
    expect((await call(user, 'POST', '/api/calendar/events', { ...standup, userId: user })).status).toBe(400)
    expect((await call(user, 'GET', '/api/calendar/events?from=2026-01-01T00:00:00.000Z&to=2026-06-01T00:00:00.000Z')).status).toBe(400)
    expect((await call(user, 'GET', '/api/calendar/events')).status).toBe(400)
  })

  it('expands a recurring event and edits one occurrence, the following ones, or the series', async () => {
    const { call, user } = await setup()
    const series = await call<CalendarEvent>(user, 'POST', '/api/calendar/events', { ...standup, recurrence: { freq: 'daily' } })
    const starts = async () => (await call<Range>(user, 'GET', `/api/calendar/events${WEEK}`)).body.occurrences.map((o) => `${o.start} ${o.title}`)
    expect(await starts()).toHaveLength(7)

    // One occurrence (Wednesday) moves to 10:00 and gets a new title; the rest stays.
    const wednesday = '2026-03-04T08:00:00.000Z'
    const separated = await call<CalendarEvent>(user, 'PATCH', `/api/calendar/events/${series.body.id}`, {
      scope: 'occurrence',
      occurrenceStart: wednesday,
      changes: { title: 'Long standup', startAt: '2026-03-04T09:00:00.000Z', endAt: '2026-03-04T09:30:00.000Z' },
    })
    expect(separated.body).toMatchObject({ seriesId: series.body.id, originalStart: wednesday, recurrence: null })
    expect(await starts()).toContain('2026-03-04T09:00:00.000Z Long standup')
    expect(await starts()).not.toContain(`${wednesday} Standup`)

    // From Friday on, the standup is renamed.
    await call(user, 'PATCH', `/api/calendar/events/${series.body.id}`, {
      scope: 'following',
      occurrenceStart: '2026-03-06T08:00:00.000Z',
      changes: { title: 'Sync' },
    })
    const after = await starts()
    expect(after.filter((entry) => entry.endsWith('Sync'))).toHaveLength(3) // Fri, Sat, Sun
    expect(after.filter((entry) => entry.endsWith(' Standup'))).toHaveLength(3) // Mon, Tue, Thu

    // An occurrence that isn't part of the series is refused.
    const invalid = await call(user, 'PATCH', `/api/calendar/events/${series.body.id}`, {
      scope: 'occurrence',
      occurrenceStart: '2026-03-04T08:05:00.000Z',
      changes: { title: 'x' },
    })
    expect(invalid.status).toBe(400)
  })

  it('deletes one occurrence, the following ones, or the whole series', async () => {
    const { call, user } = await setup()
    const series = await call<CalendarEvent>(user, 'POST', '/api/calendar/events', { ...standup, recurrence: { freq: 'daily' } })
    const count = async () => (await call<Range>(user, 'GET', `/api/calendar/events${WEEK}`)).body.occurrences.length
    const id = series.body.id

    await call(user, 'DELETE', `/api/calendar/events/${id}?scope=occurrence&occurrenceStart=2026-03-03T08:00:00.000Z`)
    expect(await count()).toBe(6)
    await call(user, 'DELETE', `/api/calendar/events/${id}?scope=following&occurrenceStart=2026-03-06T08:00:00.000Z`)
    expect(await count()).toBe(3) // Mon, Wed, Thu
    await call(user, 'DELETE', `/api/calendar/events/${id}?scope=series`)
    expect(await count()).toBe(0)
  })

  it('moves the whole series by the change made to one occurrence', async () => {
    const { call, user } = await setup()
    const series = await call<CalendarEvent>(user, 'POST', '/api/calendar/events', { ...standup, recurrence: { freq: 'weekly' } })
    await call(user, 'PATCH', `/api/calendar/events/${series.body.id}`, {
      scope: 'series',
      occurrenceStart: '2026-03-09T08:00:00.000Z',
      changes: { startAt: '2026-03-09T09:00:00.000Z', endAt: '2026-03-09T09:30:00.000Z' },
    })
    const event = await call<CalendarEvent>(user, 'GET', `/api/calendar/events/${series.body.id}`)
    expect(event.body).toMatchObject({ startAt: '2026-03-02T09:00:00.000Z', endAt: '2026-03-02T09:30:00.000Z' })
  })

  it('links events to tasks, and keeps them (unlinked) when the task is deleted', async () => {
    const { call, user } = await setup()
    const [inbox] = (await call(user, 'GET', '/api/projects')).body
    const task = await call<Task>(user, 'POST', '/api/tasks', { projectId: inbox.id, title: 'Essay' })
    const session = await call<CalendarEvent>(user, 'POST', '/api/calendar/events', { ...standup, title: 'Essay', category: 'work_session', taskId: task.body.id })
    expect(session.body.taskId).toBe(task.body.id)

    expect((await call(user, 'DELETE', `/api/tasks/${task.body.id}`)).status).toBe(204)
    const kept = await call<CalendarEvent>(user, 'GET', `/api/calendar/events/${session.body.id}`)
    expect(kept.status).toBe(200)
    expect(kept.body.taskId).toBeNull()
  })
})

describe('calendar isolation', () => {
  it("never shows or changes another user's events, and can't link another user's task", async () => {
    const { call, user, other } = await setup()
    const mine = await call<CalendarEvent>(user, 'POST', '/api/calendar/events', standup)
    const [theirInbox] = (await call(other, 'GET', '/api/projects')).body
    const theirTask = await call<Task>(other, 'POST', '/api/tasks', { projectId: theirInbox.id, title: 'Secret' })

    expect((await call<Range>(other, 'GET', `/api/calendar/events${WEEK}`)).body).toEqual({ events: [], occurrences: [] })
    expect((await call(other, 'GET', `/api/calendar/events/${mine.body.id}`)).status).toBe(404)
    expect((await call(other, 'PATCH', `/api/calendar/events/${mine.body.id}`, { changes: { title: 'Hacked' } })).status).toBe(404)
    expect((await call(other, 'DELETE', `/api/calendar/events/${mine.body.id}`)).status).toBe(404)
    expect((await call(user, 'POST', '/api/calendar/events', { ...standup, taskId: theirTask.body.id })).status).toBe(404)
    expect((await call(user, 'PATCH', `/api/calendar/events/${mine.body.id}`, { changes: { taskId: theirTask.body.id } })).status).toBe(404)
    expect((await call<CalendarEvent>(user, 'GET', `/api/calendar/events/${mine.body.id}`)).body.title).toBe('Standup')
  })

  it('requires a signed-in user', async () => {
    const call = testApi(database())
    expect((await call(null, 'GET', `/api/calendar/events${WEEK}`)).status).toBe(401)
    expect((await call(null, 'GET', '/api/preferences')).status).toBe(401)
  })
})
