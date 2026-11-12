import { randomUUID } from 'node:crypto'
import { and, eq, gt, inArray, isNotNull, lt, or } from 'drizzle-orm'
import { z } from 'zod'
import {
  addDays,
  createEventInputSchema,
  DomainError,
  EDIT_SCOPES,
  expandEvent,
  expandEvents,
  idSchema,
  isOccurrenceOf,
  timestampSchema,
  updateEventInputSchema,
  zonedParts,
  type CalendarEvent,
  type Occurrence,
} from '../../src/domain'
import type { Database, Transaction } from '../db/client'
import { calendarEvents, tasks } from '../db/schema'

/*
  Calendar events of one user. The user id is fixed when the store is created (from the
  session) and every query filters by it. Recurring events are stored as rules and expanded
  for the requested range only.
*/

type EventRow = typeof calendarEvents.$inferSelect

/** The widest range one request may expand (protects the server from huge expansions). */
export const MAX_RANGE_DAYS = 62

export const rangeQuerySchema = z
  .object({ from: timestampSchema, to: timestampSchema })
  .refine(({ from, to }) => new Date(to) > new Date(from), { message: '"to" must be after "from"', path: ['to'] })
  .refine(({ from, to }) => new Date(to).getTime() - new Date(from).getTime() <= MAX_RANGE_DAYS * 86_400_000, {
    message: `The range may be at most ${MAX_RANGE_DAYS} days`,
    path: ['to'],
  })

export const eventChangeSchema = z.strictObject({
  /** For a recurring event: which events the change applies to. Ignored for single events. */
  scope: z.enum(EDIT_SCOPES).default('series'),
  /** The occurrence that was edited (its original start); required unless scope is 'series'. */
  occurrenceStart: timestampSchema.nullable().default(null),
  changes: updateEventInputSchema,
})

export const eventDeletionSchema = z.strictObject({
  scope: z.enum(EDIT_SCOPES).default('series'),
  occurrenceStart: timestampSchema.nullable().default(null),
})

