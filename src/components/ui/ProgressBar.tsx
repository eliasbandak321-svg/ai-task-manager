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
      className={`progress-identity block h-1.5 w-full appearance-none overflow-hidden rounded-full bg-raised ${className}`}
    />
  )
}
