import { Link } from 'react-router'

interface NotFoundMessageProps {
  title: string
  children: string
}

/** A page-level "not found" inside the dashboard, with a way back. */
export function NotFoundMessage({ title, children }: NotFoundMessageProps) {
  return (
    <div className="rounded-card border border-line bg-surface p-8">
      <title>{`${title} · AI Task Manager`}</title>
      <h1 className="font-display text-h2 font-semibold text-ink">{title}</h1>
      <p className="mt-2 text-ink-muted">{children}</p>
      <Link
        to="/app"
        className="mt-6 inline-flex min-h-11 items-center rounded-full bg-glow px-5 text-sm font-semibold text-night hover:bg-glow-strong"
      >
        Go to all tasks
      </Link>
    </div>
  )
}
