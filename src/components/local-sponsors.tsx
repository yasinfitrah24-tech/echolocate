"use client";

// Local sponsors section: asks /api/places once per search, then shows a map
// and a ranked list, with a pitch draft and a one-pager per place. Give it a `key` that changes with each search so it
// starts fresh.

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { buildPlaceOnePager, placeNoun, type OnePagerDetails, type SearchFacts } from "@/lib/one-pager";
import type { LocalPlace, QlooCall } from "@/lib/qloo";
import { ScoreBadge, placeColor } from "./badges";
import { OnePagerPanel } from "./one-pager-panel";
import { PitchBox, usePitch, type PitchContext } from "./pitch-draft";
import { cardClass, cardTitleClass, ghostButton } from "./styles";

const PlacesMap = dynamic(() => import("./places-map"), {
  ssr: false,
  loading: () => <div className="h-80 w-full bg-paper motion-safe:animate-pulse sm:h-96 lg:h-[460px]" />,
});

export interface PlacesSearchInfo {
  places: LocalPlace[];
  calls: QlooCall[];
  search: { by: "point" | "city"; radiusKm: number | null; widened: boolean };
  /** When the saved example was recorded; null for a live search. */
  savedExample: string | null;
  tookMs: number;
}

interface PlacesResponse extends PlacesSearchInfo {
  input: {
    city: string;
    barsIncluded: boolean;
    cityPopulation: number | null;
    /** The point distances and the radius are measured from; null for a city searched by name. */
    cityPoint: { lat: number; lon: number } | null;
  };
  center: { lat: number; lon: number } | null;
  droppedFar: number;
  droppedDuplicates: number;
}

interface LocalSponsorsProps {
  artists: { entityId: string; name: string }[];
  genreTags: { id: string; name: string }[];
  city: string;
  age: string | null;
  admission: string;
  /** Hands the call log to the parent, for "How the agent got this". */
  onLoaded?: (info: PlacesSearchInfo) => void;
  /** Event facts for "Draft pitch"; null hides the button. */
  pitchContext?: PitchContext | null;
  /** False when the form is no longer 21+: no pitch or one-pager for bars then. */
  barsAllowed?: boolean;
  /** Facts and shared details for "Make one-pager"; null hides the button. */
  onePager?: {
    search: SearchFacts;
    details: OnePagerDetails;
    onDetailsChange: (details: OnePagerDetails) => void;
  } | null;
}

const LIST_SIZE = 8;

/** Below this population (US city list), "try a bigger city" is good advice. */
const SMALL_CITY = 50_000;

