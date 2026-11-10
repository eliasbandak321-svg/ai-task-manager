import type { Feature } from '../data/features'

interface FeatureCardProps {
  feature: Feature
  /** Zero-based position, shown as 01–06. */
  index: number
}

export function FeatureCard({ feature, index }: FeatureCardProps) {
  const Icon = feature.icon
  const number = String(index + 1).padStart(2, '0')

  return (
    <li className="h-full">
      <article className="relative flex h-full flex-col gap-6 rounded-card border border-line bg-surface p-7 shadow-card">
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
