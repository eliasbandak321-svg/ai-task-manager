import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'
import { EdgeLighting } from './EdgeLighting'
import { Reveal } from './Reveal'

/** Closing call to action with a quieter version of the hero's edge lighting. */
export function FinalCta() {
  return (
    <section aria-labelledby="final-title" className="px-5 pb-6 md:px-8">
      <Reveal className="lp-hero relative mx-auto max-w-[77.5rem] rounded-[24px] border border-line bg-surface/70 px-6 py-[clamp(80px,12vw,150px)] text-center md:rounded-[36px]">
        <EdgeLighting side="left" compact />
        <EdgeLighting side="right" compact />
        <div className="relative z-2 flex flex-col items-center gap-6">
          <p className="lp-eyebrow m-0">Get started</p>
          <h2 id="final-title" className="lp-h2 text-[clamp(2.4rem,6.4vw,5.4rem)] text-ink">
            Make room for <span className="lp-serif text-gradient">what matters.</span>
          </h2>
          <p className="max-w-[52ch] text-[1.08rem] text-ink-muted">Create an account, add a project, and let the scheduler propose your first work sessions.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/signup" className="lp-btn lp-btn-primary">
              Get started
              <span className="lp-arrow">
                <ArrowRight aria-hidden="true" className="size-3.5" />
              </span>
            </Link>
            <Link to="/login" className="lp-btn">Log in</Link>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
