# AI Task Manager

A full-stack productivity app for students, developers and professionals: organize projects, manage tasks and subtasks, track progress, and (soon) use AI to turn a complex goal into a concrete plan. Built as a learning and portfolio project.

> **Status:** 🚧 In development. M1–M5 are complete: the dashboard works on local data stored in your browser. Next up: the backend and database (M6). The visual design is temporary and will be revisited in M10.

## Features

### Implemented
- **Landing page** with a design-token system (Tailwind CSS v4), self-hosted Sora and Inter fonts, and a responsive layout from 320 px upward
- **3D particle wave** built with React Three Fiber and a custom GPU shader, lazy-loaded so it never blocks the page. Phones and browsers without WebGL get a CSS fallback, and reduced-motion users get a still frame.
- **Subtle motion**: staggered hero entrance, scroll reveals and card hover effects, all CSS-only and disabled under `prefers-reduced-motion`
- **Accessibility**: skip link, landmarks, full keyboard support, visible focus and WCAG AA contrast (Lighthouse Accessibility 100)
- **CI**: lint, typecheck, tests and build run on every pull request (GitHub Actions)
- **Domain logic**: Zod schemas and pure, fully tested functions for projects, tasks, subtasks, deadlines, statistics, search, filtering and sorting
- **Dashboard** (`/app`): projects with a default Inbox; tasks with statuses, priorities and deadlines; subtask checklists; progress statistics; search, filters and sorting kept in the URL; accessible dialogs with confirmation before deleting. Data is stored in your browser until the backend arrives in M6.

### Planned (MVP)
- Accounts with email and password, with each user's data isolated and secure
- PostgreSQL persistence through an API, replacing browser storage
- End-to-end tests and a security review
- Public deployment once the app is complete, redesigned and fully tested

### Planned (AI)
- **Task Breakdown**: describe a complex goal, get a structured task plan from the Claude API, review and edit it, and save only the tasks you approve
- Later: smart planning and AI progress insights

## Tech Stack

| Technology | Why |
|---|---|
| React + TypeScript + Vite | Component-based SPA; types catch errors early; fast builds |
| Tailwind CSS v4 | Design tokens and consistent styling in one place |
| React Three Fiber + Three.js | Declarative 3D for the hero particle wave |
| React Router + TanStack Query | Client routing; caching, loading and error states for server data |
| Zod | One schema for both runtime validation and TypeScript types, shared by the frontend and the API |
| Hono *(M6)* | Small TypeScript API, served from the same domain as the app (Vercel Functions in production) |
| PostgreSQL + Drizzle ORM *(M6)* (Neon in production) | Relational data, type-safe queries, versioned migrations |
| Better Auth *(M7)* | Self-hosted email and password auth with secure cookie sessions |
| Claude API *(M9)* | AI Task Breakdown, called only from the server |
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
- [ ] M6: Backend & database (Hono, Neon, Drizzle)
- [ ] M7: Authentication & security (Better Auth, user isolation)
- [ ] M8: Hardening (password reset, end-to-end tests, security review)
- [ ] M9: AI Task Breakdown
- [ ] M10: Visual design revisit
- [ ] M11: Final testing & public deployment (Vercel, production database, email provider)

Development and testing happen on localhost until M11. GitHub pull requests and CI are used throughout, and the code stays deployment-compatible (see [docs/architecture.md](docs/architecture.md) §9).

## Getting Started

**Prerequisites:** Node.js 26 (see `.nvmrc`) and npm.

> **Windows users:** run the project inside [WSL](https://learn.microsoft.com/windows/wsl/install). Windows Smart App Control can block Vite's native bundler.

```bash
git clone https://github.com/eliasbandak321-svg/ai-task-manager.git
cd ai-task-manager
npm install
npm run dev        # http://localhost:5173 (the app is at /app)
```

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Typecheck and build for production |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Lint the code with oxlint |
| `npm run typecheck` | Check types without building |
| `npm test` | Run tests in watch mode |
| `npm run test:run` | Run all tests once |
| `npm run test:coverage` | Run all tests with a coverage report (`coverage/index.html`) |

## What I'm Learning

UI/UX design fundamentals, React + TypeScript, testing, Git/GitHub workflows, and AI-assisted development with Claude Code.
