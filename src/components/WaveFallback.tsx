/**
 * CSS-only stand-in for the 3D wave: a band of dots that suggests the wave's shape.
 * Used on mobile, without WebGL, and if the 3D scene fails (docs/design.md §8).
 */
export function WaveFallback() {
  return <div className="wave-fallback" />
}
