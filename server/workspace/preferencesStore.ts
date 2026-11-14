import { eq } from 'drizzle-orm'
import { defaultPreferences, isValidTimeZone, preferencesSchema, type Preferences } from '../../src/domain'
import type { Database } from '../db/client'
import { userPreferences } from '../db/schema'

export interface StoredPreferences {
  preferences: Preferences
  /** False until the user saves their settings once (defaults are shown until then). */
  saved: boolean
  updatedAt: string | null
}

/** Availability and personalization settings of one user. */
export class PreferencesStore {
  private readonly db: Database
  private readonly userId: string
  private readonly now: () => Date

  constructor(db: Database, userId: string, now: () => Date = () => new Date()) {
    this.db = db
    this.userId = userId
    this.now = now
  }

  /** The saved settings, or defaults in `fallbackTimeZone` (the browser's zone, if valid). */
  async get(fallbackTimeZone = 'UTC'): Promise<StoredPreferences> {
    const [row] = await this.db.select().from(userPreferences).where(eq(userPreferences.userId, this.userId))
    if (!row) {
      const timeZone = isValidTimeZone(fallbackTimeZone) ? fallbackTimeZone : 'UTC'
      return { preferences: defaultPreferences(timeZone), saved: false, updatedAt: null }
    }
    const { userId: _userId, updatedAt, ...preferences } = row
    return { preferences, saved: true, updatedAt: updatedAt.toISOString() }
  }

  async save(input: unknown): Promise<StoredPreferences> {
    const parsed = preferencesSchema.parse(input)
    const preferences = { ...parsed, workDays: [...new Set(parsed.workDays)].sort((a, b) => a - b) }
    const updatedAt = this.now()
    await this.db
      .insert(userPreferences)
      .values({ userId: this.userId, ...preferences, updatedAt })
      .onConflictDoUpdate({ target: userPreferences.userId, set: { ...preferences, updatedAt } })
    return { preferences, saved: true, updatedAt: updatedAt.toISOString() }
  }
}
