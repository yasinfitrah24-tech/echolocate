"use client";

// Local sponsors section: asks /api/places once per search, then shows a map
// and a ranked list. Give it a `key` that changes with each search so it
// starts fresh.

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { LocalPlace, QlooCall } from "@/lib/qloo";
import { PitchBox, usePitch, type PitchContext } from "./pitch-draft";

const PlacesMap = dynamic(() => import("./places-map"), {
  ssr: false,
  loading: () => <div className="h-80 w-full animate-pulse bg-zinc-100 sm:h-96" />,
});

// Kept in sync with CATEGORY_COLORS in places-map.tsx. Not imported from there,
// because importing that file here would load Leaflet on the server.
const COLORS: Record<string, string> = {
  cafes: "#b45309",
  clothing: "#4f46e5",
  bars: "#be123c",
};

export interface PlacesSearchInfo {
  calls: QlooCall[];
  search: { by: "point" | "city"; radiusKm: number | null; widened: boolean };
  /** When the saved example was recorded; null for a live search. */
  savedExample: string | null;
  tookMs: number;
}

interface PlacesResponse extends PlacesSearchInfo {
  input: { city: string; barsIncluded: boolean };
  places: LocalPlace[];
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
  /** False when the form is no longer 21+: no pitch to bars then. */
  barsAllowed?: boolean;
}

const LIST_SIZE = 8;

export function LocalSponsors({
  artists,
  genreTags,
  city,
  age,
  admission,
  onLoaded,
  pitchContext = null,
  barsAllowed = false,
}: LocalSponsorsProps) {
  const pitch = usePitch();
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

  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 px-5 py-3">
        <h3 className="text-sm font-semibold">
          Local sponsors near {city}{" "}
          {data && <span className="font-normal text-zinc-500">({data.places.length})</span>}
        </h3>
        <p className="mt-0.5 text-xs text-zinc-500">
          Local businesses this crowd already goes to. Easier to sign than national brands, often for
          in-kind deals.
        </p>
      </div>

      {loading && (
        <div>
          <div className="h-80 w-full animate-pulse bg-zinc-100 sm:h-96" />
          <p className="px-5 py-3 text-sm text-zinc-500">Finding local spots…</p>
        </div>
      )}

      {error && (
        <p role="alert" className="px-5 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {data && data.places.length === 0 && (
        <p className="px-5 py-3 text-sm text-zinc-600">
          No local places found for this crowd in {city}. Try a bigger nearby city.
        </p>
      )}

      {data && data.center && data.places.length > 0 && (
        <>
          {data.places.every((place) => place.littleData) && (
            <p className="border-b border-zinc-200 px-5 py-2.5 text-sm text-zinc-600">
              Qloo has little taste data for places here, so these are sorted by distance.
            </p>
          )}
          <PlacesMap
            places={shown}
            center={data.center}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />

          <div className="flex flex-wrap gap-2 border-t border-zinc-200 px-5 py-3">
            {[["all", "All"] as const, ...categories].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setFilter(id);
                  setShowAll(false);
                }}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
                  filter === id
                    ? "border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-300 text-zinc-700 hover:bg-zinc-100"
                }`}
              >
                {id !== "all" && (
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: COLORS[id] ?? "#3f3f46" }}
                  />
                )}
                {label}
              </button>
            ))}
          </div>

          <ul className="divide-y divide-zinc-100 border-t border-zinc-200">
            {listed.map((place) => {
              const selected = place.entityId === selectedId;
              const open = pitch.pitchFor === place.entityId;
              // No pitch without taste data: it would claim a match Qloo does not show.
              const pitchAllowed = !place.littleData && (place.categoryId !== "bars" || barsAllowed);
              return (
                <li key={place.entityId} className={`px-5 py-3 hover:bg-zinc-50 ${selected ? "bg-zinc-50" : ""}`}>
                  <div className="flex flex-wrap items-start gap-x-3 gap-y-2 sm:flex-nowrap">
                    <button
                      type="button"
                      onClick={() => setSelectedId(place.entityId)}
                      className="flex min-w-0 flex-1 items-start gap-3 text-left"
                    >
                      <span
                        className="mt-0.5 w-10 shrink-0 rounded-md py-1 text-center text-sm font-semibold tabular-nums text-white"
                        style={{ backgroundColor: place.littleData ? "#a1a1aa" : (COLORS[place.categoryId] ?? "#3f3f46") }}
                        title={place.littleData ? "No score: Qloo has little taste data for this place" : "Sponsor Fit Score, 0 to 100"}
                      >
                        {place.fitScore ?? "–"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{place.name}</span>
                        <span className="mt-0.5 block text-xs text-zinc-500">
                          {[
                            place.categoryLabel,
                            place.neighborhood,
                            place.rating ? `${place.rating}★` : null,
                            `${place.distanceKm} km from the search center`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                        <span className="mt-0.5 block text-sm text-zinc-600">
                          {place.littleData ? "Nearby · little taste data" : place.reasonText}
                        </span>
                      </span>
                    </button>
                    <div className="flex w-full gap-1.5 pl-13 sm:w-auto sm:shrink-0 sm:pl-0">
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
                              },
                              pitchContext,
                            )
                          }
                          disabled={!pitchAllowed || (pitch.loading && open)}
                          title={
                            pitchAllowed
                              ? undefined
                              : place.littleData
                                ? "Qloo has little taste data for this place, so there is no match to pitch."
                                : "Bars need a 21+ event. Search again as 21+."
                          }
                          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100 disabled:opacity-50"
                        >
                          {pitch.loading && open ? "Writing…" : "Draft pitch"}
                        </button>
                      )}
                      {place.website && (
                        <a
                          href={place.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-center text-xs font-medium text-zinc-800 hover:bg-zinc-100"
                        >
                          Website
                        </a>
                      )}
                    </div>
                  </div>
                  {open && <PitchBox pitch={pitch.pitch} error={pitch.error} copied={pitch.copied} onCopy={pitch.copy} />}
                </li>
              );
            })}
          </ul>

          {shown.length > LIST_SIZE && (
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              className="w-full border-t border-zinc-200 px-5 py-2.5 text-left text-xs font-medium text-zinc-600 hover:bg-zinc-50"
            >
              {showAll ? "Show fewer" : `Show all ${shown.length}`}
            </button>
          )}

          <p className="border-t border-zinc-200 px-5 py-2.5 text-xs text-zinc-500">
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
    </div>
  );
}
