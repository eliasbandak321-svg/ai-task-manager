import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Wordmark } from '../components/Wordmark'
import { site } from '../config/site'

/** Last change to this notice; update it whenever the content changes. */
const LAST_UPDATED = '22 November 2026'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-h3 font-semibold text-ink">{title}</h2>
      {children}
    </section>
  )
}

/** A short, plain-language privacy notice for the public portfolio website (M11). */
export function PrivacyPage() {
  const linkClass = 'text-glow underline-offset-2 hover:text-glow-strong hover:underline'
  return (
    <main id="content" className="mx-auto max-w-2xl px-5 py-10 sm:py-14">
      <title>Privacy · AI Task Manager</title>
      <Wordmark to="/" />
      <h1 className="mt-10 font-display text-page font-semibold text-ink">Privacy</h1>
      <p className="mt-2 text-sm text-ink-subtle">Last updated {LAST_UPDATED}</p>

      <div className="mt-8 space-y-8 text-ink-muted">
        <p>
          AI Task Manager is a student portfolio project, not a commercial service. This website has no accounts, no analytics, no
          advertising and no tracking.
        </p>

        <Section title="The demo runs in your browser">
          <p>
            The <Link to="/app" className={linkClass}>demo</Link> uses fictional sample data. Anything you add or change is kept only in
            this browser tab (its session storage) and disappears when you close the tab or press “Reset demo”. None of it is sent to a
            server, and the AI answers are simulated in your browser: no AI service is contacted.
          </p>
        </Section>

        <Section title="Cookies and storage">
          <p>
            The website sets no cookies. It remembers your light or dark theme choice in your browser’s local storage, and the demo keeps
            its data in session storage, as described above.
          </p>
        </Section>

        <Section title="Hosting">
          <p>
            The website is served by a hosting provider (Vercel), which, like any web host, processes technical request data such as your
            IP address and browser type to deliver the pages and keep them secure. This project doesn’t receive or store that data.
          </p>
        </Section>

        <Section title="The full version">
          <p>
            The source code also contains the full application with accounts, a PostgreSQL database and an optional AI provider. It isn’t
            offered on this website; anyone running it themselves is responsible for the data it stores.
          </p>
        </Section>

        <Section title="Questions">
          <p>
            Open an issue on the project’s{' '}
            <a href={site.repoUrl} className={linkClass}>
              GitHub page
            </a>
            . Please don’t post personal data there.
          </p>
        </Section>
      </div>
    </main>
  )
}
