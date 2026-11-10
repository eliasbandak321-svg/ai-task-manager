import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HeroBackground } from './HeroBackground'

// jsdom can't run WebGL, so the real 3D scene is replaced with a marker element.
vi.mock('./ParticleWave', () => ({
  default: ({ animated }: { animated: boolean }) => <div data-testid="particle-wave" data-animated={animated} />,
}))

const webGL = vi.hoisted(() => ({ supported: true }))
vi.mock('../lib/supportsWebGL', () => ({ supportsWebGL: () => webGL.supported }))

/** Fakes window.matchMedia so only the given queries match. */
function mockMediaQueries(matching: string[]) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: matching.includes(query),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
}

const MOBILE = '(max-width: 767px), (pointer: coarse)'
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'

function waveMode(container: HTMLElement) {
  return container.querySelector('[data-wave-mode]')?.getAttribute('data-wave-mode')
}

describe('HeroBackground', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    webGL.supported = true
  })

  it('loads the animated 3D wave on desktop', async () => {
    mockMediaQueries([])
    const { container } = render(<HeroBackground />)

    expect(await screen.findByTestId('particle-wave')).toHaveAttribute('data-animated', 'true')
    expect(waveMode(container)).toBe('animated')
  })

  it('renders a still 3D frame for reduced motion', async () => {
    mockMediaQueries([REDUCED_MOTION])
    render(<HeroBackground />)

    expect(await screen.findByTestId('particle-wave')).toHaveAttribute('data-animated', 'false')
  })

  it('never loads the 3D wave on mobile', () => {
    mockMediaQueries([MOBILE])
    const { container } = render(<HeroBackground />)

    expect(waveMode(container)).toBe('fallback')
    expect(screen.queryByTestId('particle-wave')).not.toBeInTheDocument()
  })

  it('falls back to CSS without WebGL', () => {
    mockMediaQueries([])
    webGL.supported = false
    const { container } = render(<HeroBackground />)

    expect(waveMode(container)).toBe('fallback')
    expect(screen.queryByTestId('particle-wave')).not.toBeInTheDocument()
  })

  it('is hidden from assistive technology', () => {
    mockMediaQueries([])
    const { container } = render(<HeroBackground />)

    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })
})
