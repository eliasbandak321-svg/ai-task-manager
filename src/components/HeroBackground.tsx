import { WaveFallback } from './WaveFallback'

/** Decorative layer behind the hero: glow halo plus the wave. Hidden from assistive technology. */
export function HeroBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
      <div className="hero-halo" />
      <div className="wave-area">
        <WaveFallback />
      </div>
    </div>
  )
}
