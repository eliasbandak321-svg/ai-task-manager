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
_To be added after scaffolding (dev, build, test, lint)._
