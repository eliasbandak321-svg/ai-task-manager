import { Reveal } from './Reveal'

const STEPS = [
  { title: 'Add your work', text: 'Create projects and tasks, or describe a goal and let the assistant draft the project with you.' },
  { title: 'Set your hours', text: 'Choose your working days, when your day starts and ends, and how long a work session should be.' },
  { title: 'Approve the plan', text: 'Review the proposed sessions, untick what you don\'t want, and they appear on your calendar.' },
]

/** Three steps on a gradient line. */
export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-title" className="scroll-mt-24 px-5 pb-[clamp(88px,12vw,150px)] md:px-8">
      <div className="mx-auto max-w-[75rem]">
        <Reveal className="text-center">
          <p className="lp-eyebrow">How it works</p>
          <h2 id="how-title" className="lp-h2 text-ink">
            From a list to a plan <span className="lp-serif text-gradient">in three steps.</span>
          </h2>
        </Reveal>
        <Reveal>
          <ol className="relative mt-[4.5rem] grid gap-9 md:grid-cols-3 md:gap-8">
            <span aria-hidden="true" className="lp-rule-gradient absolute top-0 bottom-0 left-[34px] w-px md:top-[34px] md:right-0 md:bottom-auto md:left-0 md:h-px md:w-auto" />
            {STEPS.map((step, index) => (
              <li key={step.title} className="relative grid grid-cols-[68px_minmax(0,1fr)] gap-[18px] md:block">
                <span className="relative grid size-[68px] place-items-center rounded-full border border-line-strong bg-night font-serif text-[2.1rem] italic text-ink">{index + 1}</span>
                <div>
                  <h3 className="mt-[18px] mb-2 font-display text-[1.35rem] font-semibold tracking-tight text-ink md:mt-[26px]">{step.title}</h3>
                  <p className="max-w-[34ch] text-ink-muted">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  )
}
