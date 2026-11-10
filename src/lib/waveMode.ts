/**
 * How the hero background should render, from the most to the least expensive option.
 * - `animated`: live 3D particle wave
 * - `static`:   3D wave rendered once, without animation (reduced motion)
 * - `fallback`: CSS-only background; Three.js is never downloaded
 */
export type WaveMode = 'animated' | 'static' | 'fallback'

export interface WaveEnvironment {
  /** Small screen or touch-first device (spec: max-width 767px or pointer: coarse). */
  isMobile: boolean
  prefersReducedMotion: boolean
  supportsWebGL: boolean
}

/** Pure decision function, so the fallback rules from docs/design.md §8 are easy to test. */
export function getWaveMode({ isMobile, prefersReducedMotion, supportsWebGL }: WaveEnvironment): WaveMode {
  if (isMobile || !supportsWebGL) return 'fallback'
  if (prefersReducedMotion) return 'static'
  return 'animated'
}
