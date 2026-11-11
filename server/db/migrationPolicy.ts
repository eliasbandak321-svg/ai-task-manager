import type { Env } from '../env'

/*
  When may `npm run db:migrate` change a database?
  - development / test: yes (after the Neon branch check, when using Neon).
  - production: only with an explicit `--confirm-production=<NEON_BRANCH_ID>` argument naming
    the exact branch. A restart, a script default or a copied command can't migrate
    production by accident.
*/

export const CONFIRM_FLAG = '--confirm-production='

export function assertMigrationAllowed(env: Env, args: readonly string[]): void {
  if (env.NODE_ENV !== 'production') return

  const confirmed = args.find((arg) => arg.startsWith(CONFIRM_FLAG))?.slice(CONFIRM_FLAG.length)
  const target = env.NEON_BRANCH_ID
  if (!target || confirmed !== target) {
    throw new Error(
      `Refusing to migrate a production database without explicit confirmation. Run: npm run db:migrate -- ${CONFIRM_FLAG}${target ?? '<NEON_BRANCH_ID>'}`,
    )
  }
}
