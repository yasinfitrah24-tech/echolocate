// Small pieces shared by the brand list, the local places and the pitch box:
// the score badge, the source tag, the echo loader and the colours of the
// place categories.

import type { ReactNode } from "react";

/**
 * Place category colours as hex, because Leaflet writes them into SVG
 * attributes and inline styles of its own. Same values as --color-cafe,
 * --color-clothing and --color-bar in globals.css. Kept out of
 * places-map.tsx, which loads Leaflet.
 */
export const PLACE_COLORS: Record<string, string> = {
  cafes: "#8b4513",
  clothing: "#5b3cc4",
  bars: "#0b7253",
};

const FALLBACK_PLACE_COLOR = "#4a3f57";

export function placeColor(categoryId: string): string {
  return PLACE_COLORS[categoryId] ?? FALLBACK_PLACE_COLOR;
}

const SIZES = {
  large: "size-12 text-[19px]",
  small: "size-[42px] text-base",
};

/**
 * Sponsor Fit Score in a pale yellow square. `best` is the single best score
 * of the whole search: sun yellow, ink outline and a hard shadow. A place
 * with little taste data has no score: a dashed square with a dash.
 */
export function ScoreBadge({
  score,
  best = false,
  size = "large",
}: {
  score: number | null;
  best?: boolean;
  size?: keyof typeof SIZES;
}) {
  const base = `font-display inline-grid shrink-0 place-items-center rounded-field tabular-nums ${SIZES[size]}`;
  if (score === null) {
    return (
      <span
        className={`${base} border-[1.5px] border-dashed border-field text-ink-3`}
        title="No score: Qloo has little taste data for this place"
      >
        <span aria-hidden="true">–</span>
        <span className="sr-only">No score</span>
      </span>
    );
  }
  return (
    <span
      className={`${base} text-ink ${best ? "border-2 border-ink bg-sun shadow-hard" : "bg-accent-tint"}`}
      title="Sponsor Fit Score, our own score out of 100"
    >
      <span className="sr-only">Sponsor Fit Score </span>
      {score}
    </span>
  );
}

/** Shown next to the name of the brand with the best score of the search. */
export function BestFitPill() {
  return (
    <span className="inline-block rounded-full border-2 border-ink bg-sun px-2.5 py-px align-middle text-xs font-bold whitespace-nowrap">
      Best fit in this search
    </span>
  );
}

/** Where a result or draft came from: Saved example, Live, Written by AI, Template draft. */
export function SourceTag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-2 rounded-field bg-accent-tint px-3 py-1 text-[13px] font-bold text-ink">
      <span aria-hidden="true" className="size-2 shrink-0 self-center rounded-full bg-ink" />
      <span>{children}</span>
    </span>
  );
}

/** Three rings going out from an ink dot, next to the text of a running search. */
export function EchoLoader() {
  return (
    <span aria-hidden="true" className="relative inline-block size-[30px] shrink-0">
      {[0, 0.6, 1.2].map((delay) => (
        <span
          key={delay}
          data-echo-ring
          className="absolute inset-0 animate-echo rounded-full border-2 border-accent"
          style={{ animationDelay: `${delay}s` }}
        />
      ))}
      <span className="absolute inset-[11px] rounded-full bg-ink" />
    </span>
  );
}
