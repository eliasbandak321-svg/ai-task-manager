import { Canvas } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { WavePoints } from './WavePoints'

interface ParticleWaveProps {
  /** false renders a single still frame (reduced motion). */
  animated: boolean
}

/** Reads a colour token from the CSS, so the wave uses the same palette as the rest of the site. */
function readToken(name: string, fallback: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
}

/**
 * The 3D particle wave (docs/design.md §8). Default export so React.lazy can load it
 * as a separate chunk: Three.js is only downloaded when this component is needed.
 */
export default function ParticleWave({ animated }: ParticleWaveProps) {
  const wrapper = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(true)
  const [ready, setReady] = useState(false)
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const finePointer = useMediaQuery('(pointer: fine)')
  const [colors] = useState(() => ({
    crest: readToken('--color-glow', '#7fd4ff'),
    trough: readToken('--color-glow-deep', '#2563eb'),
  }))

  // Pause rendering while the hero is scrolled out of view.
  useEffect(() => {
    const element = wrapper.current
    if (!element || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const grid = isDesktop ? { columns: 140, rows: 70 } : { columns: 90, rows: 45 }

  return (
    <div
      ref={wrapper}
      className={`absolute inset-0 transition-opacity duration-(--duration-fade) ease-out ${ready ? 'opacity-100' : 'opacity-0'}`}
    >
      <Canvas
        // 'always' renders every frame; 'demand' only renders when something changes (one still frame).
        frameloop={animated && inView ? 'always' : 'demand'}
        dpr={[1, 1.5]}
        camera={{ position: [0, 1.2, 6], fov: 45 }}
        gl={{ antialias: false, alpha: true, powerPreference: 'low-power' }}
        onCreated={({ camera }) => {
          camera.lookAt(0, -0.6, -4)
          setReady(true)
        }}
      >
        <WavePoints
          columns={grid.columns}
          rows={grid.rows}
          animated={animated}
          parallax={animated && finePointer}
          crestColor={colors.crest}
          troughColor={colors.trough}
        />
      </Canvas>
    </div>
  )
}
