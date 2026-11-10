import { describe, expect, it } from 'vitest'
import { createWaveGrid } from './waveGrid'

describe('createWaveGrid', () => {
  it('creates three coordinates per point', () => {
    const grid = createWaveGrid({ columns: 4, rows: 3, width: 6, depth: 2 })
    expect(grid).toHaveLength(4 * 3 * 3)
  })

  it('centers the grid on the origin and spans the full width and depth', () => {
    const grid = createWaveGrid({ columns: 3, rows: 2, width: 10, depth: 4 })
    // First point: left, front corner
    expect([grid[0], grid[1], grid[2]]).toEqual([-5, 0, -2])
    // Last point: right, back corner
    expect(Array.from(grid.slice(-3))).toEqual([5, 0, 2])
  })

  it('starts every point at height 0', () => {
    const grid = createWaveGrid({ columns: 5, rows: 5, width: 1, depth: 1 })
    const heights = grid.filter((_, index) => index % 3 === 1)
    expect(heights.every((y) => y === 0)).toBe(true)
  })

  it('rejects grids smaller than 2 × 2', () => {
    expect(() => createWaveGrid({ columns: 1, rows: 5, width: 1, depth: 1 })).toThrow(RangeError)
  })
})
