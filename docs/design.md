# Design Specification

Single source of truth for the visual design of AI Task Manager. Code (design tokens in `src/index.css`) must match this document; change this document first when the design changes.

**Status:** Approved (2026-11-10). The landing page and the dashboard are **temporary designs**: they stay accessible, responsive and usable until M10.

> **Decision (2026-11-10, M5 review):** M10 is a **complete visual redesign** of both the landing page and the dashboard, not a round of colour or styling tweaks. Layout, visual language, components and motion are all open for change; this document is rewritten for it at the start of M10. Until then, no time goes into visual polish: function, usability and accessibility come first.

Every decision is tagged with where it came from; both kinds are approved:
- **[Approved]**: agreed in an earlier design session
- **[Proposed]**: proposed in the 2026-11-10 draft and approved in that review

---

## 1. Principles

| Principle | Meaning in practice | Tag |
|---|---|---|
| Premium and calm | Dark, spacious, few colours, one accent. Glow is used sparingly to guide attention, never as decoration everywhere. | [Approved] |
| Own identity | Inspired by Vexel (landing atmosphere) and TECHit (feature card presentation). No copied layouts, copy, or assets. | [Approved] |
| Honest content | Copy describes only what the product does or will do; unbuilt features are labelled "Coming soon". | [Proposed] |
| Accessible by default | WCAG 2.2 AA contrast, full keyboard support, visible focus, reduced-motion support. | [Approved] |
| Lightweight | 3D is an enhancement. The page is complete and readable without it. | [Approved] |

## 2. Colour

### Core palette

| Token | Value | Use | Tag |
|---|---|---|---|
| `--color-night` | `#01061a` | Page background | [Approved] |
| `--color-ink` | `#ffffff` | Primary text, headings | [Approved] |
| `--color-glow` | `#7fd4ff` | Accent: primary buttons, links, focus ring, particles | [Approved] |
| `--color-glow-strong` | `#a8e3ff` | Accent hover/active state | [Proposed] |
| `--color-glow-deep` | `#2563eb` | Deep end of accent gradients and particle troughs (never for text) | [Proposed] |
| `--color-surface` | `#070d24` | Cards, header background when scrolled | [Proposed] |
| `--color-raised` | `#0d1530` | Hovered cards, popovers, inputs (dashboard) | [Proposed] |
| `--color-ink-muted` | `#a6b0c8` | Body text, descriptions | [Proposed] |
| `--color-ink-subtle` | `#7d88a6` | Captions, eyebrow labels, footer | [Proposed] |
| `--color-line` | `#1c2647` | Card borders, dividers (decorative) | [Proposed] |
| `--color-line-strong` | `#2c3a66` | Hovered card borders | [Proposed] |
| `--color-line-input` | `#5d6a94` | Form control borders (≥ 3:1 on every surface) | [Added in M5] |
| `--color-danger` | `#ff8a9b` | Destructive buttons and error text | [Added in M5] |

### Status and priority colours (used from M5, defined now for consistency)

| Token | Value | Meaning | Tag |
|---|---|---|---|
| `--color-status-todo` | `#a6b0c8` | To do | [Proposed] |
| `--color-status-progress` | `#7fd4ff` | In progress | [Proposed] |
| `--color-status-done` | `#6ee7b7` | Done | [Proposed] |
| `--color-priority-high` | `#ff8a9b` | High priority | [Proposed] |
| `--color-priority-medium` | `#ffc978` | Medium priority | [Proposed] |
| `--color-priority-low` | `#a6b0c8` | Low priority | [Proposed] |

The three statuses are To do, In progress and Done **[Approved]**. Colour is never the only signal: statuses and priorities always carry a text label as well **[Proposed]**.

### Measured contrast (WCAG 2.x)

| Text colour | on `night` | on `surface` | on `raised` |
|---|---|---|---|
| ink | 20.15 | 19.23 | 17.99 |
| ink-muted | 9.27 | 8.85 | 8.28 |
| ink-subtle | 5.70 | 5.44 | 5.09 |
| glow | 12.25 | 11.69 | 10.94 |
| status-done | 13.22 | 12.62 | 11.81 |
| priority-high | 8.98 | 8.57 | 8.02 |
| priority-medium | 13.32 | 12.71 | 11.89 |

Every text colour passes AA (4.5:1) on every surface. Button text: `night` on `glow` = 12.25. `line` (1.36) and `line-strong` (1.83) are decorative only. Form control borders use `line-input` (3.79 on `night`, 3.62 on `surface`, 3.39 on `raised`), which meets the 3:1 non-text contrast requirement. Error text and destructive buttons use `danger` (same value as `priority-high`; `night` on `danger` = 8.98).

