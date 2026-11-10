# AI Task Manager

A modern, responsive task manager with a focus on clean UI/UX, built as a learning and portfolio project.

> **Status:** 🚧 In development. Milestone 1 of 6 (setup) is complete. The app runs, but it only shows a placeholder page so far.

## Features

### Implemented
_None yet. Development starts after the design phase._

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
| oxlint | Fast linting that catches common bugs and React hook mistakes |
| Vercel | Simple deployment from GitHub |

## Roadmap

- [x] M1: Setup & foundations
- [ ] M2: Design phase (references, wireframes, design system)
- [ ] M3: Task logic (test-first)
- [ ] M4: Dashboard UI
- [ ] M5: Landing page, polish & deploy
- [ ] M6: AI "break it down" feature (optional)

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
