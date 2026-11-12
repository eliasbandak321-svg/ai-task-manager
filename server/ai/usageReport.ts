import { existsSync } from 'node:fs'
import { desc, sql } from 'drizzle-orm'
import { openDatabase } from '../db/client'
import { aiUsage } from '../db/schema'
import { databaseConfig, describeDatabase, loadEnv } from '../env'
import { formatUsd } from './pricing'

/*
  `npm run ai:usage`: AI requests, tokens and cost recorded by the app, per day (all users).
  Read-only, and it prints counts only: never prompts, answers or who asked. The Anthropic
  Console stays the authoritative record of what was billed.
*/

const envFile = process.env.ENV_FILE ?? '.env'
if (existsSync(envFile)) process.loadEnvFile(envFile)
const env = loadEnv(process.env)
const { db, close } = await openDatabase(databaseConfig(env))
try {
  const rows = await db
    .select({
      day: aiUsage.day,
      requests: sql<number>`sum(${aiUsage.requests})::int`,
      inputTokens: sql<number>`sum(${aiUsage.inputTokens})::int`,
      outputTokens: sql<number>`sum(${aiUsage.outputTokens})::int`,
      cost: sql<number>`sum(${aiUsage.costMicroUsd})::bigint`,
    })
    .from(aiUsage)
    .groupBy(aiUsage.day)
    .orderBy(desc(aiUsage.day))
    .limit(31)

  console.log(`AI usage · ${describeDatabase(env)} · provider ${env.AI_PROVIDER}${env.AI_PROVIDER === 'anthropic' ? ` (${env.AI_MODEL})` : ''}`)
  console.log('day         requests  input tokens  output tokens  cost')
  let total = 0
  for (const row of rows) {
    total += Number(row.cost)
    console.log(
      `${row.day}  ${String(row.requests).padStart(8)}  ${String(row.inputTokens).padStart(12)}  ${String(row.outputTokens).padStart(13)}  ${formatUsd(Number(row.cost))}`,
    )
  }
  console.log(`Total recorded cost: ${formatUsd(total)} of the ${formatUsd(env.AI_BUDGET_USD * 1_000_000)} cap`)
} finally {
  await close()
}
