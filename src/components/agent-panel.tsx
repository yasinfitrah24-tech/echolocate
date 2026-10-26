"use client";

// "How the agent got this": a one-line summary that is always visible, and
// every Qloo call behind the results in a table that opens.

import type { QlooCall } from "@/lib/qloo";
import type { PlacesSearchInfo } from "./local-sponsors";
import { cardClass, cardTitleClass } from "./styles";

/** The <details> element; opened from the links in the results header. */
export const AGENT_DETAILS_ID = "agent-details";

function count(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function CallRow({ call, unit }: { call: QlooCall; unit: string }) {
  return (
    <tr className="border-t border-line align-top">
      <td className="py-2 pr-3 pl-4 sm:pl-5">
        <code className="font-mono text-xs">{call.endpoint}</code>
      </td>
      <td className="py-2 pr-3">{call.label}</td>
      <td className="py-2 pr-3 whitespace-nowrap tabular-nums">
        {call.error ? "failed" : `${call.resultCount} ${unit}`}
      </td>
      <td className="py-2 pr-4 whitespace-nowrap tabular-nums sm:pr-5">
        {call.saved ? "saved" : `${(call.ms / 1000).toFixed(1)} s`}
        {call.retries > 0 ? ` · retried ${call.retries}x` : ""}
      </td>
    </tr>
  );
}

export function AgentPanel({
  calls,
  places,
  brandCount,
  savedExample,
  alcoholBlocked,
}: {
  /** Brand search calls. */
  calls: QlooCall[];
  /** Place searches, once /api/places has answered; null before that or without a city. */
  places: PlacesSearchInfo | null;
  brandCount: number;
  savedExample: boolean;
  alcoholBlocked: boolean;
}) {
  const callCount = calls.length + (places?.calls.length ?? 0);
  const summary = [
    count(callCount, "Qloo call"),
    count(brandCount, "brand"),
    places ? count(places.places.length, "place") : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section id="agent" className={`mt-8 scroll-mt-4 ${cardClass}`} aria-labelledby="agent-title">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pt-3.5 sm:px-5">
        <h3 id="agent-title" className={cardTitleClass}>
          How the agent got this
        </h3>
        <p className="font-semibold tabular-nums">{summary}</p>
      </div>
      <p className="px-4 pt-1 text-[13px] text-ink-2 sm:px-5">
        {savedExample
          ? "Saved example: answered from a recording of real Qloo answers, so no live calls were made."
          : "Live: every call below was made for this search."}
      </p>

      <details id={AGENT_DETAILS_ID} className="mt-3 border-t border-line">
        <summary className="cursor-pointer px-4 py-2.5 text-sm font-semibold hover:bg-paper sm:px-5">
          Show every call and how the score works
        </summary>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-t border-line text-xs text-ink-2">
                <th scope="col" className="py-2 pr-3 pl-4 font-bold sm:pl-5">
                  Qloo endpoint
                </th>
                <th scope="col" className="py-2 pr-3 font-bold">
                  What it asked
                </th>
                <th scope="col" className="py-2 pr-3 font-bold">
                  Results
                </th>
                <th scope="col" className="py-2 pr-4 font-bold sm:pr-5">
                  Time
                </th>
              </tr>
            </thead>
            <tbody>
              {calls.map((call) => (
                <CallRow key={call.label} call={call} unit={call.endpoint === "/v2/insights" ? "brands" : "results"} />
              ))}
              {places?.calls.map((call, index) => (
                <CallRow key={`place-${index}`} call={call} unit="places" />
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-2 border-t border-line px-4 py-3 text-xs text-ink-2 sm:px-5">
          {places && (
            <p>
              {places.search.by === "point"
                ? places.search.widened
                  ? `Local places: fewer than 6 close by, so the search was widened once to ${places.search.radiusKm} km around the city.`
                  : `Local places: searched within ${places.search.radiusKm} km of the city, based on its size.`
                : "Local places: searched by city name, because this city is not in our US city list."}
            </p>
          )}
          <p>
            The Sponsor Fit Score is our own score out of 100, and it never goes above 95. Each brand is compared
            with the other brands for this crowd: mostly how strongly the crowd likes it in Qloo&rsquo;s taste data,
            plus where it ranks in its list. Local places are compared with other local places, and places Qloo has
            little taste data for get no score.
          </p>
          {alcoholBlocked && <p>Beer, wine and spirits brands are left out because this is not a 21+ event.</p>}
        </div>
      </details>
    </section>
  );
}
