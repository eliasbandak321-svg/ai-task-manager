export interface WaveGridOptions {
  columns: number
  rows: number
  /** World-space size along the x axis. */
  width: number
  /** World-space size along the z axis (away from the camera). */
  depth: number
}

/**
 * Builds a flat, centered grid of points on the XZ plane as [x, y, z, x, y, z, ...].
 * The vertex shader animates the height (y), so every y starts at 0.
 */
export function createWaveGrid({ columns, rows, width, depth }: WaveGridOptions): Float32Array {
  if (columns < 2 || rows < 2) {
    throw new RangeError('A wave grid needs at least 2 columns and 2 rows')
  }

  const positions = new Float32Array(columns * rows * 3)
  const stepX = width / (columns - 1)
  const stepZ = depth / (rows - 1)

  let i = 0
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      positions[i++] = column * stepX - width / 2
      positions[i++] = 0
      positions[i++] = row * stepZ - depth / 2
    }
  }

  return positions
}
