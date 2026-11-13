import { and, eq, inArray } from 'drizzle-orm'
import { DomainError, idSchema, planDependencies, setDependenciesInputSchema, type TaskDependency } from '../../src/domain'
import type { Database, Transaction } from '../db/client'
import { taskDependencies, tasks } from '../db/schema'

/** Dependencies between one user's tasks. The graph is kept acyclic (planDependencies). */
export class DependencyStore {
  private readonly db: Database | Transaction
  private readonly userId: string
  private readonly now: () => Date

  constructor(db: Database | Transaction, userId: string, now: () => Date = () => new Date()) {
    this.db = db
    this.userId = userId
    this.now = now
  }

  within(tx: Transaction): DependencyStore {
    return new DependencyStore(tx, this.userId, this.now)
  }

  async list(): Promise<TaskDependency[]> {
    return this.db
      .select({ taskId: taskDependencies.taskId, dependsOnId: taskDependencies.dependsOnId })
      .from(taskDependencies)
      .where(eq(taskDependencies.userId, this.userId))
  }

  /** Replaces the prerequisites of a task (validated: own tasks only, no cycles). */
  async set(taskId: string, input: unknown): Promise<TaskDependency[]> {
    const { dependsOn } = setDependenciesInputSchema.parse(input)
    if (!idSchema.safeParse(taskId).success) throw new DomainError('NOT_FOUND', 'Task not found')
    const run = async (db: Database | Transaction) => {
      const own = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.userId, this.userId))
      const known = new Set(own.map((row) => row.id))
      if (!known.has(taskId)) throw new DomainError('NOT_FOUND', 'Task not found')
      const existing = await db
        .select({ taskId: taskDependencies.taskId, dependsOnId: taskDependencies.dependsOnId })
        .from(taskDependencies)
        .where(eq(taskDependencies.userId, this.userId))
      const next = planDependencies(taskId, dependsOn, existing, known)
      await db.delete(taskDependencies).where(and(eq(taskDependencies.userId, this.userId), eq(taskDependencies.taskId, taskId)))
      if (next.length > 0) {
        await db.insert(taskDependencies).values(next.map((edge) => ({ ...edge, userId: this.userId, createdAt: this.now() })))
      }
      return next
    }
    // Inside an outer transaction (plan approval) run directly; otherwise in our own.
    return 'rollback' in this.db ? run(this.db) : (this.db as Database).transaction((tx) => run(tx))
  }

  /** Adds edges that were already validated together (a new plan). */
  async addValidated(edges: readonly TaskDependency[]): Promise<void> {
    if (edges.length === 0) return
    const ids = [...new Set(edges.flatMap((edge) => [edge.taskId, edge.dependsOnId]))]
    const own = await this.db.select({ id: tasks.id }).from(tasks).where(and(eq(tasks.userId, this.userId), inArray(tasks.id, ids)))
    if (own.length !== ids.length) throw new DomainError('NOT_FOUND', 'Task not found')
    await this.db.insert(taskDependencies).values(edges.map((edge) => ({ ...edge, userId: this.userId, createdAt: this.now() })))
  }
}
