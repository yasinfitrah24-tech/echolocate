"use client";

// "How the agent got this": a summary that is always visible, the decisions
// the agent took for this search (in plain words), and every Qloo request
// behind the results, with its parameters, in a table that opens.

import type { QlooCall } from "@/lib/qloo";
import type { PlacesSearchInfo } from "./local-sponsors";
import { cardClass } from "./styles";

/** The <details> element; opened from the links in the results header. */
export const AGENT_DETAILS_ID = "agent-details";

function count(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

/** The request as Qloo received it: path and query parameters, one per line. The key is never in it. */
function RequestText({ call }: { call: QlooCall }) {
  const lines = Object.entries(call.params).map(([key, value]) => `  ${key}=${value}`);
  return (
    <details className="mt-1">
      <summary className="cursor-pointer text-[13px] font-bold text-ink-2 hover:text-ink">Request</summary>
      <pre className="mt-1 overflow-x-auto rounded-field bg-paper px-3 py-2 font-mono text-xs leading-relaxed whitespace-pre-wrap break-all">
        {`GET ${call.endpoint}\n${lines.join("\n")}`}
      </pre>
    </details>
  );
}

function CallRow({ call, unit }: { call: QlooCall; unit: string }) {
  return (
    <tr className="border-t border-line align-top">
      <td className="py-2 pr-3 pl-5 md:pl-7">
        <code className="font-mono text-xs">{call.endpoint}</code>
      </td>
      <td className="py-2 pr-3">
        {call.label}
        <RequestText call={call} />
      </td>
      <td className="py-2 pr-3 whitespace-nowrap tabular-nums">
        {call.error ? "failed" : `${call.resultCount} ${unit}`}
      </td>
      <td className="py-2 pr-5 whitespace-nowrap tabular-nums md:pr-7">
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
  decisions,
}: {
  /** Brand search calls. */
  calls: QlooCall[];
  /** Place searches, once /api/places has answered; null before that or without a city. */
  places: PlacesSearchInfo | null;
  brandCount: number;
  savedExample: boolean;
  /** What the agent decided for this search, in order. */
  decisions: string[];
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
    <section id="agent" className={`mt-14 scroll-mt-4 md:mt-20 ${cardClass}`} aria-labelledby="agent-title">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 pt-5 md:px-7">
        <h3 id="agent-title" className="font-display text-[26px] md:text-[30px]">
          How the agent got this
        </h3>
        <p className="font-bold tabular-nums">{summary}</p>
      </div>
      <p className="px-5 pt-1 text-sm text-ink-3 md:px-7">
        {savedExample
          ? "Saved example: answered from a recording of real Qloo answers, so no live calls were made."
          : "Live: every call below was made for this search."}
      </p>

      <div className="mt-4 border-t border-line px-5 py-4 md:px-7">
        <h4 className="font-bold">What the agent decided</h4>
        <ol className="mt-2 space-y-1.5">
          {decisions.map((decision, index) => (
            <li key={decision} className="flex gap-3 text-[15px]">
              <span
                aria-hidden="true"
                className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-ink bg-accent-tint text-xs font-bold"
              >
                {index + 1}
              </span>
              <span className="pt-px">{decision}</span>
            </li>
          ))}
        </ol>
      </div>

      <details id={AGENT_DETAILS_ID} className="border-t border-line">
        <summary className="cursor-pointer rounded-b-card px-5 py-3.5 text-[15px] font-bold hover:bg-accent-tint md:px-7">
          Show every Qloo request and how the score works
        </summary>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-t border-line text-[13px] text-ink-3">
                <th scope="col" className="py-2 pr-3 pl-5 font-bold md:pl-7">
                  Qloo endpoint
                </th>
                <th scope="col" className="py-2 pr-3 font-bold">
                  What it asked
                </th>
                <th scope="col" className="py-2 pr-3 font-bold">
                  Results
                </th>
                <th scope="col" className="py-2 pr-5 font-bold md:pr-7">
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
        <div className="space-y-2 border-t border-line px-5 py-4 text-[13px] text-ink-3 md:px-7">
          <p>
            The Sponsor Fit Score is our own score out of 100, and it never goes above 95. Each brand is compared
            with the other brands for this crowd: mostly how strongly the crowd likes it in Qloo&rsquo;s taste data,
            plus where it ranks in its list. Local places are compared with other local places, and places Qloo has
            little taste data for get no score. A score is not a promise that a sponsor says yes.
          </p>
          <p>Nothing personal is sent to Qloo: only artist names, a genre, the city and an age group.</p>
        </div>
      </details>
    </section>
  );
}
