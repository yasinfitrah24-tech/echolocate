"use client";

// Local sponsors section: asks /api/places once per search, then shows a map
// and a ranked list, with a pitch draft and a one-pager per place. Give it a `key` that changes with each search so it
// starts fresh.

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { buildPlaceOnePager, placeNoun, type OnePagerDetails, type SearchFacts } from "@/lib/one-pager";
import type { LocalPlace, QlooCall } from "@/lib/qloo";
import { EchoLoader, ScoreBadge, placeColor } from "./badges";
import { OnePagerPanel } from "./one-pager-panel";
import { PitchBox, usePitch, type PitchContext } from "./pitch-draft";
import { cardClass, errorNoticeClass, ghostButton, linkClass, noticeClass, sectionTitleClass } from "./styles";

const PlacesMap = dynamic(() => import("./places-map"), {
  ssr: false,
  loading: () => <div className="h-[280px] w-full bg-card motion-safe:animate-pulse md:h-[440px]" />,
});

/** Border and corners of the map box. */
const mapFrame = "rounded-[14px] border-2 border-ink";

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
  // Pins on the map carry the place's number in the list, for places with a score.
  const pinNumbers = new Map(
    shown.filter((place) => !place.littleData).map((place, index) => [place.entityId, index + 1] as const),
  );

  const tasteData = data?.places.some((place) => !place.littleData) ?? false;
  const subtitle = !data
    ? "Local businesses near the event. Easier to sign than national brands, often for in-kind deals."
    : `${data.places.length} ${data.places.length === 1 ? "place" : "places"} ${
        data.search.by === "point" ? `within ${data.search.radiusKm} km of the center of ${city}` : `in ${city}`
      }. ${
        // A taste claim only when at least one place has taste data.
        tasteData ? "Local businesses this crowd already goes to." : "Local businesses near the event."
      } Easier to sign than national brands, often for in-kind deals.`;

  return (
    <section className="mt-14 md:mt-20" aria-labelledby="local-title">
      <h2 id="local-title" className={sectionTitleClass}>
        Local sponsors
      </h2>
      <p className="mt-3 max-w-[52em] text-ink-2">{subtitle}</p>

      {loading && (
        <div className="mt-8">
          <div className={`h-[280px] w-full ${mapFrame} bg-card motion-safe:animate-pulse md:h-[440px]`} />
          {/* Shown exactly while /api/places runs; no timer. */}
          <p role="status" className="mt-4 flex items-center gap-3 text-ink-2">
            <EchoLoader />
            Finding local places…
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className={`mt-8 ${errorNoticeClass}`}>
          {error}
        </p>
      )}

      {data && data.places.length === 0 && (
        <p className={`mt-8 ${noticeClass}`}>
          {data.input.cityPopulation === null || data.input.cityPopulation < SMALL_CITY
            ? `No local places found for this crowd in ${city}. Try a bigger nearby city.`
            : "Qloo has few places for this crowd here. Try another genre."}
        </p>
      )}

      {data && data.center && data.places.length > 0 && (
        <>
          {data.places.every((place) => place.littleData) && (
            <p className={`mt-6 ${noticeClass}`}>
              Qloo has little taste data for places here, so these are sorted by distance.
            </p>
          )}

          <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {/* The map stays in view next to a long list on wide screens. */}
            <div className="lg:sticky lg:top-4">
              <div className={`overflow-hidden ${mapFrame}`}>
                <PlacesMap
                  places={shown}
                  numbers={pinNumbers}
                  center={data.center}
                  searchArea={searchArea}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              </div>
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px] text-ink-2" aria-label="Map key">
                {categories.map(([id, label]) => (
                  <li key={id} className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="size-[11px] rounded-full" style={{ backgroundColor: placeColor(id) }} />
                    {label}
                  </li>
                ))}
                {data.places.some((place) => place.littleData) && (
                  <li className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="size-[11px] rounded-full border-2 border-[#77726b] bg-card" />
                    Little data, no score
                  </li>
                )}
                {searchArea && (
                  <li className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="w-4 border-t-2 border-dashed border-ink" />
                    {searchArea.radiusKm} km search
                  </li>
                )}
                <li>Pin numbers follow the list.</li>
              </ul>
            </div>

            <div className={cardClass}>
              <div className="flex flex-wrap gap-2 border-b border-line px-5 py-4">
                {[["all", "All"] as const, ...categories].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setFilter(id);
                      setShowAll(false);
                    }}
                    aria-pressed={filter === id}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-bold ${
                      filter === id ? "border-2 border-ink bg-accent-tint" : "border-[1.5px] border-field bg-card hover:border-ink"
                    }`}
                  >
                    {id !== "all" && (
                      <span aria-hidden="true" className="size-2.5 rounded-full" style={{ backgroundColor: placeColor(id) }} />
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
                      className={`border-t border-line px-5 py-4 first:border-t-0 ${
                        selected ? "bg-accent-tint/50 shadow-[inset_4px_0_0_var(--color-accent)]" : "hover:bg-paper"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedId(place.entityId)}
                        aria-pressed={selected}
                        className="flex w-full min-w-0 items-start gap-3.5 rounded-field text-left"
                      >
                        <ScoreBadge score={place.fitScore} size="small" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-bold">
                            {pinNumbers.has(place.entityId) && (
                              <span className="font-normal text-ink-3">{pinNumbers.get(place.entityId)}. </span>
                            )}
                            {place.name}
                          </span>
                          <span className="mt-0.5 flex items-baseline gap-1.5 text-sm text-ink-2">
                            <span
                              aria-hidden="true"
                              className={`size-2.5 shrink-0 self-center rounded-full ${place.littleData ? "border-2 border-[#77726b] bg-card" : ""}`}
                              style={place.littleData ? undefined : { backgroundColor: placeColor(place.categoryId) }}
                            />
                            <span>
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
                          </span>
                          <span className="mt-1 block text-[15px] text-ink-2">
                            {place.littleData ? "Nearby · little taste data" : place.reasonText}
                          </span>
                        </span>
                      </button>
                      {/* Not indented on phones, so the buttons stay on one line. */}
                      <div className="mt-3 flex flex-wrap gap-2 sm:pl-[56px]">
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
                <div className="border-t border-line px-5 py-4">
                  <button type="button" onClick={() => setShowAll(!showAll)} className={`${linkClass} text-[15px]`}>
                    {showAll ? "Show fewer" : `Show all ${shown.length} places`}
                  </button>
                </div>
              )}

              <p className="border-t border-line px-5 py-3 text-[13px] text-ink-3">
                {data.savedExample
                  ? `${data.calls.length} saved Qloo place searches.`
                  : `${data.calls.length} Qloo place searches in ${(data.tookMs / 1000).toFixed(1)} s.`}
                {data.search.widened ? " Widened once, because few places were closer." : ""}
                {data.droppedDuplicates > 0 &&
                  ` ${data.droppedDuplicates} repeat chain ${data.droppedDuplicates === 1 ? "branch" : "branches"} hidden.`}
                {data.droppedFar > 0 &&
                  ` ${data.droppedFar} ${data.droppedFar === 1 ? "place" : "places"} far outside the city hidden.`}
                {!data.input.barsIncluded && " Bars only show for 21+ events."}
              </p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
