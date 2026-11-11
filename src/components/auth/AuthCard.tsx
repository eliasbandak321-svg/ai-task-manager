import type { ReactNode } from 'react'
import { Wordmark } from '../Wordmark'

interface AuthCardProps {
  title: string
  description: string
  children: ReactNode
  footer: ReactNode
}

/** The shared frame of the sign-in and sign-up pages. */
export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <main id="main" className="grid min-h-svh place-items-center px-4 py-10">
      <title>{`${title} · AI Task Manager`}</title>
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <Wordmark to="/" />
        </div>
        <div className="mt-8 rounded-card border border-line bg-surface p-6 shadow-card sm:p-8">
          <h1 className="font-display text-h3 font-semibold text-ink">{title}</h1>
          <p className="mt-1 text-sm text-ink-muted">{description}</p>
          {children}
        </div>
        <p className="mt-6 text-center text-sm text-ink-muted">{footer}</p>
      </div>
    </main>
  )
}
