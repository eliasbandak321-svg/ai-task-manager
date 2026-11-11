import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { LIMITS, TASK_PRIORITIES, TASK_STATUSES } from '../../src/domain/constants'

/*
  Database schema (docs/architecture.md §4). Changes go through `npm run db:generate`,
  which writes a versioned SQL migration into drizzle/ — never edit the database by hand.

  The domain functions (src/domain) are the primary guard for every rule. The constraints
  below are a second line of defence, so even a bug in the API can't store invalid data:
  - every owned row has user_id, and composite foreign keys (project_id, user_id) and
    (task_id, user_id) make it impossible for a task to point at another user's project,
    or a subtask at another user's task;
  - one Inbox per user, project names unique per user (ignoring case), valid statuses and
    priorities, length limits, and completed_at set exactly when a task is done.
*/

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
}

const maxLength = (column: string, max: number) => sql.raw(`char_length(${column}) between 1 and ${max}`)
const oneOf = (column: string, values: readonly string[]) =>
  sql.raw(`${column} in (${values.map((value) => `'${value}'`).join(', ')})`)

/**
 * Users. Shaped like Better Auth's `user` table, which takes it over in M7 (adding its
 * session, account and verification tables). In M6 the only user is the development user.
 */
export const users = pgTable('user', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const projects = pgTable(
  'project',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    isInbox: boolean('is_inbox').notNull().default(false),
    ...timestamps,
  },
  (table) => [
    // Lets tasks reference (project id, owner) together; see task_project_same_user_fk.
    unique('project_id_user_id_unique').on(table.id, table.userId),
    uniqueIndex('project_user_name_unique').on(table.userId, sql`lower(${table.name})`),
    uniqueIndex('project_one_inbox_per_user').on(table.userId).where(sql`${table.isInbox}`),
    check('project_name_length', maxLength('name', LIMITS.projectName)),
  ],
)

export const tasks = pgTable(
  'task',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    status: text('status', { enum: TASK_STATUSES }).notNull(),
    priority: text('priority', { enum: TASK_PRIORITIES }).notNull(),
    // A calendar date with no time zone (docs/architecture.md §4).
    dueDate: date('due_date', { mode: 'string' }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      name: 'task_project_same_user_fk',
      columns: [table.projectId, table.userId],
      foreignColumns: [projects.id, projects.userId],
    }).onDelete('cascade'),
    unique('task_id_user_id_unique').on(table.id, table.userId),
    index('task_user_project_idx').on(table.userId, table.projectId),
    check('task_title_length', maxLength('title', LIMITS.taskTitle)),
    check('task_description_length', sql.raw(`char_length(description) <= ${LIMITS.taskDescription}`)),
    check('task_status_valid', oneOf('status', TASK_STATUSES)),
    check('task_priority_valid', oneOf('priority', TASK_PRIORITIES)),
    check('task_completed_at_matches_status', sql`(${table.status} = 'done') = (${table.completedAt} is not null)`),
  ],
)

export const subtasks = pgTable(
  'subtask',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    taskId: uuid('task_id').notNull(),
    title: text('title').notNull(),
    done: boolean('done').notNull().default(false),
    position: integer('position').notNull(),
  },
  (table) => [
    foreignKey({
      name: 'subtask_task_same_user_fk',
      columns: [table.taskId, table.userId],
      foreignColumns: [tasks.id, tasks.userId],
    }).onDelete('cascade'),
    index('subtask_user_task_idx').on(table.userId, table.taskId),
    check('subtask_title_length', maxLength('title', LIMITS.subtaskTitle)),
    check('subtask_position_nonnegative', sql`${table.position} >= 0`),
  ],
)
