import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { site } from '../../config/site'
import { CTA_COPY } from '../../config/landingCta'
import { IS_DEMO } from '../../demo/demoMode'

/*
  The landing page's calls to action. The normal build invites people to create an account;
  the portfolio demo build (M11, VITE_DEMO=1) has no accounts, so it opens the demo instead
  and points to the source code.
*/

/** "Get started" (sign-up), or "View demo" in the demo build. */
export function PrimaryCta({ className, children, onClick }: { className: string; children?: ReactNode; onClick?: () => void }) {
  return (
    <Link to={IS_DEMO ? '/app' : '/signup'} className={className} onClick={onClick}>
      {CTA_COPY.primary}
      {children}
    </Link>
  )
}

/** "Log in", or the source code on GitHub in the demo build. */
export function SecondaryCta({ className, onClick }: { className: string; onClick?: () => void }) {
  if (IS_DEMO) {
    return (
      <a href={site.repoUrl} className={className} onClick={onClick}>
        {CTA_COPY.secondary}
      </a>
    )
  }
  return (
    <Link to="/login" className={className} onClick={onClick}>
      {CTA_COPY.secondary}
    </Link>
  )
}
