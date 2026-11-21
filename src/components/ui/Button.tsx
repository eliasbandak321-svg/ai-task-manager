import type { ButtonHTMLAttributes, Ref } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  /** A square button for a single icon. It must have an `aria-label`. */
  iconOnly?: boolean
  ref?: Ref<HTMLButtonElement>
}

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-btn text-btn-ink hover:bg-btn-hover',
  secondary: 'border border-line-strong bg-surface text-ink hover:border-ink',
  ghost: 'text-ink-muted hover:bg-raised hover:text-ink',
  danger: 'bg-danger text-night hover:opacity-90',
}

/** The dashboard's button. Every size keeps the 44 px minimum touch target (docs/design.md §4). */
export function Button({ variant = 'secondary', iconOnly = false, className = '', type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full text-sm font-medium transition duration-(--duration-fast) motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${
        iconOnly ? 'size-11' : 'px-5'
      } ${variants[variant]} ${className}`}
      {...props}
    />
  )
}