## 3. Typography [Proposed]

| Role | Family | Weights | Notes |
|---|---|---|---|
| Display (h1–h3) | **Sora** (variable) | 500, 600 | Geometric and modern; tight tracking at large sizes |
| Body and UI | **Inter** (variable) | 400, 500 | Highly legible at small sizes; `tabular-nums` for statistics |

- Fonts are self-hosted via `@fontsource-variable/sora` and `@fontsource-variable/inter` (Latin subset only), with `font-display: swap`. Self-hosting avoids a third-party request and works offline.
- Fallback stack: `ui-sans-serif, system-ui, sans-serif`.

### Type scale

| Token | Size | Line height | Tracking | Use |
|---|---|---|---|---|
| `--text-display` | `clamp(2.5rem, 1.5rem + 4.5vw, 4.75rem)` | 1.05 | -0.03em | Hero headline |
| `--text-h2` | `clamp(2rem, 1.5rem + 2vw, 3rem)` | 1.15 | -0.02em | Section headings |
| `--text-h3` | `1.25rem` | 1.35 | -0.01em | Card titles |
| `--text-lead` | `clamp(1.0625rem, 1rem + 0.4vw, 1.25rem)` | 1.6 | 0 | Hero description |
| `--text-base` | `1rem` | 1.6 | 0 | Body |
| `--text-sm` | `0.875rem` | 1.5 | 0 | Captions, buttons |
| `--text-eyebrow` | `0.8125rem` | 1.4 | 0.12em, uppercase | Section labels |

The `clamp()` sizes scale smoothly between mobile and desktop without breakpoints, and they still respect the user's browser font-size setting because they are rem-based.

## 4. Layout and spacing [Proposed]

- **Spacing:** Tailwind's default 4 px scale (`--spacing: 0.25rem`). No arbitrary pixel values in components.
- **Content width:** `--container-content: 72rem` (1152 px), centered, with side padding of 1.25 rem (mobile), 2 rem (≥ 768 px) and 2.5 rem (≥ 1280 px).
- **Section rhythm:** 6 rem vertical padding on mobile, 8 rem on desktop.
- **Breakpoints:** Tailwind defaults: `sm` 640, `md` 768, `lg` 1024, `xl` 1280.
- **Radii:** `--radius-card: 1.25rem`, `--radius-control: 0.75rem`; buttons use a full pill radius.
- **Touch targets:** at least 44 × 44 px for every interactive element.

## 5. Effects [Proposed]

| Token | Value | Use |
|---|---|---|
| `--shadow-glow` | `0 0 2.5rem -0.5rem rgb(127 212 255 / 0.45)` | Primary button and hovered card |
| `--shadow-card` | `0 1px 0 0 rgb(255 255 255 / 0.04) inset` | Subtle top highlight on cards |
| Hero halo | Radial gradient of `glow-deep` at 25% opacity behind the headline | Depth behind the text |
| Card hover gradient | Faint radial highlight that follows the pointer inside the card (CSS custom property, no JS animation loop) | Feature cards, pointer devices only |

The glow is limited to the primary button, the hero halo, the particles and hovered cards **[Approved: "subtle glow effects"]**.

## 6. Motion [Proposed]

### Tokens

| Token | Value | Use |
|---|---|---|
| `--ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | Entrances, hover lifts |
| `--duration-fast` | `150ms` | Colour and border changes |
| `--duration-base` | `300ms` | Hover lifts, glow |
| `--duration-slow` | `700ms` | Entrance and scroll reveals |
| `--duration-fade` | `1200ms` | Particle wave fade-in |

### Choreography [Approved: subtle entrance, hover and scroll animations; details Proposed]

- **Entrance (hero):** the eyebrow, headline, description and buttons fade in and rise 16 px, staggered 80 ms apart. The wave fades in over 1.2 s after it loads.
- **Scroll:** feature cards reveal the same way when 15% of the card is visible. Each card animates only once, using one shared `IntersectionObserver`.
- **Hover:**
  - Cards lift 2 px and their border moves to `line-strong` with the glow.
  - The primary button brightens to `glow-strong` and gains its glow.
  - Links get an underline that slides in.
- **Implementation:** CSS transitions and keyframes only, with no animation library. This avoids roughly 40 kB of JavaScript, and everything listed above is achievable in CSS.
- **Reduced motion** (`prefers-reduced-motion: reduce`): no movement. Elements appear immediately at full opacity, and the wave shows a still frame.

## 7. Landing page

### Structure

| # | Section | Tag |
|---|---|---|
| 0 | Skip link ("Skip to content"), visible on focus | [Proposed] |
| 1 | Header: wordmark, "Features" anchor link, GitHub link, and an "Open app" link (added in M5). Transparent at first; turns `surface` with a blur effect once the page is scrolled. | [Proposed] |
| 2 | Hero: centered, with a large headline, description and CTA buttons, over the 3D particle wave | [Approved] |
| 3 | Features: six cards | [Approved] |
| 4 | Footer: wordmark, GitHub link, "Built with React, TypeScript and Three.js", © year | [Proposed] |

### Hero copy [Proposed]

- **Eyebrow:** `Plan · Focus · Finish`
- **Headline:** `Turn scattered tasks into steady progress.`
- **Description:** `AI Task Manager keeps your tasks, priorities and progress in one calm, focused workspace, so you always know what to do next.`
- **Primary CTA (M5):** `Open the app` → `/app`
- **Secondary CTA:** `Explore features` → `#features` (smooth scroll, or an instant jump when reduced motion is on)