function toEvent(row: EventRow): CalendarEvent {
  return {
    ...row,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    originalStart: row.originalStart?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function toValues(event: CalendarEvent) {
  return {
    ...event,
    startAt: new Date(event.startAt),
    endAt: new Date(event.endAt),
    originalStart: event.originalStart ? new Date(event.originalStart) : null,
    createdAt: new Date(event.createdAt),
    updatedAt: new Date(event.updatedAt),
  }
}

const shift = (instant: string, ms: number) => new Date(new Date(instant).getTime() + ms).toISOString()

export class CalendarStore {
  private readonly db: Database | Transaction
  private readonly userId: string
  private readonly now: () => Date
  private readonly newId: () => string

  constructor(db: Database | Transaction, userId: string, now: () => Date = () => new Date(), newId: () => string = randomUUID) {
    this.db = db
    this.userId = userId
    this.now = now
    this.newId = newId
  }

  /** The same store working inside a transaction. */
  within(tx: Transaction): CalendarStore {
    return new CalendarStore(tx, this.userId, this.now, this.newId)
  }

  /** Events that may have an occurrence in [from, to). */
  async eventsInRange(from: Date, to: Date): Promise<CalendarEvent[]> {
    const rows = await this.db
      .select()
      .from(calendarEvents)
      .where(
        and(
          eq(calendarEvents.userId, this.userId),
          lt(calendarEvents.startAt, to),
          or(isNotNull(calendarEvents.recurrence), gt(calendarEvents.endAt, from)),
        ),
      )
    return rows.map(toEvent)
  }

  async occurrences(from: Date, to: Date): Promise<Occurrence[]> {
    return expandEvents(await this.eventsInRange(from, to), from, to)
  }

  /**
   * Every task-linked session relevant to effort: all single linked events (any time; their
   * status says whether the work was done), plus occurrences of linked series in [from, until).
   */
  async linkedSessions(from: Date, until: Date): Promise<Occurrence[]> {
    const rows = await this.db
      .select()
      .from(calendarEvents)
      .where(and(eq(calendarEvents.userId, this.userId), isNotNull(calendarEvents.taskId)))
    return rows.map(toEvent).flatMap((event) =>
      event.recurrence === null
        ? expandEvent(event, new Date(event.startAt), new Date(event.endAt))
        : expandEvent(event, from, until),
    )
  }

  async listByTask(taskId: string): Promise<CalendarEvent[]> {
    const rows = await this.db
      .select()
      .from(calendarEvents)
      .where(and(eq(calendarEvents.userId, this.userId), eq(calendarEvents.taskId, taskId)))
    return rows.map(toEvent)
  }

  async get(id: string): Promise<CalendarEvent> {
    if (!idSchema.safeParse(id).success) throw new DomainError('NOT_FOUND', 'Event not found')
    const [row] = await this.db
      .select()
      .from(calendarEvents)
      .where(and(eq(calendarEvents.id, id), eq(calendarEvents.userId, this.userId)))
    if (!row) throw new DomainError('NOT_FOUND', 'Event not found')
    return toEvent(row)
  }

  async getMany(ids: readonly string[]): Promise<CalendarEvent[]> {
    if (ids.length === 0) return []
    const rows = await this.db
      .select()
      .from(calendarEvents)
      .where(and(inArray(calendarEvents.id, [...ids]), eq(calendarEvents.userId, this.userId)))
    return rows.map(toEvent)
  }

  /** A linked task must belong to the same user (the foreign key checks this too). */
  private async assertTask(taskId: string | null | undefined): Promise<void> {
    if (!taskId) return
    const [row] = await this.db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.userId, this.userId)))
    if (!row) throw new DomainError('NOT_FOUND', 'Task not found')
  }

  async create(input: unknown): Promise<CalendarEvent> {
    const parsed = createEventInputSchema.parse(input)
    await this.assertTask(parsed.taskId)
    const timestamp = this.now().toISOString()
    const event: CalendarEvent = {
      id: this.newId(),
      userId: this.userId,
      ...parsed,
      excludedStarts: [],
      seriesId: null,
      originalStart: null,
      sessionStatus: 'planned',
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    await this.db.insert(calendarEvents).values(toValues(event))
    return event
  }

  private async save(event: CalendarEvent): Promise<CalendarEvent> {
    const next = { ...event, updatedAt: this.now().toISOString() }
    const { id: _id, userId: _userId, createdAt: _createdAt, ...values } = toValues(next)
    await this.db
      .update(calendarEvents)
      .set(values)
      .where(and(eq(calendarEvents.id, event.id), eq(calendarEvents.userId, this.userId)))
    return next
  }

  private async insert(event: Omit<CalendarEvent, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<CalendarEvent> {
    const timestamp = this.now().toISOString()
    const created: CalendarEvent = { ...event, id: this.newId(), userId: this.userId, createdAt: timestamp, updatedAt: timestamp }
    await this.db.insert(calendarEvents).values(toValues(created))
    return created
  }

  private assertOccurrence(event: CalendarEvent, occurrenceStart: string | null): string {
    if (!occurrenceStart || !isOccurrenceOf(event, occurrenceStart)) {
      throw new DomainError('INVALID_OCCURRENCE', 'That occurrence is not part of this event')
    }
    return occurrenceStart
  }

  /** Number of occurrences of a series before `instant` (for splitting a counted series). */
  private countBefore(event: CalendarEvent, instant: string): number {
    return expandEvent(event, new Date(event.startAt), new Date(instant)).length
  }

  /** Ends a series before `occurrenceStart` (the occurrence and later ones are no longer in it). */
  private truncated(event: CalendarEvent, occurrenceStart: string): CalendarEvent {
    const localDate = zonedParts(new Date(occurrenceStart), event.timeZone).date
    const recurrence = event.recurrence && { ...event.recurrence, until: addDays(localDate, -1), count: null }
    return {
      ...event,
      recurrence,
      excludedStarts: event.excludedStarts.filter((start) => start < occurrenceStart),
    }
  }

  async update(id: string, input: unknown): Promise<CalendarEvent> {
    const { scope, occurrenceStart, changes } = eventChangeSchema.parse(input)
    const event = await this.get(id)
    await this.assertTask(changes.taskId)
    if (changes.sessionStatus !== undefined) {
      // A whole series can't be "done"; mark one occurrence (which separates it) instead.
      if (event.recurrence !== null && scope !== 'occurrence') {
        throw new DomainError('INVALID_SESSION_STATUS', 'Mark a single occurrence of a repeating event, not the whole series')
      }
      const start = changes.startAt ?? (event.recurrence !== null && occurrenceStart ? occurrenceStart : event.startAt)
      if (changes.sessionStatus === 'completed' && new Date(start) > this.now()) {
        throw new DomainError('INVALID_SESSION_STATUS', "A session can't be marked as done before it starts")
      }
    }

    // A single event (or an already separated occurrence): just apply the changes.
    if (event.recurrence === null) {
      return this.save(this.validated({ ...event, ...changes }))
    }

    if (scope === 'series') {
      // Times given for an occurrence move the whole series by the same amount.
      let next: CalendarEvent = { ...event, ...changes, startAt: event.startAt, endAt: event.endAt }
      if (changes.startAt !== undefined || changes.endAt !== undefined) {
        const anchor = occurrenceStart ? this.assertOccurrence(event, occurrenceStart) : event.startAt
        const anchorEnd = shift(anchor, new Date(event.endAt).getTime() - new Date(event.startAt).getTime())
        const delta = new Date(changes.startAt ?? anchor).getTime() - new Date(anchor).getTime()
        const length = new Date(changes.endAt ?? shift(anchorEnd, delta)).getTime() - new Date(changes.startAt ?? anchor).getTime()
        const startAt = shift(event.startAt, delta)
        next = { ...next, startAt, endAt: shift(startAt, length), excludedStarts: event.excludedStarts.map((start) => shift(start, delta)) }
      }
      return this.save(this.validated(next))
    }

    const at = this.assertOccurrence(event, occurrenceStart)
    const durationMs = new Date(event.endAt).getTime() - new Date(event.startAt).getTime()

    if (scope === 'occurrence') {
      // Stored as its own single event; the series skips that date.
      await this.save({ ...event, excludedStarts: [...event.excludedStarts, at] })
      const separated = this.validated({
        ...event,
        startAt: at,
        endAt: shift(at, durationMs),
        ...changes,
        recurrence: null,
        excludedStarts: [],
        seriesId: event.id,
        originalStart: at,
      })
      return this.insert(separated)
    }

    // 'following': this occurrence and later ones become a new series with the changes.
    if (at === event.startAt) return this.update(id, { scope: 'series', occurrenceStart: at, changes })
    const before = this.countBefore(event, at)
    await this.save(this.truncated(event, at))
    const recurrence = changes.recurrence !== undefined ? changes.recurrence : event.recurrence && { ...event.recurrence, count: event.recurrence.count === null ? null : Math.max(1, event.recurrence.count - before) }
    const following = this.validated({
      ...event,
      startAt: at,
      endAt: shift(at, durationMs),
      ...changes,
      recurrence,
      excludedStarts: event.excludedStarts.filter((start) => start > at),
      seriesId: null,
      originalStart: null,
    })
    return this.insert(following)
  }

  /** Re-checks the result of an edit with the same rules as a new event. */
  private validated<T extends CalendarEvent>(event: T): T {
    createEventInputSchema.parse({
      title: event.title,
      description: event.description,
      category: event.category,
      startAt: event.startAt,
      endAt: event.endAt,
      timeZone: event.timeZone,
      taskId: event.taskId,
      recurrence: event.recurrence,
    })
    return event
  }

  async delete(id: string, input: unknown = {}): Promise<void> {
    const { scope, occurrenceStart } = eventDeletionSchema.parse(input)
    const event = await this.get(id)
    if (event.recurrence !== null && scope !== 'series') {
      const at = this.assertOccurrence(event, occurrenceStart)
      if (scope === 'occurrence') {
        await this.save({ ...event, excludedStarts: [...event.excludedStarts, at] })
        return
      }
      if (at !== event.startAt) {
        await this.save(this.truncated(event, at))
        return
      }
    }
    // Deleting a series also deletes its separately edited occurrences (foreign key cascade).
    await this.db.delete(calendarEvents).where(and(eq(calendarEvents.id, id), eq(calendarEvents.userId, this.userId)))
  }

  /** Changes only the times of an event (used by approved schedule proposals). */
  async reschedule(event: CalendarEvent, startAt: string, endAt: string): Promise<CalendarEvent> {
    return this.save(this.validated({ ...event, startAt, endAt }))
  }

  async remove(event: CalendarEvent): Promise<void> {
    await this.db.delete(calendarEvents).where(and(eq(calendarEvents.id, event.id), eq(calendarEvents.userId, this.userId)))
  }
}
