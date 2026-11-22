import { z } from 'zod'
import { createDemoAuthClient } from './demoAuthClient'
import { clearDemo, DEMO_KEYS, demoStorage, type DemoStorage } from './demoStorage'
import { seedDemoData } from './demoData'
import { createInMemoryWorkspaceClient, type WorkspaceState } from './inMemoryWorkspace'
import type { AuthClient } from '../data/authClient'
import { LocalRepository } from '../data/localRepository'
import type { TaskRepository } from '../data/repository'
import type { WorkspaceClient } from '../data/workspaceClient'
import { calendarEventSchema, isValidTimeZone, preferencesSchema, proposalSchema } from '../domain'

/*
  The portfolio demo's data layer (M11, VITE_DEMO=1). The real UI runs unchanged on these
  browser-only clients:
  - projects, tasks, subtasks: LocalRepository (the same domain rules as the API)
  - calendar, scheduling, insights, proposals, simulated AI: the in-memory workspace
  - auth: the always-signed-in demo visitor
  Everything is kept in this tab's sessionStorage: it survives a reload, disappears when the tab
  closes, and is never shared with other tabs, visitors or any server. No network requests.
*/

const workspaceStateSchema = z.object({
  preferences: preferencesSchema,
  saved: z.boolean(),
  events: z.array(calendarEventSchema),
  proposals: z.array(proposalSchema),
  conversations: z.array(z.looseObject({ id: z.string(), title: z.string(), updatedAt: z.string(), messages: z.array(z.looseObject({})) })),
  dependencies: z.array(z.looseObject({ taskId: z.string(), dependsOnId: z.string() })),
})

function visitorTimeZone(): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  return zone && isValidTimeZone(zone) ? zone : 'UTC'
}

/** The saved demo, or null when there is none (or it can't be read: then it starts fresh). */
function savedState(storage: DemoStorage): WorkspaceState | null {
  if (storage.getItem(DEMO_KEYS.seeded) !== '1') return null
  try {
    const parsed = workspaceStateSchema.safeParse(JSON.parse(storage.getItem(DEMO_KEYS.workspace) ?? 'null'))
    return parsed.success ? (parsed.data as unknown as WorkspaceState) : null
  } catch {
    return null
  }
}

/** Makes every method wait until the sample data is in place. */
function afterReady<T extends object>(ready: Promise<void>, target: T): T {
  return new Proxy(target, {
    get(object, property) {
      const value = Reflect.get(object, property) as unknown
      if (typeof value !== 'function') return value
      return async (...args: unknown[]) => {
        await ready
        return (value as (...params: unknown[]) => unknown).apply(object, args)
      }
    },
  })
}

export interface DemoClients {
  repository: TaskRepository
  workspace: WorkspaceClient
  authClient: AuthClient
  /** Resolves once the sample data is ready (seeded on the first visit in this tab). */
  ready: Promise<void>
}

export function createDemoClients({
  storage = demoStorage(),
  timeZone = visitorTimeZone(),
  now = () => new Date(),
}: { storage?: DemoStorage; timeZone?: string; now?: () => Date } = {}): DemoClients {
  const initial = savedState(storage)
  if (!initial) clearDemo(storage)

  // While seeding, the clock is moved so finished work gets realistic completion dates.
  let seedClock: Date | null = null
  const clock = () => seedClock ?? now()
  const repository = new LocalRepository({ storage, now: clock })
  const workspace = createInMemoryWorkspaceClient(repository, {
    now: clock,
    timeZone,
    initial: initial ?? undefined,
    onChange: (state) => storage.setItem(DEMO_KEYS.workspace, JSON.stringify(state)),
  })

  const ready = initial
    ? Promise.resolve()
    : seedDemoData({ repository, workspace, now: now(), timeZone, setClock: (instant) => (seedClock = instant) }).then(
        () => {
          seedClock = null
          storage.setItem(DEMO_KEYS.seeded, '1')
        },
        (error: unknown) => {
          seedClock = null
          throw error
        },
      )

  return { repository: afterReady(ready, repository), workspace: afterReady(ready, workspace), authClient: createDemoAuthClient(), ready }
}