### Feature cards [Approved: six cards in a TECHit-inspired presentation; content and style Proposed]

Each card has an icon in a rounded tile, an index (`01`–`06`) in `ink-subtle`, a title (`h3`), a single-sentence description in `ink-muted`, a `surface` background, a `line` border and the `card` radius. The grid is 1 column on mobile, 2 at `md` and 3 at `lg`.

| # | Title | Description | Icon (Lucide) |
|---|---|---|---|
| 01 | Capture in seconds | Add a task in one line and get back to work. Keyboard-first. | `Plus` |
| 02 | Clear statuses | Move work from To do to In progress to Done at a glance. | `Columns3` |
| 03 | Priorities that matter | Mark what is urgent and filter out the noise. | `Flag` |
| 04 | Progress you can see | Live statistics and a progress bar keep momentum visible. | `ChartNoAxesColumn` |
| 05 | Privacy-first, by design | Secure accounts and private task storage are coming with the full application. | `ShieldCheck` |
| 06 | Break it down with AI | Split big tasks into concrete next steps. *Coming soon.* | `Sparkles` |

Section heading: eyebrow `Features`, h2 `Everything you need to finish what you start.`, subheading `A focused set of tools that stays out of your way, from first idea to done.`

Card 05 was rewritten on 2026-11-10: the original "stays in your browser, no account" became false once accounts and a database were added to the scope.

Icons come from `lucide-react`. It is tree-shaken, so only the icons we import are bundled. The icons are decorative (`aria-hidden`), because the title carries the meaning.

## 8. 3D particle wave [Approved: R3F particle wave in the hero, lightweight, with mobile and reduced-motion fallbacks; details Proposed]

| Aspect | Specification |
|---|---|
| Placement | Full-width behind the hero, filling the lower ~65% of it. A CSS mask fades it into `night` at the bottom and at the edges so the text always stays readable. |
| Geometry | A flat grid of points: 140 × 70 (9,800 points) on desktop and 90 × 45 on tablet |
| Motion | Height is the sum of two sine waves travelling across the grid, computed in a vertex shader (GPU). It is slow and calm: one full cycle takes about 10 seconds, with small amplitude. |
| Colour | Crests use `glow`, troughs use `glow-deep`, and points fade with distance. Additive blending creates a soft glow without post-processing. |
| Camera | Perspective, 45° field of view, low and slightly elevated, looking across the wave toward the horizon |
| Interaction | Subtle camera parallax (about 2°) that follows the pointer, only on devices with a fine pointer (`pointer: fine`). No click or ripple effects. |
| Performance | Loaded lazily (`React.lazy`), so it is not in the main bundle. Pixel ratio is capped at 1.5. Rendering pauses while the hero is off screen; browsers already pause it in background tabs. |
| Budget | Main bundle ≤ 90 kB gzip. 3D chunk ≤ 250 kB gzip (revised from 200 kB after measuring 244 kB: React Three Fiber v9 registers all of Three.js, so it cannot be tree-shaken). The chunk loads only on desktop, after the text renders, and never on mobile. |
| Accessibility | The canvas is decorative: `aria-hidden="true"`, not focusable. |

### Fallbacks

| Condition | Behaviour |
|---|---|
| `prefers-reduced-motion: reduce` | The wave renders one still frame and does not animate |
| Mobile (`max-width: 767px` or `pointer: coarse`) | Three.js is never downloaded. A static CSS background is used instead: the hero halo plus a dotted gradient arc that suggests the wave. |
| WebGL unavailable or a 3D load error | The same static CSS background. An error boundary catches failures so the page never breaks. |

