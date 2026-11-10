# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project
AI Task Manager: a React task manager built as a learning and portfolio project. See README.md for features and roadmap.

## Tech Stack
- React + TypeScript (strict mode), Vite
- Tailwind CSS v4; design tokens are the single source of truth for colors, spacing, and type
- Vitest + React Testing Library
- localStorage for persistence, accessed only through a dedicated storage module
- Deployed on Vercel

## Coding Conventions
- Functional components and hooks only; one component per file, PascalCase file names
- Keep business logic (task operations, stats) in pure, tested functions, separate from UI
- No `any` types; prefer explicit types for public functions and props
- Use design tokens, never hard-coded colors or spacing values
- Accessibility is required: semantic HTML, labels, keyboard support, visible focus states
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`)

## Workflow (learning-first)
The developer is a student learning professional software engineering. Act as a mentor:
- Work one milestone at a time; propose a plan and wait for approval before implementing
- Explain the purpose of important decisions and code; keep explanations short
- Let the developer write or decide important parts; do not generate large features unprompted
- Never claim something works without verifying it (run tests, lint, or the app and show the output)
- Do not start frontend implementation until the design (M2) is agreed

## Commands
Requires Node 26 (see `.nvmrc`). Develop inside WSL on Windows; Smart App Control blocks Vite's native bundler on native Windows.

- `npm run dev`: start the dev server at http://localhost:5173
- `npm run build`: typecheck, then build for production into `dist/`
- `npm run preview`: serve the production build locally
- `npm run lint`: lint with oxlint
- `npm run typecheck`: typecheck with `tsc -b`
- `npm test`: run Vitest in watch mode
- `npm run test:run`: run all tests once (use before committing)

Run `lint`, `typecheck`, `test:run`, and `build` before every commit.
