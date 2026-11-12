import type { Context, Hono } from 'hono'
import { addDays, computeInsights, zonedParts, zonedRange } from '../src/domain'
import { ApiError } from './errors'
import { rangeQuerySchema } from './workspace/calendarStore'
import type { AiService } from './ai/aiService'
import type { Workspace } from './workspace/workspace'

/*
  M9 routes: preferences, calendar, scheduling, proposals, insights and AI. Like the task
  routes they are thin: the session decides the user (set up in app.ts), the stores and
  services validate and enforce every rule.
*/

export type WorkspaceEnv = { Variables: { workspace: Workspace; ai: AiService } }

async function body(c: Context): Promise<unknown> {
  if (!/^application\/json\b/i.test(c.req.header('content-type') ?? '')) {
    throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Send the request body as JSON (Content-Type: application/json).')
  }
  try {
    return await c.req.json()
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'The request body is not valid JSON.')
  }
}

export function registerWorkspaceRoutes<E extends WorkspaceEnv>(app: Hono<E>): void {
  // ---------- Preferences ----------
  app.get('/preferences', async (c) => c.json(await c.var.workspace.preferences.get(c.req.query('tz') ?? 'UTC')))
  app.put('/preferences', async (c) => c.json(await c.var.workspace.preferences.save(await body(c))))

  // ---------- Calendar ----------
  app.get('/calendar/events', async (c) => {
    const { from, to } = rangeQuerySchema.parse({ from: c.req.query('from'), to: c.req.query('to') })
    const events = await c.var.workspace.calendar.eventsInRange(new Date(from), new Date(to))
    const occurrences = await c.var.workspace.calendar.occurrences(new Date(from), new Date(to))
    return c.json({ events, occurrences })
  })
  app.post('/calendar/events', async (c) => c.json(await c.var.workspace.calendar.create(await body(c)), 201))
  app.get('/calendar/events/:id', async (c) => c.json(await c.var.workspace.calendar.get(c.req.param('id'))))
  app.patch('/calendar/events/:id', async (c) => c.json(await c.var.workspace.calendar.update(c.req.param('id'), await body(c))))
  app.delete('/calendar/events/:id', async (c) => {
    await c.var.workspace.calendar.delete(c.req.param('id'), {
      scope: c.req.query('scope') ?? 'series',
      occurrenceStart: c.req.query('occurrenceStart') ?? null,
    })
    return c.body(null, 204)
  })

  // ---------- Scheduling and proposals ----------
  app.post('/schedule/proposals', async (c) => c.json(await c.var.workspace.proposeSchedule(await body(c)), 201))
  app.get('/proposals', async (c) => c.json(await c.var.workspace.proposals.listPending()))
  app.get('/proposals/:id', async (c) => c.json(await c.var.workspace.proposals.get(c.req.param('id'))))
  app.post('/proposals/:id/apply', async (c) => c.json(await c.var.workspace.apply(c.req.param('id'), await body(c))))
  app.post('/proposals/:id/reject', async (c) => c.json(await c.var.workspace.reject(c.req.param('id'))))

  // ---------- Insights (derived from real data only) ----------
  app.get('/insights', async (c) => {
    const workspace = c.var.workspace
    const prefs = await workspace.prefs()
    const now = workspace.now()
    const today = zonedParts(now, prefs.timeZone).date
    const [tasks, projects, upcoming] = await Promise.all([
      workspace.tasks.listTasks(),
      workspace.tasks.listProjects(),
      workspace.calendar.occurrences(zonedRange(today, today, prefs.timeZone).start, zonedRange(today, addDays(today, 6), prefs.timeZone).end),
    ])
    return c.json(computeInsights({ tasks, projects, upcoming, prefs, now }))
  })

  // ---------- AI ----------
  app.get('/ai/status', async (c) => c.json(await c.var.ai.status()))
  app.post('/ai/chat', async (c) => c.json(await c.var.ai.chat(await body(c))))
  app.get('/ai/conversations', async (c) => c.json(await c.var.ai.listConversations()))
  app.get('/ai/conversations/:id/messages', async (c) => c.json(await c.var.ai.messages(c.req.param('id'))))
  app.delete('/ai/conversations/:id', async (c) => {
    await c.var.ai.deleteConversation(c.req.param('id'))
    return c.body(null, 204)
  })
  app.post('/ai/plan', async (c) => c.json(await c.var.ai.plan(await body(c)), 201))
  app.post('/ai/tasks/:id/assist', async (c) => c.json(await c.var.ai.taskAssist(c.req.param('id'), await body(c))))
}
