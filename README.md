# AI Task Manager

A full-stack productivity app for students, developers and professionals: organize projects, manage tasks and subtasks, track progress, plan their time on a calendar with a scheduling engine, and use an AI workspace to turn goals into plans. *Plan smarter. Organize better. Get things done.* Built as a learning and portfolio project.

> **Status:** 🚧 In development. M1–M8 are complete: secure accounts (email confirmation, password reset), a dashboard on a Hono API with a Neon PostgreSQL database, and end-to-end tests. M9 (AI workspace and smart calendar) is built and in review; its AI runs on a free, offline demo provider until a real AI provider is approved. The current visual design is temporary: M10 is a complete redesign of the landing page and the dashboard.

## Features

### Implemented
- **Landing page** with a design-token system (Tailwind CSS v4), self-hosted Sora and Inter fonts, and a responsive layout from 320 px upward
- **3D particle wave** built with React Three Fiber and a custom GPU shader, lazy-loaded so it never blocks the page. Phones and browsers without WebGL get a CSS fallback, and reduced-motion users get a still frame.
- **Subtle motion**: staggered hero entrance, scroll reveals and card hover effects, all CSS-only and disabled under `prefers-reduced-motion`
- **Accessibility**: skip link, landmarks, full keyboard support, visible focus and WCAG AA contrast (Lighthouse Accessibility 100)
- **CI**: lint, typecheck, tests and build run on every pull request (GitHub Actions)
- **Domain logic**: Zod schemas and pure, fully tested functions for projects, tasks, subtasks, deadlines, statistics, search, filtering and sorting
- **Accounts**: sign up with email confirmation, sign in, sign out and reset a forgotten password (Better Auth). In development, emails are printed in the API terminal. Sessions are stored in the database, in HttpOnly SameSite cookies, and last 7 days. CSRF protection, brute-force rate limiting, and tests proving that users can never see or change each other's data.
- **Projects** (`/app/projects`): projects with a default Inbox; tasks with statuses, priorities and deadlines; subtask checklists; progress statistics; search, filters and sorting kept in the URL; accessible dialogs with confirmation before deleting. Data is stored in PostgreSQL through the API.
- **API and database**: a Hono REST API with Neon PostgreSQL and Drizzle ORM (committed migrations, database constraints as a second line of defence), consistent JSON errors, and tests proving users can't see or change each other's data. Development uses a Neon development branch; automated tests run offline on PGlite (PostgreSQL in WebAssembly).

- **Dashboard** (`/app`, M9): today's tasks, upcoming sessions, deadlines, progress and suggestions waiting for approval
- **Calendar** (M9): day, week and month views, drag to move or resize, select to create; categories (work, study, meetings, focus, personal, breaks); events linked to tasks; daily, weekly (chosen weekdays) and monthly repeats with "this event / this and following / all" edits; correct across time zones and daylight saving; an agenda list as the keyboard alternative to drag-and-drop
- **Smart scheduling** (M9): a deterministic engine fits open tasks into your working hours around your calendar (deadlines first, then priority; session length, breaks, focus period and a daily maximum), never overbooks, and explains what doesn't fit. Replanning moves future sessions with a before/after preview
- **AI workspace** (M9): an assistant that answers from your real data, a goal-to-project plan builder with a fully editable preview, and help on individual tasks. Every suggested change is a proposal you approve (or trim) first; approvals are atomic, checked for stale data, and can't be applied twice
- **Insights and settings** (M9): progress, workload per day against capacity, scheduled vs. unscheduled tasks and rule-based suggestions, all from real data; availability, time zone and use case (student, developer, professional, freelancer, personal, general)

### Planned (MVP)
- End-to-end tests and a security review
- Public deployment once the app is complete, redesigned and fully tested

### Planned (AI)
- Connect a real AI provider (Claude Haiku 5.5 recommended, see [docs/architecture.md](docs/architecture.md) §7) once the cost is approved; until then the AI features use a clearly labelled demo provider

## Tech Stack

