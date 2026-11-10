import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, Color, type Group, type ShaderMaterial } from 'three'
import { createWaveGrid } from '../lib/waveGrid'
import { waveFragmentShader, waveVertexShader } from '../lib/waveShaders'

const GRID_WIDTH = 26
const GRID_DEPTH = 14
/** Time used for the still frame (reduced motion): a moment where the wave has a nice shape. */
const STILL_TIME = 2.4
/** Maximum parallax tilt in radians (about 2°, docs/design.md §8). */
const MAX_TILT = 0.035

interface WavePointsProps {
  columns: number
  rows: number
  animated: boolean
  /** Tilt the wave slightly toward the pointer. */
  parallax: boolean
  crestColor: string
  troughColor: string
}

/** The particle grid itself. Must be rendered inside an R3F <Canvas>. */
export function WavePoints({ columns, rows, animated, parallax, crestColor, troughColor }: WavePointsProps) {
  const group = useRef<Group>(null)
  const material = useRef<ShaderMaterial>(null)
  const pointer = useRef({ x: 0, y: 0 })

  const positions = useMemo(
    () => createWaveGrid({ columns, rows, width: GRID_WIDTH, depth: GRID_DEPTH }),
    [columns, rows],
  )

  const uniforms = useMemo(
    () => ({
      uTime: { value: STILL_TIME },
      uSize: { value: 38 },
      uPixelRatio: { value: 1 },
      uCrest: { value: new Color(crestColor) },
      uTrough: { value: new Color(troughColor) },
    }),
    [crestColor, troughColor],
  )

  useEffect(() => {
    if (!parallax) return
    const onPointerMove = (event: PointerEvent) => {
      pointer.current = {
        x: (event.clientX / window.innerWidth) * 2 - 1,
        y: (event.clientY / window.innerHeight) * 2 - 1,
      }
    }
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    return () => window.removeEventListener('pointermove', onPointerMove)
  }, [parallax])

  // Runs once per rendered frame. Only mutates refs, so React never re-renders.
  useFrame((state, delta) => {
    const shader = material.current
    if (!shader) return
    shader.uniforms.uPixelRatio.value = state.gl.getPixelRatio()
    // Clamp delta so returning to a paused tab doesn't make the wave jump forward.
    if (animated) shader.uniforms.uTime.value += Math.min(delta, 0.1)

    const tilt = group.current
    if (tilt && parallax) {
      // Ease 5% of the way toward the target each frame for a smooth follow.
      tilt.rotation.y += (pointer.current.x * MAX_TILT - tilt.rotation.y) * 0.05
      tilt.rotation.x += (pointer.current.y * MAX_TILT * 0.5 - tilt.rotation.x) * 0.05
    }
  })

  return (
    <group ref={group} position={[0, -1, -4]}>
      <points frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        </bufferGeometry>
        <shaderMaterial
          ref={material}
          vertexShader={waveVertexShader}
          fragmentShader={waveFragmentShader}
          uniforms={uniforms}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </points>
    </group>
  )
}
