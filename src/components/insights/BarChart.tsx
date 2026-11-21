import { useId } from 'react'

export interface BarSeries {
  label: string
  /** A class that colours the bar segment, e.g. "bar-done". */
  className: string
  values: number[]
}

interface BarChartProps {
  /** Short visible name for the chart's data table ("Completed tasks per day"). */
  title: string
  /** One entry per bar: the full label (table, tooltip) and the short axis label. */
  columns: { label: string; short: string; capacity?: number }[]
  series: BarSeries[]
  formatValue?: (value: number) => string
  /** Height in rem. */
  height?: number
}

/** Rounds the axis maximum up so the four gridlines land on whole numbers. */
function niceMax(value: number): number {
  const step = [1, 2, 3, 5, 10, 20, 25, 50, 100, 200, 500].find((candidate) => candidate * 4 >= value) ?? Math.ceil(value / 400) * 100
  return step * 4
}

/**
 * An accessible bar chart (M10): every bar is a focusable element with its full value as its
 * name and a tooltip on hover or focus; the same numbers are available as a table. Stacked when
 * there is more than one series. Plain HTML and CSS, no chart library.
 */
export function BarChart({ title, columns, series, formatValue = String, height = 11 }: BarChartProps) {
  const tableId = useId()
  const totals = columns.map((_, index) => series.reduce((sum, entry) => sum + entry.values[index], 0))
  const max = niceMax(Math.max(1, ...totals, ...columns.map((column) => column.capacity ?? 0)))
  const every = Math.ceil(columns.length / 10)
  const describe = (index: number) => `${columns[index].label}: ${series.map((entry) => `${entry.label} ${formatValue(entry.values[index])}`).join(', ')}`

  return (
    <div>
      <div className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-2">
        <div aria-hidden="true" className="relative font-mono text-[0.6875rem] text-ink-subtle" style={{ height: `${height}rem` }}>
          {[1, 0.75, 0.5, 0.25, 0].map((fraction) => (
            <span key={fraction} className="absolute right-0 translate-y-1/2" style={{ bottom: `${fraction * 100}%` }}>
              {formatValue(Math.round(max * fraction * 10) / 10)}
            </span>
          ))}
        </div>
        <ul aria-label={title} className="chart-plot flex items-stretch gap-[3px] border-b border-line-strong" style={{ height: `${height}rem` }}>
          {columns.map((column, index) => (
            <li key={column.label} className="flex min-w-0 flex-1">
              <button type="button" aria-label={describe(index)} className="chart-bar group relative flex w-full cursor-default flex-col justify-end rounded-t-md focus-visible:outline-offset-0">
                {series
                  .slice()
                  .reverse()
                  .map((entry) =>
                    entry.values[index] > 0 ? <i key={entry.label} aria-hidden="true" className={`mx-auto block w-[72%] max-w-8 first:rounded-t-[5px] ${entry.className}`} style={{ height: `${(entry.values[index] / max) * 100}%` }} /> : null,
                  )}
                {column.capacity !== undefined && column.capacity > 0 && (
                  <span aria-hidden="true" className="pointer-events-none absolute inset-x-[8%] border-t-[1.5px] border-dashed border-ink-subtle" style={{ bottom: `${(column.capacity / max) * 100}%` }} />
                )}
                <span role="tooltip" className="chart-tip pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1.5 text-xs whitespace-nowrap text-night opacity-0 shadow-soft transition-opacity duration-(--duration-fast) group-hover:opacity-100 group-focus-visible:opacity-100">
                  {describe(index)}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div aria-hidden="true" className="col-start-2 mt-1.5 flex gap-[3px]">
          {columns.map((column, index) => (
            <span key={column.label} className="min-w-0 flex-1 text-center text-[0.6875rem] whitespace-nowrap text-ink-subtle">
              {index % every === 0 ? column.short : ''}
            </span>
          ))}
        </div>
      </div>
      {(series.length > 1 || columns.some((column) => column.capacity)) && (
        <ul aria-hidden="true" className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
          {series.map((entry) => (
            <li key={entry.label} className="inline-flex items-center gap-2">
              <i className={`inline-block size-3 rounded-[3px] ${entry.className}`} />
              {entry.label}
            </li>
          ))}
          {columns.some((column) => column.capacity) && (
            <li className="inline-flex items-center gap-2">
              <i className="inline-block w-3 border-t-[1.5px] border-dashed border-ink-subtle" />
              Daily maximum
            </li>
          )}
        </ul>
      )}
      <details className="mt-3 text-sm text-ink-muted">
        <summary className="cursor-pointer text-ink-subtle hover:text-ink">Show as table</summary>
        <table id={tableId} className="mt-2 w-full text-left text-xs">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr>
              <th scope="col" className="py-1 font-medium">Period</th>
              {series.map((entry) => (
                <th key={entry.label} scope="col" className="py-1 font-medium">{entry.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {columns.map((column, index) => (
              <tr key={column.label} className="border-t border-line">
                <th scope="row" className="py-1 font-normal text-ink">{column.label}</th>
                {series.map((entry) => (
                  <td key={entry.label} className="py-1 tabular-nums">{formatValue(entry.values[index])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
