import type { CSSProperties, PointerEvent } from 'react'
import type { Feature } from '../data/features'
import { useReveal } from '../hooks/useReveal'

interface FeatureCardProps {
  feature: Feature
  /** Zero-based position, shown as 01–06. */
  index: number
}

/** Moves the card's spotlight to the pointer by updating CSS variables (no React re-render). */
function followPointer(event: PointerEvent<HTMLElement>) {
  const card = event.currentTarget
  const rect = card.getBoundingClientRect()
  card.style.setProperty('--x', `${event.clientX - rect.left}px`)
  card.style.setProperty('--y', `${event.clientY - rect.top}px`)
}

export function FeatureCard({ feature, index }: FeatureCardProps) {
  const { ref, revealed } = useReveal<HTMLLIElement>()
  const Icon = feature.icon
  const number = String(index + 1).padStart(2, '0')

  return (
    // The <li> handles the scroll reveal and the <article> handles hover, so their
    // transitions (different durations and delays) never fight over the same element.
    <li
      ref={ref}
      data-revealed={revealed}
      // Stagger by column, so each row of three cards ripples in left to right.
      style={{ '--stagger': index % 3 } as CSSProperties}
      className="reveal stagger h-full"
    >
      <article
        onPointerMove={followPointer}
        className="card-spotlight relative flex h-full flex-col gap-6 rounded-card border border-line bg-surface p-7 shadow-card transition duration-(--duration-base) ease-out-expo hover:border-line-strong hover:shadow-glow motion-safe:hover:-translate-y-0.5"
      >
        <div className="flex items-start justify-between">
          <span className="grid size-11 place-items-center rounded-control border border-line bg-raised text-glow">
            <Icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
          </span>
          <div aria-hidden="true" className="flex items-center gap-3">
            {feature.comingSoon && (
              <span className="rounded-full border border-glow/30 px-2 py-0.5 text-eyebrow font-medium uppercase text-glow">
                Coming soon
              </span>
            )}
            <span className="font-display text-sm tabular-nums text-ink-subtle">{number}</span>
          </div>
        </div>
        <div>
          <h3 className="font-display text-h3 font-semibold text-ink">
            {feature.title}
            {feature.comingSoon && (
              // The space sits outside the span: whitespace at the edge of an element is trimmed
              // when screen readers compute a name, which would read as "AI(coming soon)".
              <>
                {' '}
                <span className="sr-only">(coming soon)</span>
              </>
            )}
          </h3>
          <p className="mt-2 text-ink-muted">{feature.description}</p>
        </div>
      </article>
    </li>
  )
}
