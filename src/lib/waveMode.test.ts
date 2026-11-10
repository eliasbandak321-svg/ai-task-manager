import { describe, expect, it } from 'vitest'
import { getWaveMode } from './waveMode'

const desktop = { isMobile: false, prefersReducedMotion: false, supportsWebGL: true }

describe('getWaveMode', () => {
  it('animates on a capable desktop', () => {
    expect(getWaveMode(desktop)).toBe('animated')
  })

  it('renders a still frame when the user prefers reduced motion', () => {
    expect(getWaveMode({ ...desktop, prefersReducedMotion: true })).toBe('static')
  })

  it('uses the CSS fallback on mobile, even with WebGL', () => {
    expect(getWaveMode({ ...desktop, isMobile: true })).toBe('fallback')
  })

  it('uses the CSS fallback without WebGL', () => {
    expect(getWaveMode({ ...desktop, supportsWebGL: false })).toBe('fallback')
  })

  it('prefers the fallback over a still frame on mobile with reduced motion', () => {
    expect(getWaveMode({ isMobile: true, prefersReducedMotion: true, supportsWebGL: true })).toBe('fallback')
  })
})
