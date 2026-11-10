import { ArrowDown } from 'lucide-react'
import { ButtonLink } from './ButtonLink'
import { Container } from './Container'
import { Eyebrow } from './Eyebrow'
import { HeroBackground } from './HeroBackground'

export function Hero() {
  return (
    <section
      id="top"
      aria-labelledby="hero-title"
      className="relative isolate flex min-h-svh items-center overflow-hidden pt-16"
    >
      <HeroBackground />

      <Container className="pb-40 pt-16 text-center md:pb-48">
        <Eyebrow>Plan · Focus · Finish</Eyebrow>
        <h1
          id="hero-title"
          className="mx-auto mt-6 max-w-4xl font-display text-display font-semibold text-balance text-ink"
        >
          Turn scattered tasks into steady progress.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lead text-pretty text-ink-muted">
          AI Task Manager keeps your tasks, priorities and progress in one calm, focused workspace, so you always
          know what to do next.
        </p>
        <div className="mt-10 flex justify-center">
          <ButtonLink href="#features">
            Explore features
            <ArrowDown aria-hidden="true" className="size-4" />
          </ButtonLink>
        </div>
      </Container>
    </section>
  )
}