| Technology | Why |
|---|---|
| React + TypeScript + Vite | Component-based SPA; types catch errors early; fast builds |
| Tailwind CSS v4 | Design tokens and consistent styling in one place |
| React Three Fiber + Three.js | Declarative 3D for the hero particle wave |
| React Router + TanStack Query | Client routing; caching, loading and error states for server data |
| Zod | One schema for both runtime validation and TypeScript types, shared by the frontend and the API |
| Hono | Small TypeScript API, served from the same domain as the app (Vercel Functions in production) |
| Neon PostgreSQL + Drizzle ORM (PGlite for automated tests) | Relational data, type-safe queries, versioned migrations |
| Better Auth | Self-hosted email and password auth with secure cookie sessions |
| FullCalendar | Calendar views with drag-and-drop (MIT licence) |
| AI provider interface + Claude API *(optional)* | Server-only AI with Zod-validated structured output; a free demo provider by default |
| Vitest, React Testing Library, PGlite, Playwright | Unit, component, API and end-to-end tests |
| oxlint | Fast linting, including React hooks and accessibility rules |
| GitHub Actions | CI on every pull request and every push to `main` |
| Vercel *(M11)* | Hosting for the public release |

See [docs/architecture.md](docs/architecture.md) for the data model, security model and decision log, and [docs/design.md](docs/design.md) for the visual design.

## Roadmap

- [x] M1: Setup & foundations
- [x] M2: Design phase
- [x] M3: Design system & landing page, CI
- [x] M4: Domain model & logic (test-first)
- [x] M5: Functional dashboard (local data, async repository)
- [x] M6: Backend & database (Hono, PostgreSQL, Drizzle)
- [x] M7: Authentication & security (Better Auth, user isolation)
- [x] M8: Hardening (password reset, end-to-end tests, security review)
- [ ] M9: Intelligent AI workspace & smart calendar *(built, in review)*
- [ ] M10: Complete visual redesign (landing page and dashboard)
- [ ] M11: Final testing & public deployment (Vercel, production database, email provider)

Development and testing happen on localhost until M11. GitHub pull requests and CI are used throughout, and the code stays deployment-compatible (see [docs/architecture.md](docs/architecture.md) §9).

## Getting Started

**Prerequisites:** Node.js 26 (see `.nvmrc`) and npm.

> **Windows users:** run the project inside [WSL](https://learn.microsoft.com/windows/wsl/install). Windows Smart App Control can block Vite's native bundler.

```bash
git clone https://github.com/eliasbandak321-svg/ai-task-manager.git
cd ai-task-manager
npm install
npm run dev        # app + API: http://localhost:5173 (the dashboard is at /app)
```

Open the app at **http://localhost:5173** (`127.0.0.1:5173` works too). `npm run dev` applies any pending database migrations once (`npm run db:migrate`), then starts the website and the API together. The API itself never migrates: on startup it only checks that the schema is current.

**AI:** by default the AI features use a free, offline **demo provider** (labelled “Demo AI”): rule-based answers from your own data and template plans, not a language model. A real provider (the Claude API) can be enabled with `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY` in `.env`; this costs money per request, so set a spending limit on the key first (see `.env.example`). Automated and end-to-end tests always use the demo provider.

**Database:** the project uses [Neon](https://neon.tech) PostgreSQL (free plan). Copy `.env.example` to `.env` and set `DATABASE_PROVIDER=neon`, `DATABASE_URL` (your Neon **development** branch's connection string) and `NEON_BRANCH_ID` (that branch's ID); the API refuses to run against any other branch, and stops with a clear message if the configuration is missing or incomplete. To work offline instead, run `npm run dev:offline`, which uses an embedded PostgreSQL (PGlite) in `.data/pglite`. Automated tests always use PGlite and never touch Neon.

| Command | What it does |
|---|---|
| `npm run dev` | Start the website and the API (with auto-reload) |
| `npm run dev:offline` | The same, using the embedded offline database (PGlite) instead of Neon |
| `npm run dev:web` / `npm run dev:api` | Start only one of them |
| `npm run build` | Typecheck and build for production |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Lint the code with oxlint |
| `npm run typecheck` | Check types without building |
| `npm test` | Run tests in watch mode |
| `npm run test:run` | Run all tests once |
| `npm run test:coverage` | Run all tests with a coverage report (`coverage/index.html`) |
| `npm run db:generate` | Create a migration after changing `server/db/schema.ts` |
| `npm run db:migrate` | Apply pending migrations to the configured database (the only way migrations run; production needs `-- --confirm-production=<branch-id>`) |
| `npm run test:e2e` | End-to-end tests in a real browser (Playwright; isolated temporary database). First time: `npx playwright install --with-deps chromium` |
| `npm run test:neon` | Optional: run the repository tests against the Neon development branch (cleans up after itself) |

## What I'm Learning

UI/UX design fundamentals, React + TypeScript, testing, Git/GitHub workflows, and AI-assisted development with Claude Code.
