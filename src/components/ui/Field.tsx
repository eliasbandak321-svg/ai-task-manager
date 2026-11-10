import { useId, type ReactNode } from 'react'
import { labelClass } from './styles'

export interface FieldControlProps {
  id: string
  'aria-invalid': boolean
  'aria-describedby': string | undefined
}

interface FieldProps {
  label: string
  error?: string
  hint?: string
  className?: string
  /** Receives the props that connect the control to its label, hint and error. */
  children: (control: FieldControlProps) => ReactNode
}

/** A labelled form control with an optional hint and error message, wired up for screen readers. */
export function Field({ label, error, hint, className = '', children }: FieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined

  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}
      {hint && (
        <p id={hintId} className="text-sm text-ink-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
