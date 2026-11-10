/*
  Shared class lists for form controls, so every input, select and textarea looks and
  behaves the same. Borders use line-input, which meets the 3:1 contrast required for
  form control boundaries (docs/design.md §2).
*/

export const controlClass =
  'block w-full min-h-11 rounded-control border border-line-input bg-raised px-3 text-sm text-ink transition-colors duration-(--duration-fast) placeholder:text-ink-subtle hover:border-ink-subtle aria-invalid:border-danger disabled:opacity-60'

export const labelClass = 'block text-sm font-medium text-ink'

export const checkboxClass = 'size-4.5 shrink-0 accent-glow'
