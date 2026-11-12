import { Bot, Calculator, FlaskConical } from 'lucide-react'

interface SourceBadgeProps {
  source: string | null
}

/**
 * Says who produced a suggestion, so demo output is never mistaken for real AI:
 * the offline demo provider, the deterministic scheduler, or a real AI model.
 */
export function SourceBadge({ source }: SourceBadgeProps) {
  if (source === 'engine') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-line-strong px-2 py-0.5 text-xs text-ink-muted">
        <Calculator aria-hidden="true" className="size-3.5" />
        Scheduler
      </span>
    )
  }
  if (source === 'mock') {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border border-priority-medium/60 px-2 py-0.5 text-xs text-priority-medium"
        title="Rule-based demo responses, not a language model. No AI service is connected."
      >
        <FlaskConical aria-hidden="true" className="size-3.5" />
        Demo AI
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-glow/60 px-2 py-0.5 text-xs text-glow">
      <Bot aria-hidden="true" className="size-3.5" />
      AI
    </span>
  )
}
