import { ButtonLink } from '../components/ButtonLink'
import { Wordmark } from '../components/Wordmark'

/** Any URL that isn't the landing page or the app. */
export function NotFoundPage() {
  return (
    <main id="content" className="grid min-h-svh place-items-center p-6 text-center">
      <title>Page not found · AI Task Manager</title>
      <div>
        <Wordmark to="/" />
        <h1 className="mt-8 font-display text-h2 font-semibold text-ink">Page not found</h1>
        <p className="mt-2 text-ink-muted">This page doesn't exist.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink to="/">Go to the home page</ButtonLink>
          <ButtonLink to="/app" variant="secondary">
            Open the app
          </ButtonLink>
        </div>
      </div>
    </main>
  )
}
