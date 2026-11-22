import { FlaskConical, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { resetDemo } from '../../demo/demoStorage'

/**
 * Shown on every app screen of the portfolio demo (M11): what the visitor is looking at, what
 * is simulated, and a way to start over.
 */
export function DemoBanner() {
  const [resetting, setResetting] = useState(false)
  return (
    <section aria-label="Demo notice" className="border-b border-line bg-raised px-5 py-2.5 text-sm md:px-8">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="flex min-w-0 flex-1 items-start gap-2 text-ink-muted">
          <FlaskConical aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-glow" />
          <span>
            <strong className="font-semibold text-ink">Demo</strong> with fictional sample data. Your changes stay in this browser tab
            and nothing is sent to a server. AI answers are <strong className="font-semibold text-ink">simulated</strong> (rules, not a
            language model).
          </span>
        </p>
        <button
          type="button"
          onClick={() => {
            setResetting(true)
            resetDemo()
          }}
          disabled={resetting}
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-sm font-medium text-ink hover:border-ink disabled:opacity-60"
        >
          <RotateCcw aria-hidden="true" className="size-4" />
          {resetting ? 'Resetting…' : 'Reset demo'}
        </button>
      </div>
    </section>
  )
}
