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
- **API:** Hono on Vercel Functions, same origin as the frontend (M6)
- **Database:** Neon PostgreSQL with Drizzle ORM and committed migrations (M6)
- **Auth:** Better Auth, email and password, cookie sessions; password reset before the public release (M7/M8)
- **AI:** Claude API, server-side only, structured output validated with Zod (M9)
- **Tests:** Vitest, React Testing Library, PGlite for API tests (M6), Playwright end-to-end (M8)
- **Deployment and CI:** Vercel and GitHub Actions (CI runs lint, typecheck, test, build)

## Architecture Rules
- Business logic lives in pure, tested functions in `src/domain/`, with no React and no I/O.
- UI code accesses data only through the async repository interface (`src/data/`), via TanStack Query hooks. Never call `fetch` or storage directly from components.
- Validate all external input (forms, requests, AI output) with Zod at the boundary.
- Ask before major architectural changes: new frameworks or services, data model changes beyond the approved model, or a change to the repository pattern.

## Security Rules (essential)
- The user ID comes only from the server session, never from the request body or URL.
- Every database query on owned data filters by `userId`; every owned table has a `userId` column.
- Every API resource needs tests proving one user cannot read or modify another user's data.
- Another user's resource returns 404. Invalid input returns 400.
- Secrets live only in environment variables. Never use the `VITE_` prefix for secrets, because those variables are bundled into the browser.
- Treat AI output as untrusted: validate it, show it as a draft, and save only after the user approves.
- Don't publicly release the app until the M8 security checks pass. The landing page may be public.

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
- The landing page design is temporary; don't redesign it before M10, but keep it accessible and responsive.

## Commands
Requires Node 26 (see `.nvmrc`). Develop inside WSL on Windows; Smart App Control blocks Vite's native bundler on native Windows.

- `npm run dev`: start the dev server at http://localhost:5173
- `npm run build`: typecheck, then build for production into `dist/`
- `npm run preview`: serve the production build locally
- `npm run lint`: lint with oxlint (including jsx-a11y accessibility rules)
- `npm run typecheck`: typecheck with `tsc -b`
- `npm test`: run Vitest in watch mode
- `npm run test:run`: run all tests once

Run `lint`, `typecheck`, `test:run`, and `build` before every commit. CI runs the same checks on every pull request.
