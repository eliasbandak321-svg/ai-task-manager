import { ArrowRight } from 'lucide-react'
import { useEffect, useRef, type CSSProperties } from 'react'
import { EdgeLighting } from './EdgeLighting'
import { FeatureMarquee } from './FeatureMarquee'
import { CTA_COPY } from '../../config/landingCta'
import { PrimaryCta } from './Cta'

/** Very subtle pointer parallax for the edge lighting: fine pointers only, rAF-throttled, off under reduced motion. */
function usePointerParallax<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const element = ref.current
    if (!element || typeof window.matchMedia !== 'function') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !window.matchMedia('(pointer: fine)').matches) return
    let frame = 0
    const onMove = (event: PointerEvent) => {
      const x = (event.clientX / window.innerWidth) * 2 - 1
      const y = (event.clientY / window.innerHeight) * 2 - 1
      if (frame) return
      frame = requestAnimationFrame(() => {
        element.style.setProperty('--px', x.toFixed(3))
        element.style.setProperty('--py', y.toFixed(3))
        frame = 0
      })
    }
    const onLeave = () => {
      element.style.setProperty('--px', '0')
      element.style.setProperty('--py', '0')
    }
    element.addEventListener('pointermove', onMove)
    element.addEventListener('pointerleave', onLeave)
    return () => {
      cancelAnimationFrame(frame)
      element.removeEventListener('pointermove', onMove)
      element.removeEventListener('pointerleave', onLeave)
    }
  }, [])
  return ref
}

const rise = (index: number) => ({ '--i': index }) as CSSProperties

/** The centred hero (M10): marquee, "Less chaos. More focus.", the value proposition and the two calls to action. */
export function LandingHero() {
  const ref = usePointerParallax<HTMLElement>()
  return (
    <section ref={ref} aria-labelledby="hero-title" className="lp-hero -mt-[4.75rem] px-5 pt-[4.75rem] md:px-8">
      <EdgeLighting side="left" />
      <EdgeLighting side="right" />
      <div className="relative z-2 mx-auto flex max-w-[75rem] flex-col items-center gap-[22px] pt-14 pb-[72px] text-center min-[521px]:gap-7 min-[521px]:pt-[clamp(68px,11vh,128px)] min-[521px]:pb-[clamp(80px,12vh,136px)]">
        <FeatureMarquee />
        <h1 id="hero-title" className="lp-headline lp-rise my-1 text-ink" style={rise(1)}>
          Less chaos.
          <span className="block">
            More <span className="lp-serif text-gradient">focus.</span>
          </span>
        </h1>
        <p className="lp-rise m-0 max-w-[56ch] text-[clamp(1.02rem,1.6vw,1.18rem)] text-ink-muted" style={rise(2)}>
          Keep projects, tasks and your calendar in one place. AI Task Manager finds time for the work, and its assistant suggests a plan that only changes your schedule once you approve it.
        </p>
        <div className="lp-rise flex w-full flex-col justify-center gap-3 min-[521px]:w-auto min-[521px]:flex-row" style={rise(3)}>
          <PrimaryCta className="lp-btn lp-btn-primary">
            <span className="lp-arrow">
              <ArrowRight aria-hidden="true" className="size-3.5" />
            </span>
          </PrimaryCta>
          <a href="#how" className="lp-btn">
            See how it works
          </a>
        </div>
        <p className="lp-rise -mt-1.5 text-[0.8125rem] text-ink-subtle" style={rise(4)}>
          {CTA_COPY.heroNote}
        </p>
      </div>
    </section>
  )
}
