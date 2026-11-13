import { existsSync } from 'node:fs'
import { desc, ne, sql } from 'drizzle-orm'
import { openDatabase } from '../db/client'
import { aiSpendLedger } from '../db/schema'
import { databaseConfig, describeDatabase, loadEnv } from '../env'
import { formatUsd } from './pricing'
import { SpendLedger } from './spendLedger'

/*
  `npm run ai:usage`: real AI requests, tokens and cost per day, from the app-wide spending
  ledger. Read-only; prints counts only — never prompts, answers or who asked. It covers what
  this app requested through this database; the Anthropic Console is the authoritative bill.
*/

const envFile = process.env.ENV_FILE ?? '.env'
if (existsSync(envFile)) process.loadEnvFile(envFile)
const env = loadEnv(process.env)
const { db, close } = await openDatabase(databaseConfig(env))
try {
  const day = sql<string>`to_char(${aiSpendLedger.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`
  const rows = await db
    .select({
      day,
      requests: sql<number>`count(*)::int`,
      inputTokens: sql<number>`coalesce(sum(${aiSpendLedger.inputTokens}), 0)::int`,
      outputTokens: sql<number>`coalesce(sum(${aiSpendLedger.outputTokens}), 0)::int`,
      cost: sql<number>`coalesce(sum(${aiSpendLedger.costMicroUsd}), 0)::bigint`,
    })
    .from(aiSpendLedger)
    .where(ne(aiSpendLedger.status, 'released'))
    .groupBy(day)
    .orderBy(desc(day))
    .limit(31)

  console.log(`AI usage (UTC days) · ${describeDatabase(env)} · provider ${env.AI_PROVIDER}${env.AI_PROVIDER === 'anthropic' ? ` (${env.AI_MODEL})` : ''}`)
  console.log('day         requests  input tokens  output tokens  cost')
  for (const row of rows) {
    console.log(
      `${row.day}  ${String(row.requests).padStart(8)}  ${String(row.inputTokens).padStart(12)}  ${String(row.outputTokens).padStart(13)}  ${formatUsd(Number(row.cost))}`,
    )
  }
  const committed = await new SpendLedger(db).committed()
  const cap = env.AI_BUDGET_USD * 1_000_000
  console.log(`Committed (settled + reserved): ${formatUsd(committed)} of the ${formatUsd(cap)} cap · remaining ${formatUsd(Math.max(0, cap - committed))}`)
} finally {
  await close()
}