export function LocalSponsors({
  artists,
  genreTags,
  city,
  age,
  admission,
  onLoaded,
  pitchContext = null,
  barsAllowed = false,
  onePager = null,
}: LocalSponsorsProps) {
  const pitch = usePitch();
  const [sheetFor, setSheetFor] = useState<string | null>(null);
  const [data, setData] = useState<PlacesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/places", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ artists, genreTags, city, age: age ?? undefined, admission }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) {
          setError(body.error ?? "Could not load local sponsors");
        } else {
          setData(body as PlacesResponse);
          onLoaded?.(body as PlacesResponse);
        }
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setError("Could not reach the server for local sponsors.");
      });
    return () => controller.abort();
    // The parent remounts this component for each search, so one fetch is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loading = !data && !error;
  const categories = data
    ? [...new Map(data.places.map((place) => [place.categoryId, place.categoryLabel])).entries()]
    : [];
  const shown = (data?.places ?? []).filter((place) => filter === "all" || place.categoryId === filter);
  const listed = showAll ? shown : shown.slice(0, LIST_SIZE);
  const searchArea =
    data?.input.cityPoint && data.search.by === "point" && data.search.radiusKm
      ? { ...data.input.cityPoint, radiusKm: data.search.radiusKm }
      : null;

  return (
    <section className={`mt-8 ${cardClass}`} aria-labelledby="local-title">
      <div className="border-b border-line px-4 py-3.5 sm:px-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h3 id="local-title" className={cardTitleClass}>
            Local sponsors near {city}
          </h3>
          {data && (
            <span className="text-[13px] text-ink-2">
              {data.places.length} {data.places.length === 1 ? "place" : "places"}
            </span>
          )}
        </div>
        <p className="mt-1 text-[13px] text-ink-2">
          {/* A taste claim only when at least one place has taste data. */}
          {data?.places.some((place) => !place.littleData)
            ? "Local businesses this crowd already goes to. Easier to sign than national brands, often for in-kind deals."
            : "Local businesses near the event. Easier to sign than national brands, often for in-kind deals."}
        </p>
      </div>

      {loading && (
        <div>
          <div className="h-80 w-full bg-paper motion-safe:animate-pulse sm:h-96" />
          {/* Shown exactly while /api/places runs; no timer. */}
          <p role="status" className="flex items-center gap-3 px-4 py-3 text-sm sm:px-5">
            <span className="search-pulse" aria-hidden="true">
              <span />
              <span />
            </span>
            Finding local places…
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="px-4 py-3 text-sm text-error sm:px-5">
          {error}
        </p>
      )}

      {data && data.places.length === 0 && (
        <p className="px-4 py-3 text-sm text-ink-2 sm:px-5">
          {data.input.cityPopulation === null || data.input.cityPopulation < SMALL_CITY
            ? `No local places found for this crowd in ${city}. Try a bigger nearby city.`
            : "Qloo has few places for this crowd here. Try another genre."}
        </p>
      )}

      {data && data.center && data.places.length > 0 && (
        <>
          {data.places.every((place) => place.littleData) && (
            <p className="border-b border-line px-4 py-2.5 text-sm text-ink-2 sm:px-5">
              Qloo has little taste data for places here, so these are sorted by distance.
            </p>
          )}

          <div className="lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            {/* The map stays in view next to a long list on wide screens. */}
            <div className="border-b border-line lg:border-r lg:border-b-0">
              <div className="lg:sticky lg:top-0">
                <PlacesMap
                  places={shown}
                  center={data.center}
                  searchArea={searchArea}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
                <ul className="flex flex-wrap gap-x-4 gap-y-1.5 px-4 py-3 text-[13px] text-ink-2 sm:px-5" aria-label="Map key">
                  {categories.map(([id, label]) => (
                    <li key={id} className="flex items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className="h-[11px] w-[11px] rounded-full"
                        style={{ backgroundColor: placeColor(id) }}
                      />
                      {label}
                    </li>
                  ))}
                  {data.places.some((place) => place.littleData) && (
                    <li className="flex items-center gap-1.5">
                      <span aria-hidden="true" className="h-[11px] w-[11px] rounded-full border-2 border-ink-3 bg-card" />
                      Little taste data, no score
                    </li>
                  )}
                  {searchArea && (
                    <li className="flex items-center gap-1.5">
                      <span aria-hidden="true" className="w-4 border-t-2 border-dashed border-ink" />
                      Area searched ({searchArea.radiusKm} km)
                    </li>
                  )}
                </ul>
              </div>
            </div>

            <div>
              <div className="flex flex-wrap gap-2 border-b border-line px-4 py-3 sm:px-5">
                {[["all", "All"] as const, ...categories].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setFilter(id);
                      setShowAll(false);
                    }}
                    aria-pressed={filter === id}
                    className={`flex items-center gap-1.5 rounded-chip border px-2.5 py-1 text-xs font-semibold ${
                      filter === id ? "border-spot-ink bg-spot-tint text-ink" : "border-field bg-card text-ink hover:bg-paper"
                    }`}
                  >
                    {id !== "all" && (
                      <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: placeColor(id) }} />
                    )}
                    {label}
                  </button>
                ))}
              </div>

              <ul>
                {listed.map((place) => {
                  const selected = place.entityId === selectedId;
                  const open = pitch.pitchFor === place.entityId;
                  const sheetOpen = sheetFor === place.entityId;
                  // Places with little taste data still get a pitch and a one-pager, about being nearby.
                  const pitchAllowed = place.categoryId !== "bars" || barsAllowed;
                  return (
                    <li
                      key={place.entityId}
                      className={`border-t border-line px-4 py-3.5 first:border-t-0 sm:px-5 ${
                        selected ? "bg-paper shadow-[inset_3px_0_0_var(--color-spot)]" : "hover:bg-paper/60"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedId(place.entityId)}
                        aria-pressed={selected}
                        className="flex w-full min-w-0 items-start gap-3 rounded-control text-left"
                      >
                        <ScoreBadge
                          score={place.fitScore}
                          color={place.fitScore === null ? undefined : placeColor(place.categoryId)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold">{place.name}</span>
                          <span className="mt-0.5 block text-[13px] text-ink-2">
                            {[
                              place.categoryLabel,
                              place.neighborhood,
                              place.rating ? `${place.rating}★` : null,
                              // A city from the US list is measured from its own point; a typed
                              // city from the middle of the results, so it does not claim the city center.
                              data.search.by === "point"
                                ? `${place.distanceKm} km from the center of ${city}`
                                : `${place.distanceKm} km from the middle of these places`,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                          <span className="mt-1 block text-sm text-ink-2">
                            {place.littleData ? "Nearby · little taste data" : place.reasonText}
                          </span>
                        </span>
                      </button>
                      {/* Not indented on phones, so the three buttons stay on one line. */}
                      <div className="mt-2.5 flex flex-wrap gap-1.5 sm:pl-[52px]">
                        {pitchContext && (
                          <button
                            type="button"
                            onClick={() =>
                              pitch.draft(
                                place.entityId,
                                {
                                  name: place.name,
                                  categoryLabel: place.categoryLabel,
                                  reasonText: place.reasonText,
                                  kind: "place",
                                  ...(place.littleData ? { nearbyKm: place.distanceKm } : {}),
                                },
                                pitchContext,
                              )
                            }
                            disabled={!pitchAllowed || pitch.isWriting(place.entityId)}
                            title={pitchAllowed ? undefined : "Bars need a 21+ event. Search again as 21+."}
                            className={ghostButton}
                          >
                            {pitch.isWriting(place.entityId) ? "Writing…" : "Draft pitch"}
                          </button>
                        )}
                        {onePager && (
                          <button
                            type="button"
                            onClick={() => setSheetFor(sheetOpen ? null : place.entityId)}
                            disabled={!pitchAllowed}
                            aria-expanded={sheetOpen}
                            title={pitchAllowed ? undefined : "Bars need a 21+ event. Search again as 21+."}
                            className={ghostButton}
                          >
                            Make one-pager
                          </button>
                        )}
                        {place.website && (
                          <a href={place.website} target="_blank" rel="noopener noreferrer" className={ghostButton}>
                            Website
                          </a>
                        )}
                      </div>
                      {sheetOpen && pitchAllowed && onePager && (
                        <OnePagerPanel
                          kind="place"
                          name={place.name}
                          sponsorNoun={placeNoun(place.categoryLabel)}
                          eventName={onePager.search.eventName}
                          build={(details) => buildPlaceOnePager(place, onePager.search, details)}
                          blockedText="Bars need a 21+ event. Search again as 21+."
                          details={onePager.details}
                          onDetailsChange={onePager.onDetailsChange}
                        />
                      )}
                      {open && <PitchBox pitch={pitch.pitch} error={pitch.error} copied={pitch.copied} onCopy={pitch.copy} />}
                    </li>
                  );
                })}
              </ul>

              {shown.length > LIST_SIZE && (
                <button
                  type="button"
                  onClick={() => setShowAll(!showAll)}
                  className="w-full border-t border-line px-4 py-2.5 text-left text-xs font-semibold text-ink-2 hover:bg-paper hover:text-ink sm:px-5"
                >
                  {showAll ? "Show fewer" : `Show all ${shown.length}`}
                </button>
              )}
            </div>
          </div>

          <p className="border-t border-line px-4 py-2.5 text-xs text-ink-2 sm:px-5">
            {data.search.by === "point"
              ? `Within ${data.search.radiusKm} km of ${city}${data.search.widened ? " (widened, few places closer)" : ""}. `
              : ""}
            {data.savedExample
              ? `${data.calls.length} saved Qloo place searches.`
              : `${data.calls.length} Qloo place searches in ${(data.tookMs / 1000).toFixed(1)} s.`}
            {data.droppedDuplicates > 0 &&
              ` ${data.droppedDuplicates} repeat chain ${data.droppedDuplicates === 1 ? "branch" : "branches"} hidden.`}
            {data.droppedFar > 0 &&
              ` ${data.droppedFar} ${data.droppedFar === 1 ? "place" : "places"} far outside the city hidden.`}
            {!data.input.barsIncluded && " Bars only show for 21+ events."}
          </p>
        </>
      )}
    </section>
  );
}
