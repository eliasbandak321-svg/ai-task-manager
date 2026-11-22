import type { CSSProperties } from 'react'

type Side = 'left' | 'right'

interface Light {
  /** Position from the outer edge, as a percentage of the lighting area. */
  at: string
  colour: string
  thick?: boolean
  /** Trail duration and delay (s), breathing duration (s), and resting position under reduced motion. */
  duration: number
  delay: number
  breathe: number
  rest: string
}

interface Glow {
  colour: string
  width: string
  height: string
  offset: string
  top: string
  duration: number
  delay?: number
}

const LIGHTS: Record<Side, Light[]> = {
  left: [
    { at: '9%', colour: 'var(--color-line-cyan)', duration: 8.5, delay: -1, breathe: 6, rest: '40%' },
    { at: '17%', colour: 'var(--color-line-mint)', thick: true, duration: 11, delay: -5, breathe: 8, rest: '180%' },
    { at: '26%', colour: 'var(--color-line-sky)', duration: 9.5, delay: -3, breathe: 7, rest: '90%' },
    { at: '37%', colour: 'var(--color-line-lav)', duration: 13, delay: -8, breathe: 9, rest: '260%' },
    { at: '50%', colour: 'var(--color-line-cyan)', duration: 15, delay: -2, breathe: 10, rest: '150%' },
  ],
  right: [
    { at: '9%', colour: 'var(--color-line-lav)', duration: 9, delay: -4, breathe: 7, rest: '120%' },
    { at: '18%', colour: 'var(--color-line-sky)', thick: true, duration: 12, delay: -1, breathe: 9, rest: '30%' },
    { at: '28%', colour: 'var(--color-line-cyan)', duration: 10, delay: -7, breathe: 6, rest: '220%' },
    { at: '39%', colour: 'var(--color-line-mint)', duration: 14, delay: -3, breathe: 8, rest: '300%' },
    { at: '52%', colour: 'var(--color-line-lav)', duration: 16, delay: -10, breathe: 11, rest: '70%' },
  ],
}

const GLOWS: Record<Side, Glow[]> = {
  left: [
    { colour: 'var(--color-cyan)', width: '90%', height: '55%', offset: '-30%', top: '5%', duration: 17 },
    { colour: 'var(--color-mint)', width: '80%', height: '50%', offset: '-20%', top: '45%', duration: 21, delay: -6 },
    { colour: 'var(--color-lav)', width: '60%', height: '40%', offset: '10%', top: '70%', duration: 19, delay: -11 },
  ],
  right: [
    { colour: 'var(--color-sky)', width: '90%', height: '55%', offset: '-30%', top: '10%', duration: 18, delay: -4 },
    { colour: 'var(--color-lav)', width: '80%', height: '50%', offset: '-20%', top: '48%', duration: 22, delay: -9 },
    { colour: 'var(--color-mint)', width: '55%', height: '35%', offset: '5%', top: '0%', duration: 20, delay: -14 },
  ],
}

type Vars = CSSProperties & Record<`--${string}`, string>

/**
 * The hero's animated edge lighting (M10): thin luminous lines with travelling light trails and
 * soft drifting glows on one side. Purely decorative (aria-hidden, no pointer events); CSS only,
 * and static under prefers-reduced-motion (src/landing.css).
 */
export function EdgeLighting({ side, compact = false }: { side: Side; compact?: boolean }) {
  const lights = compact ? LIGHTS[side].filter((_, index) => index === 0 || index === 3) : LIGHTS[side]
  const glows = compact ? GLOWS[side].slice(0, 1) : GLOWS[side]
  const edge = side === 'left' ? 'left' : 'right'
  return (
    <div aria-hidden="true" className={`lp-edge ${side === 'left' ? 'lp-edge-l' : 'lp-edge-r'}`} style={compact ? { width: 'min(40%, 420px)' } : undefined}>
      <div className="lp-edge-inner">
        {glows.map((glow, index) => (
          <span key={`g${index}`} className="lp-glow" style={{ '--c': glow.colour, width: glow.width, height: glow.height, [edge]: glow.offset, top: glow.top, '--t': `${glow.duration}s`, '--dl': `${glow.delay ?? 0}s` } as Vars} />
        ))}
        {lights.map((light, index) => (
          <span key={`l${index}`} className={`lp-line ${light.thick ? 'is-thick' : ''}`} style={{ [edge]: light.at, '--c': light.colour, '--b': `${light.breathe}s` } as Vars}>
            <i style={{ '--d': `${light.duration}s`, '--delay': `${light.delay}s`, '--rest': light.rest } as Vars} />
          </span>
        ))}
      </div>
    </div>
  )
}
