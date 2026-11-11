# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project
AI Task Manager: a full-stack productivity app (projects, tasks, subtasks, progress tracking, and AI Task Breakdown) built as a serious learning and portfolio project. Keep it practical and maintainable, without enterprise complexity.

- README.md: features and roadmap
- docs/architecture.md: technical decisions, data model, security model (source of truth)
- docs/design.md: visual design and tokens (source of truth)

## Tech Stack
Items marked with a milestone don't exist yet; add them only in that milestone.

- **Frontend:** React + TypeScript (strict mode), Vite SPA, Tailwind CSS v4, React Router and TanStack Query (M5)
- **Validation:** Zod schemas, shared by the frontend and the API (M4)
- **API:** Hono, same origin as the frontend (Vite proxy locally, Vercel Functions in production) (M6)
- **Database:** Neon PostgreSQL with Drizzle ORM and committed migrations (M6): the `development` branch locally, the `production` branch only from M11. PGlite for automated tests and explicitly selected offline development (`npm run dev:offline`)
- **Auth:** Better Auth, email and password, cookie sessions (M7); password reset (M8)
- **AI:** Claude API, server-side only, structured output validated with Zod (M9)
- **Tests:** Vitest, React Testing Library, PGlite for API tests (M6), Playwright end-to-end (M8)
- **CI:** GitHub Actions on every pull request (lint, typecheck, test, build)
- **Deployment:** Vercel, **only in M11**. Develop and test on localhost until then, keeping the code deployment-compatible (docs/architecture.md §9).

## Architecture Rules
- Business logic lives in pure, tested functions in `src/domain/`, with no React and no I/O (enforced by `src/domain/architecture.test.ts`). Ids and the clock are passed in via `CreateContext`.
- UI code accesses data only through the async repository interface (`src/data/`), via TanStack Query hooks. Never call `fetch` or storage directly from components.
- Validate all external input (forms, requests, AI output) with Zod at the boundary.
- Ask before major architectural changes: new frameworks or services, data model changes beyond the approved model, or a change to the repository pattern.

## Data Safety Rule (permanent, highest priority)
Never delete, reset, overwrite, or clean up existing user data, local databases (e.g. `.data/pglite`), Neon branches or databases, or project files without **first inspecting their contents and getting the developer's explicit approval** for that specific action. This includes "cleanup" of folders you believe you created yourself, `rm -rf`, `DROP`/`TRUNCATE`/`DELETE` statements, destructive migrations, branch resets, and `git reset --hard`/`git clean`.
- Inspect first and report what exists (e.g. row counts, file listings), then ask.
- After approval, **back up the data before** the destructive operation (database export or file copy into a git-ignored backup folder), and confirm the backup is readable.
- Additive changes (new tables or columns, new rows created by tests that are then removed by the same test run) are allowed, but must never remove or reassign existing data.
- Origin: on 2026-11-11 a local PGlite database with the developer's data was deleted without inspection. This must never happen again.

## Security Rules (essential)
- The user ID comes only from the server session, never from the request body or URL.
- Every database query on owned data filters by `userId`; every owned table has a `userId` column.
- Every API resource needs tests proving one user cannot read or modify another user's data.
- Another user's resource returns 404. Invalid input returns 400.
- Secrets live only in environment variables. Never use the `VITE_` prefix for secrets, because those variables are bundled into the browser.
- Treat AI output as untrusted: validate it, show it as a draft, and save only after the user approves.
- Nothing is deployed publicly before M11. Release requires the auth, isolation and security checks from M7–M8 to pass.

## Coding Conventions
- Functional components and hooks only; one component per file, PascalCase file names
- No `any` types; prefer explicit types for public functions and props
- Use design tokens, never hard-coded colors or spacing values
- Accessibility is required: semantic HTML, labels, keyboard support, visible focus states
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`)

## Workflow (learning-first)
The developer is a student learning professional software engineering. Act as a mentor:
- Work one checkpoint (milestone) at a time. Complete it, run its verification checks, then present the results for review.
- Small implementation details don't need approval. Ask before major architectural changes, merging pull requests, deploying, or enabling any paid service.
- Explain important architectural decisions and each new technology briefly when it's introduced.
- Maintain meaningful automated tests throughout: test-first for domain logic, isolation tests for every API resource.
- Never claim something works without verifying it (run tests, lint, or the app and show the output).
- The landing page and dashboard designs are temporary. M10 is a complete visual redesign of both (approved decision); don't spend time on visual polish before then, but keep them accessible, responsive and usable.
- Don't connect Vercel or deploy before M11.

## Commands
Requires Node 26 (see `.nvmrc`). Develop inside WSL on Windows; Smart App Control blocks Vite's native bundler on native Windows.

- `npm run dev`: start the web app (http://localhost:5173) and the API (127.0.0.1:8787, proxied as /api)
- `npm run dev:web` / `npm run dev:api`: start only one of them
- `npm run build`: typecheck, then build for production into `dist/`
- `npm run preview`: serve the production build locally
- `npm run lint`: lint with oxlint (including jsx-a11y accessibility rules)
- `npm run typecheck`: typecheck with `tsc -b`
- `npm test`: run Vitest in watch mode
- `npm run test:run`: run all tests once
- `npm run test:coverage`: tests with a coverage report (`coverage/index.html`)
- `npm run db:generate`: create a migration in `drizzle/` after changing `server/db/schema.ts` (never edit the database by hand)
- `npm run db:migrate`: the only way migrations are applied (servers never migrate; they refuse to start with pending migrations). `npm run dev` runs it once per session. Production requires `-- --confirm-production=<NEON_BRANCH_ID>`
- `npm run dev:offline`: run the app on the embedded PGlite database instead of Neon

- `npm run test:neon`: optional contract tests against the Neon development branch (cleans up its test users)

Database: `.env` (git-ignored) holds `DATABASE_PROVIDER=neon`, `DATABASE_URL` for the Neon **development** branch and `NEON_BRANCH_ID`; the API refuses any other branch, and there is no silent fallback to PGlite. Never print, log or commit the connection string, and never touch the Neon `production` branch before M11. PGlite is used only by automated tests and by `npm run dev:offline`.

Run `lint`, `typecheck`, `test:run`, and `build` before every commit. CI runs the same checks on every pull request.
