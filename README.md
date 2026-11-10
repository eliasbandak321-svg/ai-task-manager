# AI Task Manager

A modern, responsive task manager with a focus on clean UI/UX, built as a learning and portfolio project.

> **Status:** 🚧 In development. Milestones 1–3 of 7 are complete: setup, design and the landing page. Next up: task logic (M4).

## Features

### Implemented
- **Landing page** with a design-token system (Tailwind CSS v4), self-hosted Sora and Inter fonts, and a responsive layout from 320 px upward
- **3D particle wave** built with React Three Fiber and a custom GPU shader, lazy-loaded so it never blocks the page. Phones and browsers without WebGL get a CSS fallback, and reduced-motion users get a still frame.
- **Subtle motion**: staggered hero entrance, scroll reveals and card hover effects, all CSS-only and disabled under `prefers-reduced-motion`
- **Accessibility**: skip link, landmarks, full keyboard support, visible focus and WCAG AA contrast (Lighthouse Accessibility 100)

### Planned (MVP)
- Create, edit, delete, and complete tasks
- Task priorities and filtering
- Progress statistics
- Persistence across page refreshes (localStorage)
- Responsive landing page and dashboard with subtle, purposeful animations

### Planned (optional, post-MVP)
- **"Break it down"**: AI-suggested subtasks for large tasks, powered by the Claude API

## Tech Stack

| Technology | Why |
|---|---|
| React + TypeScript | Component-based UI; types catch errors early |
| Vite | Fast dev server and build with minimal config |
| Tailwind CSS | Design tokens and consistent styling in one place |
| Vitest + React Testing Library | Tests for logic and user interactions |
| React Three Fiber + Three.js | Declarative 3D for the hero particle wave |
| oxlint | Fast linting that catches common bugs, React hook mistakes and accessibility issues |
| Vercel | Simple deployment from GitHub |

## Roadmap

- [x] M1: Setup & foundations
- [x] M2: Design phase (see [docs/design.md](docs/design.md))
- [x] M3: Design system & landing page (3D particle wave)
- [ ] M4: Task logic (test-first)
- [ ] M5: Dashboard UI
- [ ] M6: Polish & deploy
- [ ] M7: AI "break it down" feature (optional)

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
