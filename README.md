# AI Task Manager

A full-stack productivity app for students, developers and professionals: organize projects, manage tasks and subtasks, track progress, and (soon) use AI to turn a complex goal into a concrete plan. Built as a learning and portfolio project.

> **Status:** 🚧 In development. M1–M3 (setup, design, landing page) are complete. Next up: domain logic (M4). The landing page design is temporary and will be revisited once the app works.

## Features

### Implemented
- **Landing page** with a design-token system (Tailwind CSS v4), self-hosted Sora and Inter fonts, and a responsive layout from 320 px upward
- **3D particle wave** built with React Three Fiber and a custom GPU shader, lazy-loaded so it never blocks the page. Phones and browsers without WebGL get a CSS fallback, and reduced-motion users get a still frame.
- **Subtle motion**: staggered hero entrance, scroll reveals and card hover effects, all CSS-only and disabled under `prefers-reduced-motion`
- **Accessibility**: skip link, landmarks, full keyboard support, visible focus and WCAG AA contrast (Lighthouse Accessibility 100)
- **CI**: lint, typecheck, tests and build run on every pull request (GitHub Actions)

### Planned (MVP)
- Accounts with email and password, with each user's data isolated and secure
- Projects (with a default Inbox) and tasks with full create, read, update and delete
- Subtask checklists, deadlines, statuses (To do, In progress, Done) and priorities
- Dashboard with progress tracking
- Search, sorting and filtering
- PostgreSQL persistence
- Responsive, accessible interface, automated tests and production deployment

### Planned (AI)
- **Task Breakdown**: describe a complex goal, get a structured task plan from the Claude API, review and edit it, and save only the tasks you approve
- Later: smart planning and AI progress insights

## Tech Stack

| Technology | Why |
|---|---|
| React + TypeScript + Vite | Component-based SPA; types catch errors early; fast builds |
| Tailwind CSS v4 | Design tokens and consistent styling in one place |
| React Three Fiber + Three.js | Declarative 3D for the hero particle wave |
| React Router + TanStack Query *(M5)* | Client routing; caching, loading and error states for server data |
| Zod *(M4)* | One schema for both runtime validation and TypeScript types, shared by the frontend and the API |
| Hono on Vercel Functions *(M6)* | Small TypeScript API served from the same domain as the app |
| Neon PostgreSQL + Drizzle ORM *(M6)* | Relational data, type-safe queries, versioned migrations |
| Better Auth *(M7)* | Self-hosted email and password auth with secure cookie sessions |
| Claude API *(M9)* | AI Task Breakdown, called only from the server |
| Vitest, React Testing Library, PGlite, Playwright | Unit, component, API and end-to-end tests |
| oxlint | Fast linting, including React hooks and accessibility rules |
| Vercel + GitHub Actions | Preview deployments per pull request; CI on every change |

See [docs/architecture.md](docs/architecture.md) for the data model, security model and decision log, and [docs/design.md](docs/design.md) for the visual design.

## Roadmap

- [x] M1: Setup & foundations
- [x] M2: Design phase
- [x] M3: Design system & landing page, CI
- [ ] M4: Domain model & logic (test-first)
- [ ] M5: Functional dashboard (local data, async repository)
- [ ] M6: Backend & database (Hono, Neon, Drizzle)
- [ ] M7: Authentication & security (Better Auth, user isolation)
- [ ] M8: Release v1.0 (end-to-end tests, password reset, production deploy)
- [ ] M9: AI Task Breakdown
- [ ] M10: Visual design revisit

## Getting Started

**Prerequisites:** Node.js 26 (see `.nvmrc`) and npm.

> **Windows users:** run the project inside [WSL](https://learn.microsoft.com/windows/wsl/install). Windows Smart App Control can block Vite's native bundler.

```bash
git clone https://github.com/eliasbandak321-svg/ai-task-manager.git
cd ai-task-manager
npm install
npm run dev        # http://localhost:5173
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

## What I'm Learning

UI/UX design fundamentals, React + TypeScript, testing, Git/GitHub workflows, and AI-assisted development with Claude Code.
