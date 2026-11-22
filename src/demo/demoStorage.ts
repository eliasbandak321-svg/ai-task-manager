import { STORAGE_KEY as TASKS_KEY } from '../data/localRepository'

/*
  Where the portfolio demo keeps its data (M11): this tab's sessionStorage. Kept apart from
  demoClients.ts (which holds the sample data) so the demo banner's Reset button doesn't pull the
  sample data into the normal build.
*/

export interface DemoStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export const DEMO_KEYS = { tasks: TASKS_KEY, workspace: 'ai-task-manager:demo-workspace', seeded: 'ai-task-manager:demo-seeded' } as const

/** This tab's sessionStorage, or memory when the browser blocks storage (e.g. strict privacy modes). */
export function demoStorage(): DemoStorage {
  try {
    const storage = globalThis.sessionStorage
    const probe = '__demo_probe__'
    storage.setItem(probe, '1')
    storage.removeItem(probe)
    return storage
  } catch {
    const items = new Map<string, string>()
    return { getItem: (key) => items.get(key) ?? null, setItem: (key, value) => void items.set(key, value), removeItem: (key) => void items.delete(key) }
  }
}

/** Forgets the demo's changes; the next load starts again from the sample data. */
export function clearDemo(storage: DemoStorage): void {
  for (const key of Object.values(DEMO_KEYS)) storage.removeItem(key)
}

/** Reset Demo: forget this tab's changes and start again from the sample data. */
export function resetDemo(storage: DemoStorage = demoStorage()): void {
  clearDemo(storage)
  globalThis.location.assign('/app')
}