## 9. Accessibility checklist [Approved requirement; specifics Proposed]

- Landmarks: `header`, `main` (`id="content"`), `footer`, and `nav` labelled "Primary"
- One `h1` (the hero headline), then `h2` per section, then `h3` per card
- Visible focus on every interactive element: a 2 px `glow` outline with a 3 px offset, using `:focus-visible`
- A skip link, and anchor targets that leave room for the sticky header (`scroll-margin-top`)
- External links (GitHub) say they open in a new tab, or open in the same tab
- Information is never conveyed by colour alone, and the page is usable at 200% zoom and 320 px width

## 10. Dashboard [Built in M5; temporary visual design until M10]

The dashboard prioritises function, usability and accessibility. It reuses the landing page tokens. Its look is fully redesigned in M10 (see the decision at the top of this document); the functional behaviour below carries over.

### Routes

| URL | Page |
|---|---|
| `/app` | All tasks: every task across all projects |
| `/app/projects/:projectId` | One project (the Inbox included) |
| `/app/...?q=…&status=…&priority=…&due=…&sort=…&dir=…` | Search, filters and sorting live in the URL, so they survive a reload and can be bookmarked |
| Unknown project or path | A "not found" message with a link back to All tasks |

### Layout [Decided at the start of M5]

- **Header:** wordmark (links to `/`) and a note that data is saved in this browser (accounts come in M7).
- **Project navigation:** a sidebar (16 rem) on large screens (≥ 1024 px). On smaller screens it collapses into a full-width "Projects: <current>" button above the content that expands the same list, so the tasks stay at the top of the page. The list shows "All tasks", then the Inbox and the other projects with their completion percentage, plus a "New project" button.
- **Page:** the title (`h1`), the actions (New task; Rename and Delete for regular projects only), the statistics panel, the quick-add field, the search and filter toolbar, a live result count, and the task list.
- **Single column** inside the content area at every width; the task list never scrolls horizontally.

### Components

| Component | Behaviour |
|---|---|
| Statistics panel | Completion percentage with a progress bar, "x of y tasks done", counts for To do / In progress / Done / Overdue / Due today / Due in 3 days, and open tasks by priority. Overdue turns `danger` when above 0. |
| Quick add | One line: type a title, press Enter, keep typing. Adds to the current project, or to the Inbox from All tasks. |
| Toolbar | Search box; Status and Priority as checkbox chips; Deadline, Sort by and Order selects; "Clear filters". On small screens the filters fold behind a "Filters (n)" button. |
| Task row | Title (opens the details dialog), priority, deadline label ("Due tomorrow", "Overdue by 2 days"), subtask progress (2/5), the project name in All tasks, and a status select. Done tasks are struck through. |
| Task dialog | Title, description, project, status, priority, deadline. In edit mode it also holds the subtask checklist (check off, rename, move up/down, delete; saved immediately) and "Delete task". |
| Toasts | Short confirmations ("Task saved") and errors at the bottom of the screen, in a live region. They close after 4 s (errors after 8 s) and can be dismissed. |
| Empty, loading and error states | Every data view has them. Errors show a plain message and a "Try again" button, never technical details. |

### Dialogs and destructive actions [Approved 2026-11-10]

- All dialogs use the native `<dialog>` element: focus stays inside, the page behind is inert, Escape closes, and focus returns to the control that opened it.
- **Deleting a project:** a confirmation dialog warns that the project's tasks and subtasks will be permanently deleted, shows their counts (from `planProjectDeletion`), and names the project. The destructive button is clearly labelled ("Delete project and N tasks"), focus starts on Cancel, and Escape cancels. The Inbox has no delete action.
- **Deleting a task:** the same pattern, mentioning its subtasks. Deleting a single subtask needs no confirmation (it is small and quick to re-add).

### Still to come

- **Auth screens:** sign up and log in (M7), and password reset (M8), in the same visual language.
- **AI Task Breakdown** (M9) and the complete visual redesign of the landing page and dashboard (M10).

## 11. Resolved questions

1. **GitHub link:** the header and footer link to the public repository (accepted in the M3 review).

## 12. Performance targets [Proposed]

- Lighthouse (mobile): Performance ≥ 90, Accessibility 100, Best Practices ≥ 95
- No layout shift from fonts or the 3D canvas (CLS < 0.1): the canvas area has a fixed size before it loads
