import '../landing.css'
import { AssistantShowcase } from '../components/landing/AssistantShowcase'
import { FeatureExplorer } from '../components/landing/FeatureExplorer'
import { FinalCta } from '../components/landing/FinalCta'
import { HowItWorks } from '../components/landing/HowItWorks'
import { LandingFooter } from '../components/landing/LandingFooter'
import { LandingHeader } from '../components/landing/LandingHeader'
import { LandingHero } from '../components/landing/LandingHero'
import { ProductPreview } from '../components/landing/ProductPreview'
import { ProjectsShowcase } from '../components/landing/ProjectsShowcase'
import { SchedulingShowcase } from '../components/landing/SchedulingShowcase'

/** The public landing page (M10, approved Direction A "Midnight Focus"). */
export function LandingPage() {
  return (
    <div className="landing min-h-svh bg-night">
      <title>AI Task Manager · Less chaos. More focus.</title>
      <a
        href="#content"
        className="sr-only rounded-full bg-btn px-4 py-2 text-sm font-semibold text-btn-ink focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-60"
      >
        Skip to content
      </a>
      <LandingHeader />
      <main id="content" tabIndex={-1} className="focus:outline-none">
        <LandingHero />
        <ProductPreview />
        <FeatureExplorer />
        <HowItWorks />
        <AssistantShowcase />
        <SchedulingShowcase />
        <ProjectsShowcase />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  )
}
