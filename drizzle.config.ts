import { defineConfig } from 'drizzle-kit'

// `npm run db:generate` compares server/db/schema.ts with the existing migrations and
// writes a new SQL migration into drizzle/. Migrations are committed and applied by
// `npm run db:migrate` (and automatically when the API starts in development).
export default defineConfig({
  dialect: 'postgresql',
  schema: './server/db/schema.ts',
  out: './drizzle',
})
