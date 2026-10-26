"use client";

// The top of the page: the hero with "Try an example", then how it works.

import { heroPrimaryButton, heroSecondaryButton } from "./styles";

/** Faint rings behind the hero, drawn like the logo: a dot, rings going out, one spot dot. */
function HeroRings() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full">
      <svg x="80%" y="42%" overflow="visible">
        <g className="hero-rings" fill="none" stroke="var(--color-ink)" strokeOpacity="0.08" strokeWidth="1.5">
          {[70, 150, 230, 310, 390, 470].map((radius) => (
            <circle key={radius} r={radius} />
          ))}
        </g>
        <g className="hidden sm:block">
          <circle r="9" fill="var(--color-ink)" fillOpacity="0.85" />
          <circle cx="216" cy="-79" r="7" fill="var(--color-spot)" />
        </g>
      </svg>
    </svg>
  );
}

export function Hero({
  onTryExample,
  busy,
  exampleNote,
}: {
  onTryExample: () => void;
  busy: boolean;
  /** What the saved example is, shown under the buttons. */
  exampleNote: string;
}) {
  return (
    <section className="relative overflow-hidden border-b border-line">
      <HeroRings />
      <div className="relative mx-auto max-w-[1120px] px-4 py-12 sm:px-6 sm:py-20">
        <h1 className="font-display max-w-[13em] text-[36px] text-balance sm:text-[56px]">
          Sponsors for events too small to have a sponsorship team.
        </h1>
        {/* The approved elevator pitch (16 Oct): what the app does and where Qloo comes in. */}
        <p className="mt-5 max-w-[34em] text-lg text-ink-2">
          Pick your music and city, and Echolocate uses Qloo taste data to rank the brands and local shops your
          crowd likes, then drafts the pitch.
        </p>
        <p className="mt-6 max-w-[34em] border-l-4 border-spot pl-3.5 text-lg font-semibold">
          Your event isn&rsquo;t in Qloo, but the music on your line-up is.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button type="button" onClick={onTryExample} disabled={busy} className={heroPrimaryButton}>
            Try an example
          </button>
          <a href="#your-event" className={heroSecondaryButton}>
            Use your own event ↓
          </a>
        </div>
        <p className="mt-3 max-w-[34em] text-[13px] text-ink-2">{exampleNote}</p>
      </div>
    </section>
  );
}

const STEPS = [
  {
    title: "Describe the show",
    body: "The kind of music or artists on the line-up, the city, who mostly comes, who is allowed in, how many.",
  },
  {
    title: "Qloo ranks the sponsors",
    body: "Brands and local places that fans of that music like, each with its rank and the reason.",
  },
  {
    title: "Send the ask",
    body: "A pitch email or a one-page sponsor sheet for any of them. Edit the parts in [brackets], then send it yourself.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-4 border-b border-line">
      <div className="mx-auto max-w-[1120px] px-4 py-12 sm:px-6">
        <h2 className="font-display text-[30px] sm:text-[40px]">How it works</h2>
        <ol className="mt-7 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="border-t-[3px] border-ink pt-3.5">
              <span aria-hidden="true" className="font-display block text-[34px] text-spot">
                {index + 1}
              </span>
              <h3 className="mt-2 text-lg font-bold">{step.title}</h3>
              <p className="mt-1 text-[15px] text-ink-2">{step.body}</p>
            </li>
          ))}
        </ol>
        {/* Who decides what: from CLAUDE.md, "The LLM writes text; Qloo picks the sponsors." */}
        <p className="mt-8 font-semibold">
          Qloo picks who to ask and why. The AI only writes the email, from those facts and your event details.
        </p>
        <p className="mt-1 text-ink-2">For campus shows, community gigs and small venues with no one to find sponsors.</p>
      </div>
    </section>
  );
}
