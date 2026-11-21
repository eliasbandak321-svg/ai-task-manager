import type { CSSProperties } from 'react'
import { MARQUEE_LABELS } from '../../data/landingPreview'

const DOTS = ['var(--color-line-cyan)', 'var(--color-line-mint)', 'var(--color-line-sky)', 'var(--color-line-lav)']

function Labels({ hidden = false }: { hidden?: boolean }) {
  return (
    <ul aria-hidden={hidden || undefined}>
      {MARQUEE_LABELS.map((label, index) => (
        <li key={label} style={{ '--d': DOTS[index % DOTS.length] } as CSSProperties}>
          {label}
        </li>
      ))}
    </ul>
  )
}

/**
 * The feature labels above the headline (M10): a slow, seamless right-to-left loop (the list is
 * rendered twice and shifted by half), paused on hover and keyboard focus. Under reduced motion
 * it becomes static, wrapping rows (src/landing.css).
 */
export function FeatureMarquee() {
  return (
    // tabIndex: keyboard users can focus the region to pause it.
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
    <section tabIndex={0} aria-label="What AI Task Manager does (hover or focus to pause)" className="lp-marquee lp-rise" style={{ '--i': 0 } as CSSProperties}>
      <div className="lp-track">
        <Labels />
        <Labels hidden />
      </div>
    </section>
  )
}
