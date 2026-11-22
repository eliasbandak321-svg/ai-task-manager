import { Link } from 'react-router'
import { site } from '../../config/site'
import { IS_DEMO } from '../../demo/demoMode'
import { Wordmark } from '../Wordmark'
import { PrimaryCta, SecondaryCta } from './Cta'

/** Site footer (M10). */
export function LandingFooter() {
  const linkClass = 'text-ink-muted hover:text-ink'
  return (
    <footer className="px-5 pt-[4.5rem] pb-[calc(2.5rem+env(safe-area-inset-bottom))] md:px-8">
      <div className="mx-auto max-w-[75rem]">
        <div className="flex flex-wrap justify-between gap-8 border-b border-line pb-10">
          <div>
            <Wordmark />
            <p className="mt-3 max-w-[36ch] text-[0.9375rem] text-ink-muted">Tasks, projects and calendar in one place, with an assistant that proposes and never imposes.</p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-14 text-[0.9375rem]">
            <div className="flex flex-col gap-2">
              <b className="mb-1 font-semibold text-ink">Product</b>
              <a href="#features" className={linkClass}>Features</a>
              <a href="#assistant" className={linkClass}>Assistant</a>
              <a href="#scheduling" className={linkClass}>Scheduling</a>
              <a href="#projects" className={linkClass}>Projects</a>
            </div>
            <div className="flex flex-col gap-2">
              <b className="mb-1 font-semibold text-ink">Account</b>
              {!IS_DEMO && <SecondaryCta className={linkClass} />}
              <PrimaryCta className={linkClass} />
              <a href={site.repoUrl} className={linkClass}>Source on GitHub</a>
              <Link to="/privacy" className={linkClass}>Privacy</Link>
            </div>
          </nav>
        </div>
        <div className="flex flex-wrap justify-between gap-3 pt-5 text-[0.8125rem] text-ink-subtle">
          <span>{site.name}</span>
          <span>A student portfolio project</span>
        </div>
        <p aria-hidden="true" className="lp-wordmark mt-14 text-center">Focus.</p>
      </div>
    </footer>
  )
}
