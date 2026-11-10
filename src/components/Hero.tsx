import { ArrowDown, ArrowRight } from 'lucide-react'
import type { CSSProperties } from 'react'
import { ButtonLink } from './ButtonLink'
import { Container } from './Container'
import { Eyebrow } from './Eyebrow'
import { HeroBackground } from './HeroBackground'

/** Entrance animation with a stagger step (docs/design.md §6). */
function enter(step: number) {
  return { className: 'animate-enter stagger', style: { '--stagger': step } as CSSProperties }
}

export function Hero() {
  return (
    <section
      id="top"
      aria-labelledby="hero-title"
      className="relative isolate flex min-h-svh items-center overflow-hidden pt-16"
    >
      <HeroBackground />

      <Container className="pb-40 pt-16 text-center md:pb-48">
        <div {...enter(0)}>
          <Eyebrow>Plan · Focus · Finish</Eyebrow>
        </div>
        <h1
          id="hero-title"
          style={enter(1).style}
          className={`${enter(1).className} mx-auto mt-6 max-w-4xl font-display text-display font-semibold text-balance text-ink`}
        >
          Turn scattered tasks into steady progress.
        </h1>
        <p
          style={enter(2).style}
          className={`${enter(2).className} mx-auto mt-6 max-w-2xl text-lead text-pretty text-ink-muted`}
        >
          AI Task Manager keeps your tasks, priorities and progress in one calm, focused workspace, so you always
          know what to do next.
        </p>
        <div style={enter(3).style} className={`${enter(3).className} mt-10 flex flex-wrap justify-center gap-3`}>
          <ButtonLink to="/app">
            Open the app
            <ArrowRight aria-hidden="true" className="size-4" />
          </ButtonLink>
          <ButtonLink href="#features" variant="secondary">
            Explore features
            <ArrowDown aria-hidden="true" className="size-4" />
          </ButtonLink>
        </div>
      </Container>
    </section>
  )
}
