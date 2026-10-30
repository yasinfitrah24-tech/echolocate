"use client";

// The top of the page: the hero panel with "Try an example", then how it works.

import { heroPrimaryButton, heroSecondaryButton, sectionTitleClass } from "./styles";

/** Static pose of the four rings, also the pose with reduced motion. */
const RINGS = [
  { scale: 1, opacity: 0.45 },
  { scale: 0.72, opacity: 0.7 },
  { scale: 0.46, opacity: 1 },
  { scale: 0.22, opacity: 1 },
];

/** Tangerine echo rings around an ink dot, bleeding off the bottom right of the hero. Decorative. */
function HeroRings() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -right-[109px] -bottom-[143px] size-[386px] md:-right-[260px] md:-bottom-[340px] md:size-[920px]"
    >
      {RINGS.map((ring, index) => (
        <div
          key={index}
          data-echo-ring
          className="absolute inset-0 animate-hero-echo rounded-full border-[30px] border-accent will-change-transform md:border-[72px]"
          style={{ transform: `scale(${ring.scale})`, opacity: ring.opacity, animationDelay: `${-index * 1.5}s` }}
        />
      ))}
      <div className="absolute inset-[42%] rounded-full bg-ink" />
    </div>
  );
}

export function Hero({
  onTryExample,
  onTryOtherExample,
  otherExampleLabel,
  busy,
  exampleNote,
}: {
  /** The main saved example: the small show Echolocate is built for. */
  onTryExample: () => void;
  /** The other saved example: a bigger show with known artists. */
  onTryOtherExample: () => void;
  otherExampleLabel: string;
  busy: boolean;
  /** What the saved example is, shown under the buttons. */
  exampleNote: string;
}) {
  return (
    <section className="mx-auto max-w-[1312px] px-5 pt-6 md:px-16 md:pt-10">
      <div className="relative overflow-hidden rounded-hero border-2 border-ink bg-sun px-[22px] pt-8 pb-[150px] md:px-[72px] md:py-[88px]">
        <HeroRings />
        <div className="relative flex max-w-[960px] flex-col gap-6">
          <h1 className="font-display text-[52px] leading-[0.92] text-balance md:text-[104px] md:leading-[0.9]">
            Sponsors for events too small to have a sponsorship team.
          </h1>
          {/* The approved elevator pitch (16 Oct): what the app does and where Qloo comes in. */}
          <p className="max-w-[34em] text-lg leading-[1.45] md:text-[21px]">
            Pick your music and city, and Echolocate uses Qloo taste data to rank the brands and local shops your
            crowd likes, then drafts the pitch.
          </p>
          <p className="max-w-[34em] text-lg leading-[1.45] font-bold md:text-[21px]">
            Your event isn&rsquo;t in Qloo, but the music on your line-up is.
          </p>
          <div className="flex flex-wrap items-start gap-3">
            <button type="button" onClick={onTryExample} disabled={busy} className={heroPrimaryButton}>
              Try an example
            </button>
            <a href="#your-event" className={heroSecondaryButton}>
              Use your own event ↓
            </a>
          </div>
          <div className="flex max-w-[40em] flex-col gap-2 text-sm">
            <p>{exampleNote}</p>
            <p>
              <button
                type="button"
                onClick={onTryOtherExample}
                disabled={busy}
                className="text-left font-bold underline decoration-2 underline-offset-[3px] hover:decoration-accent disabled:opacity-60"
              >
                {otherExampleLabel} →
              </button>
            </p>
          </div>
        </div>
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
    <section id="how-it-works" className="mx-auto max-w-[1312px] scroll-mt-4 px-5 pt-14 md:px-16 md:pt-24">
      <h2 className={sectionTitleClass}>How it works</h2>
      <ol className="mt-8 grid gap-4 md:grid-cols-3 md:gap-6">
        {STEPS.map((step, index) => (
          <li key={step.title} className="rounded-card border-2 border-ink bg-card p-6">
            <span
              aria-hidden="true"
              className="grid size-11 place-items-center rounded-full border-2 border-ink bg-accent font-bold"
            >
              {index + 1}
            </span>
            <h3 className="font-display mt-5 text-2xl">{step.title}</h3>
            <p className="mt-2 text-ink-2">{step.body}</p>
          </li>
        ))}
      </ol>
      {/* Who decides what: from CLAUDE.md, "The LLM writes text; Qloo picks the sponsors." */}
      <p className="mt-8 text-ink-2">
        Qloo picks who to ask and why. The AI only writes the email, from those facts and your event details. Made for
        campus shows, community gigs and small venues with no one to find sponsors.
      </p>
    </section>
  );
}
