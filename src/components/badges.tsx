// Small pieces shared by the brand list, the local places and the pitch box:
// the score badge, the source tag and the colours of the place categories.

import type { ReactNode } from "react";

/**
 * Place category colours as hex, because Leaflet writes them into SVG
 * attributes, where CSS variables do not work. Same values as --color-cafe,
 * --color-clothing and --color-bar in globals.css. Kept out of places-map.tsx,
 * which loads Leaflet.
 */
export const PLACE_COLORS: Record<string, string> = {
  cafes: "#a24b1c",
  clothing: "#1b6b73",
  bars: "#7d2338",
};

const FALLBACK_PLACE_COLOR = "#5c554d";

export function placeColor(categoryId: string): string {
  return PLACE_COLORS[categoryId] ?? FALLBACK_PLACE_COLOR;
}

const badgeClass =
  "inline-grid h-[30px] w-10 shrink-0 place-items-center rounded-chip text-[15px] font-bold tabular-nums";

/**
 * Sponsor Fit Score in a small ink box. `top` marks the best score of the
 * whole search with a spot line. A place with little taste data has no score:
 * a dashed box with a dash.
 */
export function ScoreBadge({
  score,
  color,
  top = false,
}: {
  score: number | null;
  /** Background for a local place, by its category. Brands are ink. */
  color?: string;
  top?: boolean;
}) {
  if (score === null) {
    return (
      <span
        className={`${badgeClass} border-[1.5px] border-dashed border-field text-ink-2`}
        title="No score: Qloo has little taste data for this place"
      >
        <span aria-hidden="true">–</span>
        <span className="sr-only">No score</span>
      </span>
    );
  }
  return (
    <span
      className={`${badgeClass} text-white ${color ? "" : "bg-ink"} ${top ? "shadow-[inset_0_-4px_0_var(--color-spot)]" : ""}`}
      style={color ? { backgroundColor: color } : undefined}
      title={top ? "Sponsor Fit Score, our own score out of 100. Best score in this search." : "Sponsor Fit Score, our own score out of 100"}
    >
      <span className="sr-only">Sponsor Fit Score </span>
      {score}
    </span>
  );
}

const TONE_DOT = {
  live: "bg-ok",
  saved: "bg-ink",
  ai: "bg-spot",
  template: "bg-ink-3",
} as const;

/** Where a result or draft came from: Live, Saved example, Written by AI, Template draft. */
export function SourceTag({ tone, children }: { tone: keyof typeof TONE_DOT; children: ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 text-xs font-semibold text-ink-2">
      <span aria-hidden="true" className={`h-[7px] w-[7px] shrink-0 rounded-full ${TONE_DOT[tone]}`} />
      <span>{children}</span>
    </span>
  );
}
