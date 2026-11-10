import { features } from '../data/features'
import { Container } from './Container'
import { Eyebrow } from './Eyebrow'
import { FeatureCard } from './FeatureCard'

export function Features() {
  return (
    <section id="features" aria-labelledby="features-title" className="scroll-mt-16 py-24 md:py-32">
      <Container>
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>Features</Eyebrow>
          <h2 id="features-title" className="mt-5 font-display text-h2 font-semibold text-balance text-ink">
            Everything you need to finish what you start.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lead text-balance text-ink-muted">
            A focused set of tools that stays out of your way, from first idea to done.
          </p>
        </div>

        <ul className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => (
            <FeatureCard key={feature.title} feature={feature} index={index} />
          ))}
        </ul>
      </Container>
    </section>
  )
}
