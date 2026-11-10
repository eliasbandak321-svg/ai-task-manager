import { Features } from '../components/Features'
import { Hero } from '../components/Hero'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'

/** The public landing page (temporary design until M10). */
export function LandingPage() {
  return (
    <>
      <a
        href="#content"
        className="sr-only rounded-full bg-glow px-4 py-2 text-sm font-semibold text-night focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-60"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="content" tabIndex={-1} className="focus:outline-none">
        <Hero />
        <Features />
      </main>
      <SiteFooter />
    </>
  )
}

