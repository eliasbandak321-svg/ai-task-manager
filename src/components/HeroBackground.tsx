import { lazy, Suspense, useMemo } from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { supportsWebGL } from '../lib/supportsWebGL'
import { getWaveMode } from '../lib/waveMode'
import { WaveFallback } from './WaveFallback'

// Loaded on demand: the Three.js chunk is never downloaded when the fallback is shown.
const ParticleWave = lazy(() => import('./ParticleWave'))

/** Decorative layer behind the hero: glow halo plus the wave. Hidden from assistive technology. */
export function HeroBackground() {
  const isMobile = useMediaQuery('(max-width: 767px), (pointer: coarse)')
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  // Only probe WebGL when it could be used; creating a context costs a little.
  const webGL = useMemo(() => !isMobile && supportsWebGL(), [isMobile])

  const mode = getWaveMode({ isMobile, prefersReducedMotion, supportsWebGL: webGL })

  return (
    <div aria-hidden="true" data-wave-mode={mode} className="pointer-events-none absolute inset-0 -z-10">
      <div className="hero-halo" />
      <div className="wave-area">
        {mode === 'fallback' ? (
          <WaveFallback />
        ) : (
          // If the 3D scene throws (e.g. the GPU context is lost), show the CSS wave instead of breaking the page.
          <ErrorBoundary fallback={<WaveFallback />}>
            <Suspense fallback={null}>
              <ParticleWave animated={mode === 'animated'} />
            </Suspense>
          </ErrorBoundary>
        )}
      </div>
    </div>
  )
}
