import { Menu, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useScrolledPast } from '../../hooks/useScrolledPast'
import { ThemeToggle } from '../ThemeToggle'
import { Wordmark } from '../Wordmark'
import { PrimaryCta, SecondaryCta } from './Cta'

const LINKS = [
  { href: '#product', label: 'Product' },
  { href: '#features', label: 'Features' },
  { href: '#assistant', label: 'Assistant' },
  { href: '#scheduling', label: 'Scheduling' },
]

/** Minimal landing navigation (M10): links in a pill, theme toggle, Log in and Get started. */
export function LandingHeader() {
  const scrolled = useScrolledPast(10)
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    sheetRef.current?.querySelector('a')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <header className={`lp-header sticky top-0 z-50 px-5 transition-[background-color,box-shadow] duration-(--duration-base) md:px-8 ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="mx-auto grid h-[4.75rem] max-w-[75rem] grid-cols-[1fr_auto] items-center gap-3 min-[821px]:grid-cols-[auto_1fr_auto] min-[1101px]:grid-cols-[1fr_auto_1fr]">
        <div className="justify-self-start">
          <Wordmark />
        </div>
        <nav aria-label="Primary" className="hidden justify-self-center min-[821px]:block">
          <ul className="flex gap-0.5 rounded-full border border-line bg-surface/65 p-1 backdrop-blur-md">
            {LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="inline-flex min-h-9 items-center rounded-full px-3 text-sm text-ink-muted transition-colors duration-(--duration-fast) hover:bg-raised hover:text-ink min-[1101px]:px-3.5">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-2 justify-self-end">
          <ThemeToggle />
          <SecondaryCta className="hidden min-h-10 items-center rounded-lg px-2.5 text-[0.9375rem] whitespace-nowrap text-ink-muted hover:text-ink min-[821px]:inline-flex" />
          <PrimaryCta className="lp-btn lp-btn-primary lp-btn-sm hidden min-[821px]:inline-flex" />
          <button
            ref={buttonRef}
            type="button"
            aria-expanded={open}
            aria-controls="landing-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((value) => !value)}
            className="grid size-10 place-items-center rounded-full border border-line-strong bg-surface/70 text-ink-muted hover:border-ink hover:text-ink min-[821px]:hidden"
          >
            {open ? <X aria-hidden="true" className="size-4.5" /> : <Menu aria-hidden="true" className="size-4.5" />}
          </button>
        </div>
      </div>
      {open && (
        <div ref={sheetRef} id="landing-menu" className="absolute inset-x-4 top-[calc(100%+0.5rem)] flex flex-col rounded-[1.25rem] border border-line bg-surface p-2.5 shadow-card min-[821px]:hidden">
          <nav aria-label="Menu">
            <ul>
              {LINKS.map((link) => (
                <li key={link.href}>
                  <a href={link.href} onClick={() => setOpen(false)} className="block rounded-xl px-3.5 py-3 text-[1.0625rem] text-ink hover:bg-raised">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex gap-2 px-1 pt-2 pb-1">
            <SecondaryCta className="lp-btn flex-1" onClick={() => setOpen(false)} />
            <PrimaryCta className="lp-btn lp-btn-primary flex-1" onClick={() => setOpen(false)} />
          </div>
        </div>
      )}
    </header>
  )
}
