# Design Specification

Single source of truth for the visual design of AI Task Manager. Code (design tokens in `src/index.css`) must match this document; change this document first when the design changes.

**Status:** Approved (2026-11-10). The landing page is a **temporary design**: it stays accessible, responsive and usable, and its visual design is revisited in M10, after the app and the AI feature work.

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

Every text colour passes AA (4.5:1) on every surface. Button text: `night` on `glow` = 12.25. `line` (1.36) and `line-strong` (1.83) are decorative only. Form inputs in the dashboard will need a border of at least 3:1; we will add an `--color-line-input` token in M5.

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
| 1 | Header: wordmark, "Features" anchor link, GitHub link. Transparent at first; turns `surface` with a blur effect once the page is scrolled. | [Proposed] |
| 2 | Hero: centered, with a large headline, description and CTA buttons, over the 3D particle wave | [Approved] |
| 3 | Features: six cards | [Approved] |
| 4 | Footer: wordmark, GitHub link, "Built with React, TypeScript and Three.js", © year | [Proposed] |

### Hero copy [Proposed]

- **Eyebrow:** `Plan · Focus · Finish`
- **Headline:** `Turn scattered tasks into steady progress.`
- **Description:** `AI Task Manager keeps your tasks, priorities and progress in one calm, focused workspace, so you always know what to do next.`
- **Primary CTA:** `Explore features` → `#features` (smooth scroll, or an instant jump when reduced motion is on)
- No "Open the app" button and no placeholder app page until the dashboard works (see §10).

### Feature cards [Approved: six cards in a TECHit-inspired presentation; content and style Proposed]

Each card has an icon in a rounded tile, an index (`01`–`06`) in `ink-subtle`, a title (`h3`), a single-sentence description in `ink-muted`, a `surface` background, a `line` border and the `card` radius. The grid is 1 column on mobile, 2 at `md` and 3 at `lg`.

| # | Title | Description | Icon (Lucide) |
|---|---|---|---|
| 01 | Capture in seconds | Add a task in one line and get back to work. Keyboard-first. | `Plus` |
| 02 | Clear statuses | Move work from To do to In progress to Done at a glance. | `Columns3` |
| 03 | Priorities that matter | Mark what is urgent and filter out the noise. | `Flag` |
| 04 | Progress you can see | Live statistics and a progress bar keep momentum visible. | `ChartNoAxesColumn` |
| 05 | Private by design | Your projects and tasks belong to your account and are never visible to anyone else. | `ShieldCheck` |
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

## 10. Future dashboard [Approved scope, revised 2026-11-10]

- **Projects:** every task belongs to a project, and each user has a default "Inbox" project.
- **Tasks:** quick creation, editing and deleting (with confirmation); status (To do, In progress, Done), priority and an optional deadline.
- **Subtasks:** a one-level checklist inside a task.
- **Finding work:** search, sorting, and filters by status and priority.
- **Progress:** statistics with a progress indicator, per project and overall.
- **States:** empty, loading and error states for every data view, since data is loaded asynchronously.
- **Layout:** "no sidebar, single column with a header" was approved for a single task list. Now that there are projects, the project navigation (header switcher, tabs or a sidebar) is **re-decided at the start of M5**.
- **Auth screens:** sign up and log in (M7), and password reset (M8, required before the public release), all in the same visual language.
- **Entry point:** when the app works, add an "Open the app" or "Get started" CTA to the header and hero, introducing React Router at the same time. No placeholder page or route before then.
- **Visual language:** reuses the same tokens, `surface` / `raised` cards, button styles, focus ring and motion tokens.
- **Spec timing:** the detailed dashboard layout is specified at the start of M5.

## 11. Resolved questions

1. **GitHub link:** the header and footer link to the public repository (accepted in the M3 review).

## 12. Performance targets [Proposed]

- Lighthouse (mobile): Performance ≥ 90, Accessibility 100, Best Practices ≥ 95
- No layout shift from fonts or the 3D canvas (CLS < 0.1): the canvas area has a fixed size before it loads
