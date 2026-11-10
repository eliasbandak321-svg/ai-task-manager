interface ProgressBarProps {
  /** 0–100 */
  value: number
  label: string
  /** Spoken instead of the bare percentage, e.g. "3 of 4 tasks done". */
  valueText?: string
  className?: string
}

/**
 * The native <progress> element: screen readers already know it as a progress bar.
 * Browsers style its parts differently, hence the WebKit and Firefox pseudo-elements.
 */
export function ProgressBar({ value, label, valueText, className = '' }: ProgressBarProps) {
  return (
    <progress
      value={value}
      max={100}
      aria-label={label}
      aria-valuetext={valueText}
      className={`block h-2 w-full appearance-none overflow-hidden rounded-full bg-line [&::-moz-progress-bar]:rounded-full [&::-moz-progress-bar]:bg-status-done [&::-webkit-progress-bar]:bg-line [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-status-done ${className}`}
    />
  )
}
